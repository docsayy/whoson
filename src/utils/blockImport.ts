import * as XLSX from "xlsx";

import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { Resident } from "../types/resident";
import type { RotationRequirement } from "../types/rotation";
import {
  matchMethodLabel,
  matchResidentName,
  type PersonMatchMethod,
} from "./personMatching";
import { getRotationEligibility } from "./rotationEligibility";

export type BlockImportAction =
  | "new"
  | "replace"
  | "same"
  | "override"
  | "review";

export type BlockImportPreviewRow = {
  rowNumber: number;
  sheetName?: string;
  sourceResident: string;
  sourceBlock: string;
  sourceRotation: string;
  resident?: Resident;
  block?: AcademicBlock;
  rotation?: RotationRequirement;
  existingAssignment?: BlockAssignment;
  action: BlockImportAction;
  message: string;
  matchConfidence?: number;
  matchMethod?: PersonMatchMethod;
};

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRotationSource(value: string) {
  return value
    .trim()
    .replace(/\s+as\s+pgy\s*[123]\s*$/i, "")
    .replace(/\s+/g, " ");
}

function findRotation(
  sourceValue: string,
  resident: Resident,
  rotations: RotationRequirement[]
) {
  const cleaned = normalizeRotationSource(sourceValue);
  const normalized = normalize(cleaned);
  if (!normalized) return undefined;

  if (["nfamb", "ambnf", "pgy3nfamb"].includes(normalized)) {
    return resident.pgy === "PGY-3"
      ? rotations.find((rotation) => rotation.id === "pgy3-nf-amb")
      : undefined;
  }

  if (["nf", "nightfloat", "pgy3nf"].includes(normalized)) {
    return resident.pgy === "PGY-3"
      ? rotations.find((rotation) => rotation.id === "pgy3-nf")
      : undefined;
  }

  const aliasTable: Record<string, string> = {
    emergency: "er",
    emergencyroom: "er",
    hematologyoncology: "heme-onc",
    hemonc: "heme-onc",
    hemoncology: "heme-onc",
    nephrorheumendo: "nephro-rheum-endo",
    nre: "nephro-rheum-endo",
    cardiology: "ccu-cardio",
    cardioccu: "ccu-cardio",
    clinic: "ambulatory",
    amb: "ambulatory",
  };

  const canonicalId = aliasTable[normalized];
  if (canonicalId) {
    const mapped = rotations.find((rotation) => rotation.id === canonicalId);
    if (mapped) return mapped;
  }

  const exact = rotations.find((rotation) => {
    const candidates = [rotation.id, rotation.name, ...(rotation.aliases || [])];
    return candidates.some((candidate) => normalize(candidate) === normalized);
  });
  if (exact) return exact;

  const contained = rotations.filter((rotation) => {
    const candidates = [rotation.id, rotation.name, ...(rotation.aliases || [])];
    return candidates.some((candidate) => {
      const candidateNormalized = normalize(candidate);
      return (
        candidateNormalized.length >= 3 &&
        (normalized.includes(candidateNormalized) ||
          candidateNormalized.includes(normalized))
      );
    });
  });

  return contained.length === 1 ? contained[0] : undefined;
}

function blockNumberFromValue(value: unknown, fallback: number) {
  const text = String(value || "");
  const match = text.match(/(?:block|b)\s*(\d+)/i) || text.match(/^\s*(\d+)\s*$/);
  return match ? Number(match[1]) : fallback;
}

function locateHeader(matrix: unknown[][]) {
  const acceptedHeaders = new Set(["resident", "residentname", "name"]);
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 20); rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const columnIndex = row.findIndex((cell) => acceptedHeaders.has(normalize(cell)));
    if (columnIndex >= 0) return { rowIndex, columnIndex };
  }
  return null;
}

