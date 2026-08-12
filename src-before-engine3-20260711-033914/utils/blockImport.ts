import * as XLSX from "xlsx";

import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { Resident } from "../types/resident";
import type { RotationRequirement } from "../types/rotation";
import { getRotationEligibility } from "./rotationEligibility";

export type BlockImportAction =
  | "new"
  | "replace"
  | "same"
  | "override"
  | "review";

export type BlockImportPreviewRow = {
  rowNumber: number;
  sourceResident: string;
  sourceBlock: string;
  sourceRotation: string;
  resident?: Resident;
  block?: AcademicBlock;
  rotation?: RotationRequirement;
  existingAssignment?: BlockAssignment;
  action: BlockImportAction;
  message: string;
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

function uniqueById<T extends { id: string }>(items: T[]) {
  const map = new Map(items.map((item) => [item.id, item]));
  return Array.from(map.values());
}

function buildResidentCandidates(residents: Resident[]) {
  const map = new Map<string, Resident[]>();

  function add(key: string, resident: Resident) {
    if (!key) return;
    const list = map.get(key) || [];
    list.push(resident);
    map.set(key, uniqueById(list));
  }

  for (const resident of residents.filter((item) => item.active)) {
    add(normalize(resident.displayName), resident);
    add(normalize(`${resident.firstName} ${resident.lastName}`), resident);
    add(normalize(resident.firstName), resident);
    add(normalize(resident.lastName), resident);
  }

  return map;
}

function findResident(
  sourceName: string,
  candidates: Map<string, Resident[]>
): Resident | undefined {
  const matches = candidates.get(normalize(sourceName)) || [];
  return matches.length === 1 ? matches[0] : undefined;
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

  if (["ambvacation", "vacationamb"].includes(normalized)) {
    return undefined;
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
  const match = String(value || "").match(/block\s*(\d+)/i);
  return match ? Number(match[1]) : fallback;
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

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("The workbook has no worksheets.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets[firstSheetName],
    { header: 1, defval: "", raw: false }
  );

  const residentHeaderRowIndex = matrix.findIndex((row) =>
    row.some((cell) => normalize(cell) === "resident")
  );

  if (residentHeaderRowIndex < 0) {
    throw new Error('Could not find a row containing "Resident".');
  }

  const residentColumnIndex = matrix[residentHeaderRowIndex].findIndex(
    (cell) => normalize(cell) === "resident"
  );

  const blockLabelRow = matrix[Math.max(0, residentHeaderRowIndex - 1)] || [];
  const residentCandidates = buildResidentCandidates(residents);
  const blockByNumber = new Map(blocks.map((block) => [block.blockNumber, block]));
  const existingByResidentBlock = new Map(
    existingAssignments.map((assignment) => [
      `${assignment.residentId}_${assignment.blockId}`,
      assignment,
    ])
  );

  const previews: BlockImportPreviewRow[] = [];

  for (let rowIndex = residentHeaderRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const sourceResident = String(row[residentColumnIndex] || "").trim();
    if (!sourceResident) continue;

    const resident = findResident(sourceResident, residentCandidates);

    for (let columnIndex = residentColumnIndex + 1; columnIndex < row.length; columnIndex += 1) {
      const sourceRotation = String(row[columnIndex] || "").trim();
      if (!sourceRotation) continue;

      const fallbackBlockNumber = columnIndex - residentColumnIndex;
      const sourceBlock = String(blockLabelRow[columnIndex] || `Block ${fallbackBlockNumber}`);
      const blockNumber = blockNumberFromValue(sourceBlock, fallbackBlockNumber);
      const block = blockByNumber.get(blockNumber);

      if (!resident) {
        previews.push({
          rowNumber: rowIndex + 1,
          sourceResident,
          sourceBlock,
          sourceRotation,
          block,
          action: "review",
          message: "Resident name did not match exactly or was ambiguous.",
        });
        continue;
      }

      if (!block) {
        previews.push({
          rowNumber: rowIndex + 1,
          sourceResident,
          sourceBlock,
          sourceRotation,
          resident,
          action: "review",
          message: `Block ${blockNumber} was not found for the selected academic year.`,
        });
        continue;
      }

      const rotation = findRotation(sourceRotation, resident, rotations);

      if (!rotation) {
        previews.push({
          rowNumber: rowIndex + 1,
          sourceResident,
          sourceBlock,
          sourceRotation,
          resident,
          block,
          action: "review",
          message: "Rotation could not be mapped safely. Composite values require manual review.",
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
          sourceResident,
          sourceBlock,
          sourceRotation,
          resident,
          block,
          rotation,
          existingAssignment,
          action: "review",
          message: `${resident.pgy} is not allowed on ${rotation.name}.`,
        });
        continue;
      }

      const same = existingAssignment?.rotationId === rotation.id;
      const baseAction: BlockImportAction = same
        ? "same"
        : existingAssignment
          ? "replace"
          : "new";

      previews.push({
        rowNumber: rowIndex + 1,
        sourceResident,
        sourceBlock,
        sourceRotation,
        resident,
        block,
        rotation,
        existingAssignment,
        action: eligibility === "override" && baseAction !== "same" ? "override" : baseAction,
        message:
          eligibility === "override"
            ? "Coverage/override assignment; an override reason will be stored."
            : same
              ? "Already matches the draft schedule."
              : existingAssignment
                ? `Will replace ${existingAssignment.rotationName}.`
                : "New draft assignment.",
      });
    }
  }

  return previews;
}