export async function parseBlockScheduleWorkbook({
  file,
  blocks,
  residents,
  rotations,
  existingAssignments,
}: {
  file: File;
  blocks: AcademicBlock[];
  residents: Resident[];
  rotations: RotationRequirement[];
  existingAssignments: BlockAssignment[];
}): Promise<BlockImportPreviewRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });

  const blockByNumber = new Map(blocks.map((block) => [block.blockNumber, block]));
  const existingByResidentBlock = new Map(
    existingAssignments.map((assignment) => [
      `${assignment.residentId}_${assignment.blockId}`,
      assignment,
    ])
  );

  const previews: BlockImportPreviewRow[] = [];
  let recognizedSheet = false;

  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });

    const header = locateHeader(matrix);
    if (!header) continue;
    recognizedSheet = true;

    const residentHeaderRowIndex = header.rowIndex;
    const residentColumnIndex = header.columnIndex;
    const blockLabelRows = [
      matrix[Math.max(0, residentHeaderRowIndex - 1)] || [],
      matrix[residentHeaderRowIndex] || [],
    ];

    for (
      let rowIndex = residentHeaderRowIndex + 1;
      rowIndex < matrix.length;
      rowIndex += 1
    ) {
      const row = matrix[rowIndex] || [];
      const sourceResident = String(row[residentColumnIndex] || "").trim();
      if (!sourceResident) continue;

      const match = matchResidentName(sourceResident, residents);
      const resident = match.resident;

      for (
        let columnIndex = residentColumnIndex + 1;
        columnIndex < row.length;
        columnIndex += 1
      ) {
        const sourceRotation = String(row[columnIndex] || "").trim();
        if (!sourceRotation) continue;

        const fallbackBlockNumber = columnIndex - residentColumnIndex;
        const sourceBlock = String(
          blockLabelRows.map((labels) => labels[columnIndex]).find(Boolean) ||
            `Block ${fallbackBlockNumber}`
        );
        const blockNumber = blockNumberFromValue(sourceBlock, fallbackBlockNumber);
        const block = blockByNumber.get(blockNumber);

        if (!resident) {
          previews.push({
            rowNumber: rowIndex + 1,
            sheetName,
            sourceResident,
            sourceBlock,
            sourceRotation,
            block,
            action: "review",
            matchConfidence: match.confidence,
            matchMethod: match.method,
            message:
              match.method === "ambiguous"
                ? `Multiple residents could match “${sourceResident}”: ${match.candidates
                    .map((item) => item.displayName)
                    .join(", ")}.`
                : `Resident was not matched. ${matchMethodLabel(match.method)}.`,
          });
          continue;
        }

        if (!block) {
          previews.push({
            rowNumber: rowIndex + 1,
            sheetName,
            sourceResident,
            sourceBlock,
            sourceRotation,
            resident,
            action: "review",
            matchConfidence: match.confidence,
            matchMethod: match.method,
            message: `Block ${blockNumber} was not found for the selected academic year.`,
          });
          continue;
        }

        const rotation = findRotation(sourceRotation, resident, rotations);
        if (!rotation) {
          previews.push({
            rowNumber: rowIndex + 1,
            sheetName,
            sourceResident,
            sourceBlock,
            sourceRotation,
            resident,
            block,
            action: "review",
            matchConfidence: match.confidence,
            matchMethod: match.method,
            message: `Resident matched as ${resident.displayName} (${match.confidence}%). Rotation could not be mapped safely.`,
          });
          continue;
        }

        const existingAssignment = existingByResidentBlock.get(
          `${resident.id}_${block.id}`
        );
        const eligibility = getRotationEligibility(resident, rotation);

        if (eligibility === "not-allowed") {
          previews.push({
            rowNumber: rowIndex + 1,
            sheetName,
            sourceResident,
            sourceBlock,
            sourceRotation,
            resident,
            block,
            rotation,
            existingAssignment,
            action: "review",
            matchConfidence: match.confidence,
            matchMethod: match.method,
            message: `${resident.displayName} matched at ${match.confidence}%, but ${resident.pgy} is not allowed on ${rotation.name}.`,
          });
          continue;
        }

        const same = existingAssignment?.rotationId === rotation.id;
        const baseAction: BlockImportAction = same
          ? "same"
          : existingAssignment
            ? "replace"
            : "new";

        const matchText = `${matchMethodLabel(match.method)} (${match.confidence}%).`;
        previews.push({
          rowNumber: rowIndex + 1,
          sheetName,
          sourceResident,
          sourceBlock,
          sourceRotation,
          resident,
          block,
          rotation,
          existingAssignment,
          action:
            eligibility === "override" && baseAction !== "same"
              ? "override"
              : baseAction,
          matchConfidence: match.confidence,
          matchMethod: match.method,
          message:
            eligibility === "override"
              ? `${matchText} Coverage/override assignment; an override reason will be stored.`
              : same
                ? `${matchText} Already matches the draft schedule.`
                : existingAssignment
                  ? `${matchText} Will replace ${existingAssignment.rotationName}.`
                  : `${matchText} New draft assignment.`,
        });
      }
    }
  }

  if (!recognizedSheet) {
    throw new Error(
      'Could not find a worksheet with a "Resident", "Resident Name", or "Name" column.'
    );
  }

  return previews;
}
