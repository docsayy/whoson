import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import PublishIcon from "@mui/icons-material/Publish";
import RestoreIcon from "@mui/icons-material/Restore";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { useAuth } from "../context/AuthContext";
import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useResidents } from "../hooks/useResidents";
import { useRotations } from "../hooks/useRotations";
import {
  getBlockScheduleVersions,
  getDraftAssignmentsForYear,
  getLatestPublishedAssignmentsForYear,
  type BlockAssignmentUpsert,
} from "../services/blockAssignmentService";
import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { Resident } from "../types/resident";
import type { RotationRequirement } from "../types/rotation";
import { generateAcademicBlocks } from "../utils/academicBlocks";
import {
  buildBlockValidations,
  chooseSlotKeyForAssignment,
  type BlockValidation,
} from "../utils/blockValidation";
import {
  parseBlockScheduleWorkbook,
  type BlockImportPreviewRow,
} from "../utils/blockImport";
import {
  CONFIRMED_2026_HOSPITAL_HOLIDAYS,
  holidayYearNeedsConfirmation,
} from "../utils/holidayRules";
import { canBuildSchedule } from "../utils/permissions";
import { publishPublicWhoOnAcademicYear } from "../services/publicWhosOnService";
import {
  getRotationEligibility,
  type RotationEligibilityMode,
} from "../utils/rotationEligibility";

type BlockTab = "Everyone" | "PGY-1" | "PGY-2" | "PGY-3";
type BuilderView = "draft" | "published";

function getDefaultAcademicYear() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function rotationColor(rotationName: string) {
  const lower = rotationName.toLowerCase();
  if (lower.includes("micu")) return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
  if (lower.includes("ccu") || lower.includes("card")) return { bg: "#fff1f2", color: "#be123c", border: "#fecdd3" };
  if (lower.includes("tele")) return { bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" };
  if (lower.includes("ambulatory") || lower.includes("clinic")) return { bg: "#ecfdf5", color: "#15803d", border: "#bbf7d0" };
  if (lower.includes("vacation")) return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  if (lower.includes("elective")) return { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" };
  if (lower.includes("nf") || lower.includes("night")) return { bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe" };
  if (lower.includes("jeopardy")) return { bg: "#fefce8", color: "#a16207", border: "#fde68a" };
  if (lower === "er") return { bg: "#ecfeff", color: "#0e7490", border: "#a5f3fc" };
  return { bg: "#f8fafc", color: "#334155", border: "#e2e8f0" };
}

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map((header) => `"${header}"`).join(","),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BlockSchedulePage({
  onOpenResidentProfile,
}: {
  onOpenResidentProfile?: (residentId: string) => void;
}) {
  const { profile } = useAuth();
  const allowBuild = canBuildSchedule(profile?.role);

  const {
    blocks,
    loading: blocksLoading,
    saving: blocksSaving,
    error: blocksError,
    saveBlocks,
    saveActiveChief,
    publishActiveChiefs,
    restoreActiveChiefs,
  } = useAcademicBlocks();
  const { residents, loading: residentsLoading, error: residentsError } = useResidents();
  const {
    rotations,
    loading: rotationsLoading,
    error: rotationsError,
    seedRotations,
  } = useRotations();
  const {
    assignments,
    loading: assignmentsLoading,
    saving,
    error: assignmentsError,
    addAssignment,
    saveAssignment,
    removeAssignment,
    importAssignments,
    publishYear,
    restoreVersion,
  } = useBlockAssignments();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<BlockTab>("Everyone");
  const [search, setSearch] = useState("");
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());
  const [firstBlockEndDate, setFirstBlockEndDate] = useState("");
  const [builderView, setBuilderView] = useState<BuilderView>("draft");
  const [editingCell, setEditingCell] = useState<{
    resident: Resident;
    block: AcademicBlock;
    assignment?: BlockAssignment;
  } | null>(null);
  const [editingChiefBlock, setEditingChiefBlock] =
    useState<AcademicBlock | null>(null);
  const [importRows, setImportRows] = useState<BlockImportPreviewRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [replaceDifferent, setReplaceDifferent] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreVersionNumber, setRestoreVersionNumber] = useState("");
  const [message, setMessage] = useState("");
  const [showResidentCounts, setShowResidentCounts] = useState(false);

  const pageLoading =
    blocksLoading || residentsLoading || rotationsLoading || assignmentsLoading;
  const pageError =
    blocksError || residentsError || rotationsError || assignmentsError;

  const activeRotations = useMemo(
    () =>
      rotations
        .filter((rotation) => rotation.active)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [rotations]
  );

  const previewBlocks = useMemo(() => {
    if (!academicYear || !firstBlockEndDate) return [];
    return generateAcademicBlocks({ academicYear, firstBlockEndDate });
  }, [academicYear, firstBlockEndDate]);

  const displayedBlocks = useMemo(() => {
    const source = previewBlocks.length > 0 ? previewBlocks : blocks;
    return source
      .filter((block) => block.academicYear === academicYear)
      .sort((a, b) => a.blockNumber - b.blockNumber);
  }, [academicYear, blocks, previewBlocks]);

  const draftAssignments = useMemo(
    () => getDraftAssignmentsForYear(assignments, academicYear),
    [academicYear, assignments]
  );

  const publishedAssignments = useMemo(
    () => getLatestPublishedAssignmentsForYear(assignments, academicYear),
    [academicYear, assignments]
  );

  const visibleAssignments = useMemo(() => {
    if (!allowBuild) return publishedAssignments;
    return builderView === "draft" ? draftAssignments : publishedAssignments;
  }, [allowBuild, builderView, draftAssignments, publishedAssignments]);

  const versions = useMemo(
    () => getBlockScheduleVersions(assignments, academicYear),
    [academicYear, assignments]
  );

  const activeResidents = useMemo(
    () =>
      residents
        .filter((resident) => resident.active)
        .filter((resident) => tab === "Everyone" || resident.pgy === tab)
        .filter((resident) =>
          `${resident.displayName} ${resident.email} ${resident.pgy}`
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        )
        .sort((a, b) => {
          const pgyOrder = a.pgy.localeCompare(b.pgy);
          return pgyOrder || a.displayName.localeCompare(b.displayName);
        }),
    [residents, search, tab]
  );

  const chiefResidents = useMemo(
    () =>
      residents
        .filter(
          (resident) =>
            resident.active &&
            resident.role === "Chief Resident" &&
            resident.pgy === "PGY-3"
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [residents]
  );

  function visibleActiveChief(block: AcademicBlock) {
    if (allowBuild && builderView === "draft") {
      return block.activeChiefDraft || null;
    }
    return block.activeChiefPublished || null;
  }

  const assignmentsByResidentBlock = useMemo(() => {
    const map = new Map<string, BlockAssignment>();
    for (const assignment of visibleAssignments) {
      map.set(`${assignment.residentId}_${assignment.blockId}`, assignment);
    }
    return map;
  }, [visibleAssignments]);

  const validations = useMemo(
    () =>
      buildBlockValidations({
        blocks: displayedBlocks,
        assignments: visibleAssignments,
        residents,
        rotations: activeRotations,
      }),
    [activeRotations, displayedBlocks, residents, visibleAssignments]
  );

  const validationSummary = useMemo(() => {
    const totalIssues = validations.reduce(
      (sum, validation) => sum + validation.issues.length,
      0
    );
    const complete = validations.filter(
      (validation) =>
        validation.completionPercent === 100 && validation.issues.length === 0
    ).length;
    const average = validations.length
      ? Math.round(
          validations.reduce(
            (sum, validation) => sum + validation.completionPercent,
            0
          ) / validations.length
        )
      : 0;

    return { totalIssues, complete, average };
  }, [validations]);

  const rotationCounts = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const resident of activeResidents) result[resident.id] = {};

    for (const assignment of visibleAssignments) {
      if (!result[assignment.residentId]) continue;
      result[assignment.residentId][assignment.rotationName] =
        (result[assignment.residentId][assignment.rotationName] || 0) + 1;
    }

    return result;
  }, [activeResidents, visibleAssignments]);

  async function handleSaveBlocks() {
    if (!allowBuild || previewBlocks.length === 0) return;
    await saveBlocks(previewBlocks);
    setMessage("Academic blocks saved.");
  }

  async function handleSeedRotations() {
    if (!allowBuild) return;
    await seedRotations();
    setMessage("Rotation definitions updated.");
  }

  async function handleSaveActiveChief(residentId: string) {
    if (!allowBuild || !editingChiefBlock || builderView !== "draft") return;

    const resident = chiefResidents.find((item) => item.id === residentId);

    await saveActiveChief({
      blockId: editingChiefBlock.id,
      residentId: resident?.id,
      residentName: resident?.displayName,
    });

    setEditingChiefBlock(null);
    setMessage(
      resident
        ? `${resident.displayName} assigned as Active Chief for ${editingChiefBlock.name}.`
        : `Active Chief cleared for ${editingChiefBlock.name}.`
    );
  }

  async function handleSaveAssignment(data: {
    resident: Resident;
    block: AcademicBlock;
    rotationId: string;
    notes: string;
    overrideReason: string;
    existingAssignment?: BlockAssignment;
  }) {
    if (!allowBuild) return;
    const rotation = activeRotations.find((item) => item.id === data.rotationId);
    if (!rotation) return;

    const eligibility = getRotationEligibility(data.resident, rotation);
    if (eligibility === "not-allowed") return;
    if (eligibility === "override" && !data.overrideReason.trim()) return;

    const currentRotationAssignments = draftAssignments.filter(
      (assignment) =>
        assignment.blockId === data.block.id &&
        assignment.rotationId === rotation.id &&
        assignment.id !== data.existingAssignment?.id
    );

    const inferredSlotKey = chooseSlotKeyForAssignment({
      rotation,
      resident: data.resident,
      existingAssignments: currentRotationAssignments,
      residents,
      includeOverride: eligibility === "override",
    });

    // PGY-3 coverage on 2N always represents the 2NC senior override slot.
    // Keep this explicit so manual assignments remain reliable even if old
    // Firestore rotation metadata is incomplete. Unlimited rotations such as
    // Jeopardy intentionally have no slot key.
    const slotKey =
      rotation.id === "2n" && data.resident.pgy === "PGY-3"
        ? "2nc-senior"
        : inferredSlotKey;

    const now = new Date().toISOString();

    if (data.existingAssignment) {
      await saveAssignment({
        ...data.existingAssignment,
        rotationId: rotation.id,
        rotationName: rotation.name,
        slotKey,
        status: "draft",
        override: eligibility === "override",
        overrideReason:
          eligibility === "override" ? data.overrideReason.trim() : "",
        source: "manual",
        notes: data.notes,
        updatedAt: now,
      });
    } else {
      await addAssignment({
        academicYear: data.block.academicYear,
        blockId: data.block.id,
        blockNumber: data.block.blockNumber,
        residentId: data.resident.id,
        residentName: data.resident.displayName,
        rotationId: rotation.id,
        rotationName: rotation.name,
        slotKey,
        status: "draft",
        override: eligibility === "override",
        overrideReason:
          eligibility === "override" ? data.overrideReason.trim() : "",
        source: "manual",
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
      });
    }

    setEditingCell(null);
  }

  async function handleImportFile(file: File) {
    const rows = await parseBlockScheduleWorkbook({
      file,
      blocks: displayedBlocks,
      residents,
      rotations: activeRotations,
      existingAssignments: draftAssignments,
    });

    setImportFileName(file.name);
    setImportRows(rows);
    setReplaceDifferent(false);
  }

  async function applyImport() {
    const accepted = importRows.filter((row) => {
      if (!row.resident || !row.block || !row.rotation) return false;
      if (row.action === "review" || row.action === "same") return false;
      if (row.action === "replace" && !replaceDifferent) return false;
      return true;
    });

    const staged = [...draftAssignments];
    const upserts: BlockAssignmentUpsert[] = [];
    const now = new Date().toISOString();

    for (const row of accepted) {
      const resident = row.resident!;
      const block = row.block!;
      const rotation = row.rotation!;
      const eligibility = getRotationEligibility(resident, rotation);
      const sameRotationAssignments = staged.filter(
        (assignment) =>
          assignment.blockId === block.id &&
          assignment.rotationId === rotation.id &&
          assignment.id !== row.existingAssignment?.id
      );

      const slotKey = chooseSlotKeyForAssignment({
        rotation,
        resident,
        existingAssignments: sameRotationAssignments,
        residents,
        includeOverride: eligibility === "override",
      });

      const assignment: Omit<BlockAssignment, "id"> = {
        academicYear: block.academicYear,
        blockId: block.id,
        blockNumber: block.blockNumber,
        residentId: resident.id,
        residentName: resident.displayName,
        rotationId: rotation.id,
        rotationName: rotation.name,
        slotKey,
        status: "draft",
        override: eligibility === "override",
        overrideReason:
          eligibility === "override"
            ? `Imported coverage/override from ${importFileName}`
            : "",
        source: "excel-import",
        importedFileName: importFileName,
        importedAt: now,
        notes:
          row.sourceRotation.trim() === rotation.name
            ? ""
            : `Imported value: ${row.sourceRotation}`,
        createdAt: row.existingAssignment?.createdAt || now,
        updatedAt: now,
      };

      upserts.push({
        existingId: row.existingAssignment?.id,
        assignment,
      });

      if (row.existingAssignment) {
        const index = staged.findIndex(
          (item) => item.id === row.existingAssignment?.id
        );
        if (index >= 0) staged[index] = { id: row.existingAssignment.id, ...assignment };
      } else {
        staged.push({ id: `preview-${upserts.length}`, ...assignment });
      }
    }

    await importAssignments(upserts);
    setImportRows([]);
    setMessage(`Imported ${upserts.length} block assignment${upserts.length === 1 ? "" : "s"} as draft.`);
  }

  async function handlePublish() {
    if (!allowBuild) return;
    if (!window.confirm(`Publish the ${academicYear} block schedule? Residents will see this snapshot.`)) return;
    const version = await publishYear(academicYear, draftAssignments);
    await publishActiveChiefs(academicYear, version);
    try {
      await publishPublicWhoOnAcademicYear(academicYear);
    } catch (publicError) {
      console.warn("Block schedule published, but the public Who's On snapshots could not be refreshed.", publicError);
    }
    setBuilderView("published");
    setMessage(`Published block schedule version ${version}.`);
  }

  async function handleRestore() {
    const version = Number(restoreVersionNumber);
    if (!version) return;
    if (!window.confirm(`Restore version ${version} by publishing it as a new version?`)) return;
    const newVersion = await restoreVersion(academicYear, version);
    await restoreActiveChiefs(academicYear, version, newVersion);
    try {
      await publishPublicWhoOnAcademicYear(academicYear);
    } catch (publicError) {
      console.warn("Block schedule restored, but the public Who's On snapshots could not be refreshed.", publicError);
    }
    setRestoreOpen(false);
    setRestoreVersionNumber("");
    setBuilderView("published");
    setMessage(`Version ${version} restored as new published version ${newVersion}.`);
  }

  function exportSchedule() {
    const blockById = new Map(displayedBlocks.map((block) => [block.id, block]));
    const rows = visibleAssignments
      .slice()
      .sort((a, b) => a.blockNumber - b.blockNumber || a.residentName.localeCompare(b.residentName))
      .map((assignment) => {
        const block = blockById.get(assignment.blockId);
        return {
          Resident: assignment.residentName,
          PGY: residents.find((resident) => resident.id === assignment.residentId)?.pgy || "",
          Block: assignment.blockNumber,
          Start: block?.startDate || "",
          End: block?.endDate || "",
          Rotation: assignment.rotationName,
          Override: assignment.override ? "Yes" : "No",
          Notes: assignment.notes || assignment.overrideReason || "",
        };
      });

    for (const block of displayedBlocks) {
      const activeChief = visibleActiveChief(block);
      if (!activeChief) continue;
      rows.push({
        Resident: activeChief.residentName,
        PGY: "PGY-3",
        Block: block.blockNumber,
        Start: block.startDate,
        End: block.endDate,
        Rotation: "Active Chief (additional responsibility)",
        Override: "No",
        Notes: "Does not replace the resident's block rotation.",
      });
    }

    downloadCsv(
      `whoson-${academicYear}-${allowBuild ? builderView : "published"}-blocks.csv`,
      rows
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "none", minWidth: 0 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
        className="no-print"
      >
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 21, md: 25 }, lineHeight: 1.05 }}>
            Block Schedule
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            {allowBuild
              ? "Central rotation eligibility, staffing validation, publication, and Excel import."
              : "Published resident rotation schedule."}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} sx={{ textTransform: "none", fontWeight: 800 }}>
            Print/PDF
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportSchedule} sx={{ textTransform: "none", fontWeight: 800 }}>
            CSV
          </Button>
          {allowBuild && (
            <>
              <input
                ref={fileInputRef}
                hidden
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportFile(file);
                  event.currentTarget.value = "";
                }}
              />
              <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()} sx={{ textTransform: "none", fontWeight: 800 }}>
                Import Excel
              </Button>
              <Button variant="contained" startIcon={<PublishIcon />} onClick={handlePublish} disabled={draftAssignments.length === 0 || saving} sx={{ textTransform: "none", fontWeight: 850 }}>
                Publish
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {message && <Alert severity="success" sx={compactAlertSx}>{message}</Alert>}
      {pageError && <Alert severity="error" sx={compactAlertSx}>{pageError}</Alert>}
      {!allowBuild && publishedAssignments.length === 0 && (
        <Alert severity="info" sx={compactAlertSx}>No published block schedule is available yet.</Alert>
      )}

      <Card sx={{ mb: 1.5, borderRadius: 2 }} className="no-print">
        <CardContent sx={{ p: 1.25 }}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "stretch", lg: "center" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField size="small" label="Academic year" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} sx={{ width: { xs: "100%", sm: 160 } }} />
              <TextField size="small" label="Search resident" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ width: { xs: "100%", sm: 240 } }} />
              {allowBuild && (
                <TextField select size="small" label="View" value={builderView} onChange={(event) => setBuilderView(event.target.value as BuilderView)} sx={{ width: { xs: "100%", sm: 155 } }}>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                </TextField>
              )}
            </Stack>

            {allowBuild && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                <Chip label={`${validationSummary.complete}/${validations.length} complete`} size="small" sx={summaryChip("#15803d", "#ecfdf5", "#bbf7d0")} />
                <Chip label={`${validationSummary.average}% assigned`} size="small" sx={summaryChip("#2563eb", "#eff6ff", "#bfdbfe")} />
                <Chip label={`${validationSummary.totalIssues} issues`} size="small" sx={summaryChip(validationSummary.totalIssues ? "#be123c" : "#15803d", validationSummary.totalIssues ? "#fff1f2" : "#ecfdf5", validationSummary.totalIssues ? "#fecdd3" : "#bbf7d0")} />
                {versions.length > 0 && (
                  <Button size="small" startIcon={<RestoreIcon />} onClick={() => setRestoreOpen(true)} sx={{ textTransform: "none" }}>
                    Versions
                  </Button>
                )}
              </Stack>
            )}
          </Stack>

          {allowBuild && (
            <Box sx={{ overflowX: "auto", mt: 1 }}>
              <Stack direction="row" spacing={0.6} sx={{ minWidth: "max-content" }}>
                {validations.map((validation) => (
                  <ValidationCard key={validation.block.id} validation={validation} />
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 1.5, borderRadius: 2 }} className="no-print">
        <CardContent sx={{ p: 0.5 }}>
          <Tabs value={tab} onChange={(_, value: BlockTab) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 38, "& .MuiTab-root": { minHeight: 38, py: 0.75, fontWeight: 850 } }}>
            <Tab label="Everyone" value="Everyone" />
            <Tab label="PGY1" value="PGY-1" />
            <Tab label="PGY2" value="PGY-2" />
            <Tab label="PGY3" value="PGY-3" />
          </Tabs>
        </CardContent>
      </Card>

      <Card sx={{ mb: 1.5, borderRadius: 3, overflow: "hidden" }}>
        <CardContent sx={{ p: { xs: 0.75, md: 1.25 } }}>
          {pageLoading ? (
            <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress /><Typography sx={{ mt: 1 }} color="text.secondary">Loading block schedule...</Typography></Stack>
          ) : displayedBlocks.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>No academic blocks found.</Typography>
          ) : (
            <Box sx={{ overflow: "auto", maxHeight: "calc(100vh - 285px)", border: "1px solid", borderColor: "divider", borderRadius: 2 }} className="print-area">
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: `minmax(120px,max-content) repeat(${displayedBlocks.length},minmax(86px,max-content))`, md: `180px repeat(${displayedBlocks.length},minmax(108px,1fr))` }, minWidth: { xs: "max-content", md: 180 + displayedBlocks.length * 108 }, width: { xs: "max-content", md: "100%" } }}>
                <Box sx={topLeftCell}>Resident</Box>
                {displayedBlocks.map((block) => (
                  <Box key={block.id} sx={headerCell}>
                    <Typography fontWeight={900} fontSize={{ xs: 10.5, md: 11.5 }}>{block.name.replace("Block ", "B")}</Typography>
                    <Typography fontSize={{ xs: 9.5, md: 10.5 }}>{formatShortDate(block.startDate)}→{formatShortDate(block.endDate)}</Typography>
                  </Box>
                ))}

                <Box sx={{ display: "contents" }}>
                  <Box sx={{ ...residentCell, backgroundColor: "#fff7ed" }}>
                    <Typography fontWeight={900} fontSize={12}>
                      Active Chief
                    </Typography>
                    <Typography fontSize={10} color="text.secondary">
                      Additional block role
                    </Typography>
                  </Box>

                  {displayedBlocks.map((block) => {
                    const activeChief = visibleActiveChief(block);
                    return (
                      <Box
                        key={`active-chief-${block.id}`}
                        sx={{
                          ...matrixCell,
                          cursor:
                            allowBuild && builderView === "draft"
                              ? "pointer"
                              : "default",
                          backgroundColor: activeChief ? "#fff7ed" : "#fffbeb",
                          borderColor: "#fed7aa",
                        }}
                        onClick={() => {
                          if (!allowBuild || builderView !== "draft") return;
                          setEditingChiefBlock(block);
                        }}
                      >
                        <Typography
                          fontWeight={850}
                          fontSize={{ xs: 10.5, md: 11.5 }}
                          color={activeChief ? "#c2410c" : "text.secondary"}
                          noWrap
                        >
                          {activeChief?.residentName ||
                            (allowBuild && builderView === "draft"
                              ? "Assign chief"
                              : "—")}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>

                {activeResidents.map((resident) => (
                  <Box key={resident.id} sx={{ display: "contents" }}>
                    <Box sx={residentCell}>
                      <Button variant="text" onClick={() => onOpenResidentProfile?.(resident.id)} sx={{ p: 0, minWidth: 0, maxWidth: "100%", justifyContent: "flex-start", textTransform: "none", color: "#0f172a", fontWeight: 850, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {resident.displayName}
                      </Button>
                      <Typography fontSize={10.5} color="text.secondary">{resident.pgy}</Typography>
                    </Box>

                    {displayedBlocks.map((block) => {
                      const assignment = assignmentsByResidentBlock.get(`${resident.id}_${block.id}`);
                      const color = assignment ? rotationColor(assignment.rotationName) : undefined;
                      return (
                        <Box key={`${resident.id}-${block.id}`} sx={{ ...matrixCell, cursor: allowBuild && builderView === "draft" ? "pointer" : "default", backgroundColor: assignment ? color?.bg : "white", borderColor: assignment ? color?.border : "divider" }} onClick={() => {
                          if (!allowBuild || builderView !== "draft") return;
                          setEditingCell({ resident, block, assignment });
                        }}>
                          {assignment ? (
                            <Stack spacing={0.1} sx={{ minWidth: 0 }}>
                              <Typography fontWeight={850} fontSize={{ xs: 10.5, md: 11.5 }} sx={{ color: color?.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {assignment.rotationName}{allowBuild && assignment.override ? " ⚠" : ""}
                              </Typography>
                              {assignment.notes && <Typography fontSize={9.5} color="text.secondary" noWrap>{assignment.notes}</Typography>}
                              {allowBuild && builderView === "draft" && (
                                <Button size="small" color="error" onClick={(event) => { event.stopPropagation(); void removeAssignment(assignment.id); }} sx={{ minWidth: 0, width: "fit-content", p: "0 3px", fontSize: 9.5, textTransform: "none" }}>
                                  Clear
                                </Button>
                              )}
                            </Stack>
                          ) : (
                            <Typography fontSize={10.5} color="text.secondary">{allowBuild && builderView === "draft" ? "Assign" : "—"}</Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          {(saving || blocksSaving) && <Typography fontSize={12} color="text.secondary" sx={{ mt: 1 }}>Saving...</Typography>}
        </CardContent>
      </Card>

      {allowBuild && (
      <Card sx={{ mb: 1.5, borderRadius: 2 }}>
        <CardContent sx={{ p: 1.1, "&:last-child": { pb: 1.1 } }}>
          <Button
            fullWidth
            onClick={() => setShowResidentCounts((value) => !value)}
            endIcon={showResidentCounts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{
              justifyContent: "space-between",
              px: 0.5,
              minHeight: 30,
              color: "#0f172a",
              fontWeight: 900,
            }}
          >
            Resident Block Counts
          </Button>
          <Collapse in={showResidentCounts} unmountOnExit>
            <Stack spacing={0.45} sx={{ mt: 0.75 }}>
              {activeResidents.map((resident) => (
                <Box
                  key={resident.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "180px 1fr" },
                    gap: 0.75,
                    py: 0.5,
                    borderBottom: "1px solid #eef2f7",
                  }}
                >
                  <Box>
                    <Typography fontWeight={850} fontSize={12.5}>
                      {resident.displayName}
                    </Typography>
                    <Typography fontSize={10} color="text.secondary">
                      {resident.pgy}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                    {Object.entries(rotationCounts[resident.id] || {})
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([rotationName, count]) => {
                        const color = rotationColor(rotationName);
                        return (
                          <Chip
                            key={rotationName}
                            label={`${rotationName}: ${count}`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 10,
                              fontWeight: 800,
                              color: color.color,
                              backgroundColor: color.bg,
                              border: `1px solid ${color.border}`,
                            }}
                          />
                        );
                      })}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Collapse>
        </CardContent>
      </Card>

      )}

      {allowBuild && (
        <Card sx={{ mb: 1.5, borderRadius: 2 }} className="no-print">
          <CardContent sx={{ p: 1.5 }}>
            <Typography fontWeight={900} sx={{ mb: 1 }}>Academic Year Setup</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField size="small" label="Academic Year" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} sx={{ width: { xs: "100%", md: 170 } }} />
              <TextField size="small" type="date" label="First Block End Date" value={firstBlockEndDate} onChange={(event) => setFirstBlockEndDate(event.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: { xs: "100%", md: 190 } }} />
              <Button variant="contained" onClick={handleSaveBlocks} disabled={previewBlocks.length === 0} sx={{ textTransform: "none" }}>Save Academic Blocks</Button>
              <Button variant="outlined" onClick={handleSeedRotations} sx={{ textTransform: "none" }}>Seed / Update Rotations</Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {allowBuild && (
      <Card sx={{ borderRadius: 2 }} className="no-print">
        <CardContent sx={{ p: 1.5 }}>
          <Typography fontWeight={900}>2026 Hospital-Observed Holidays</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {CONFIRMED_2026_HOSPITAL_HOLIDAYS.map((holiday) => (
              <Chip key={holiday.date} label={`${holiday.date}: ${holiday.name}`} size="small" />
            ))}
          </Stack>
          {holidayYearNeedsConfirmation(Number(academicYear.slice(0, 4))) && (
            <Alert severity="warning" sx={{ mt: 1 }}>Holiday dates must be confirmed for this year before final publication.</Alert>
          )}
        </CardContent>
      </Card>
      )}

      {editingCell && (
        <BlockAssignmentDialog
          open
          resident={editingCell.resident}
          block={editingCell.block}
          rotations={activeRotations}
          existingAssignment={editingCell.assignment}
          onCancel={() => setEditingCell(null)}
          onSave={handleSaveAssignment}
        />
      )}

      {editingChiefBlock && allowBuild && (
        <ActiveChiefDialog
          block={editingChiefBlock}
          chiefs={chiefResidents}
          currentResidentId={
            editingChiefBlock.activeChiefDraft?.residentId || ""
          }
          onCancel={() => setEditingChiefBlock(null)}
          onSave={handleSaveActiveChief}
        />
      )}

      <BlockImportDialog
        open={importRows.length > 0}
        rows={importRows}
        fileName={importFileName}
        replaceDifferent={replaceDifferent}
        onReplaceDifferent={setReplaceDifferent}
        onCancel={() => setImportRows([])}
        onApply={applyImport}
      />

      <Dialog open={restoreOpen} onClose={() => setRestoreOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Restore Published Version</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="Version" value={restoreVersionNumber} onChange={(event) => setRestoreVersionNumber(event.target.value)} sx={{ mt: 1 }}>
            {versions.map((version) => (
              <MenuItem key={version.version} value={String(version.version)}>
                Version {version.version} — {version.status} — {version.count} assignments
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions><Button onClick={() => setRestoreOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleRestore} disabled={!restoreVersionNumber}>Restore as New Version</Button></DialogActions>
      </Dialog>

      <style>{`@media print {.no-print,.MuiAppBar-root,.MuiDrawer-root{display:none!important}.print-area{overflow:visible!important;max-height:none!important}main{padding:0!important}}`}</style>
    </Box>
  );
}

function BlockAssignmentDialog({
  open,
  resident,
  block,
  rotations,
  existingAssignment,
  onCancel,
  onSave,
}: {
  open: boolean;
  resident: Resident;
  block: AcademicBlock;
  rotations: RotationRequirement[];
  existingAssignment?: BlockAssignment;
  onCancel: () => void;
  onSave: (data: {
    resident: Resident;
    block: AcademicBlock;
    rotationId: string;
    notes: string;
    overrideReason: string;
    existingAssignment?: BlockAssignment;
  }) => Promise<void>;
}) {
  const [showOverrides, setShowOverrides] = useState(Boolean(existingAssignment?.override));
  const [rotationId, setRotationId] = useState(existingAssignment?.rotationId || "");
  const [notes, setNotes] = useState(existingAssignment?.notes || "");
  const [overrideReason, setOverrideReason] = useState(existingAssignment?.overrideReason || "");

  const eligible = rotations.filter((rotation) => {
    const mode = getRotationEligibility(resident, rotation);
    if (mode === "normal") return true;
    if (mode === "override") return showOverrides;
    return rotation.id === existingAssignment?.rotationId;
  });

  const selected = rotations.find((rotation) => rotation.id === rotationId);
  const eligibility: RotationEligibilityMode = selected
    ? getRotationEligibility(resident, selected)
    : "not-allowed";
  const saveDisabled =
    !rotationId ||
    eligibility === "not-allowed" ||
    (eligibility === "override" && !overrideReason.trim());

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{resident.displayName} — {block.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Resident" value={`${resident.displayName} — ${resident.pgy}`} disabled />
          <TextField label="Block" value={`${block.name}: ${block.startDate} → ${block.endDate}`} disabled />
          <TextField select label="Rotation" value={rotationId} onChange={(event) => setRotationId(event.target.value)} fullWidth>
            {eligible.map((rotation) => {
              const mode = getRotationEligibility(resident, rotation);
              return <MenuItem key={rotation.id} value={rotation.id}>{rotation.name}{mode === "override" ? " — coverage override" : ""}</MenuItem>;
            })}
          </TextField>
          <Button variant={showOverrides ? "contained" : "outlined"} onClick={() => setShowOverrides((value) => !value)} sx={{ alignSelf: "flex-start", textTransform: "none" }}>
            {showOverrides ? "Coverage overrides visible" : "Show approved coverage overrides"}
          </Button>
          {eligibility === "override" && (
            <Alert severity="warning">This is an approved coverage exception, not normal rotation eligibility.</Alert>
          )}
          {eligibility === "override" && (
            <TextField
              required
              label="Override / coverage reason"
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Example: PGY2 unavailable; PGY3 covering 2NC"
              helperText={
                selected?.id === "2n" && resident.pgy === "PGY-3"
                  ? "PGY-3 will be saved in the 2NC senior coverage slot."
                  : "Required for approved PGY coverage exceptions."
              }
              fullWidth
            />
          )}
          {eligibility === "not-allowed" && rotationId && (
            <Alert severity="error">This PGY level is not permitted for the selected rotation.</Alert>
          )}
          <TextField label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={3} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onCancel}>Cancel</Button><Button variant="contained" disabled={saveDisabled} onClick={() => onSave({ resident, block, rotationId, notes, overrideReason, existingAssignment })}>Save Draft</Button></DialogActions>
    </Dialog>
  );
}

function ActiveChiefDialog({
  block,
  chiefs,
  currentResidentId,
  onCancel,
  onSave,
}: {
  block: AcademicBlock;
  chiefs: Resident[];
  currentResidentId: string;
  onCancel: () => void;
  onSave: (residentId: string) => Promise<void>;
}) {
  const [residentId, setResidentId] = useState(currentResidentId);

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Active Chief — {block.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            Active Chief is an additional responsibility for the whole block.
            It does not replace or limit the chief resident&apos;s floor, clinic,
            consult, elective, ICU, Night Float, Jeopardy, Vacation, or other
            eligible rotation.
          </Alert>
          <TextField
            select
            fullWidth
            label="Active Chief"
            value={residentId}
            onChange={(event) => setResidentId(event.target.value)}
            helperText="Choose one of the four Chief Residents. Chief On Call remains a separate daily PGY3 role."
          >
            <MenuItem value="">Unassigned</MenuItem>
            {chiefs.map((chief) => (
              <MenuItem key={chief.id} value={chief.id}>
                {chief.displayName}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(residentId)}>
          Save Active Chief
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BlockImportDialog({
  open,
  rows,
  fileName,
  replaceDifferent,
  onReplaceDifferent,
  onCancel,
  onApply,
}: {
  open: boolean;
  rows: BlockImportPreviewRow[];
  fileName: string;
  replaceDifferent: boolean;
  onReplaceDifferent: (value: boolean) => void;
  onCancel: () => void;
  onApply: () => Promise<void>;
}) {
  const counts = rows.reduce<Record<string, number>>((result, row) => {
    result[row.action] = (result[row.action] || 0) + 1;
    return result;
  }, {});

  const applyCount =
    (counts.new || 0) +
    (counts.override || 0) +
    (replaceDifferent ? counts.replace || 0 : 0);

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="lg">
      <DialogTitle>Block Excel Import Preview</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" fontSize={13} sx={{ mb: 1 }}>{fileName}</Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          {Object.entries(counts).map(([action, count]) => <Chip key={action} label={`${action}: ${count}`} size="small" />)}
        </Stack>
        {(counts.replace || 0) > 0 && (
          <FormControlLabel control={<Checkbox checked={replaceDifferent} onChange={(event) => onReplaceDifferent(event.target.checked)} />} label={`Replace ${counts.replace} different existing assignment${counts.replace === 1 ? "" : "s"}`} />
        )}
        <Box sx={{ maxHeight: 430, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          {rows.slice(0, 500).map((row, index) => (
            <Box key={`${row.rowNumber}-${row.sourceBlock}-${index}`} sx={{ display: "grid", gridTemplateColumns: "1.2fr .7fr 1fr .65fr 1.8fr", gap: 1, p: 0.75, borderBottom: "1px solid #eef2f7", fontSize: 12 }}>
              <Typography fontSize={12} fontWeight={800}>{row.sourceResident}</Typography>
              <Typography fontSize={12}>{row.sourceBlock}</Typography>
              <Typography fontSize={12}>{row.sourceRotation}</Typography>
              <Chip label={row.action} size="small" sx={{ width: "fit-content", height: 20, fontSize: 10 }} />
              <Typography fontSize={11.5} color={row.action === "review" ? "error" : "text.secondary"}>{row.message}</Typography>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={onCancel}>Cancel</Button><Button variant="contained" onClick={onApply} disabled={applyCount === 0}>Import {applyCount} as Draft</Button></DialogActions>
    </Dialog>
  );
}

function ValidationCard({ validation }: { validation: BlockValidation }) {
  const critical = validation.issues.filter((issue) => issue.severity === "critical").length;
  const warnings = validation.issues.filter((issue) => issue.severity === "warning").length;
  const color = critical ? { bg: "#fff1f2", border: "#fecdd3", text: "#be123c" } : warnings ? { bg: "#fffbeb", border: "#fde68a", text: "#b45309" } : { bg: "#ecfdf5", border: "#bbf7d0", text: "#15803d" };

  return (
    <Box sx={{ width: 220, minHeight: 115, p: 1, borderRadius: 2, backgroundColor: color.bg, border: `1px solid ${color.border}` }}>
      <Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={950} fontSize={12.5} sx={{ color: color.text }}>{validation.block.name.replace("Block ", "B")}</Typography><Typography fontSize={10.5} color="text.secondary">{validation.assignedResidents}/{validation.totalResidents} assigned</Typography></Box><Chip label={`${validation.completionPercent}%`} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 900 }} /></Stack>
      <Stack spacing={0.2} sx={{ mt: 0.5 }}>
        {validation.issues.length === 0 ? <Typography fontSize={11} fontWeight={800} sx={{ color: "#15803d" }}>✓ No issues</Typography> : validation.issues.slice(0, 3).map((issue) => <Typography key={issue.id} fontSize={10.5} noWrap sx={{ color: issue.severity === "critical" ? "#be123c" : "#b45309" }}>⚠ {issue.message}</Typography>)}
        {validation.issues.length > 3 && <Typography fontSize={10.5} color="text.secondary">+{validation.issues.length - 3} more</Typography>}
      </Stack>
    </Box>
  );
}

const compactAlertSx = { mb: 1.5, borderRadius: 2, py: 0.4 };
function summaryChip(color: string, backgroundColor: string, borderColor: string) { return { height: 22, fontSize: 10.5, fontWeight: 900, color, backgroundColor, border: `1px solid ${borderColor}` }; }
const topLeftCell = { p: 0.65, fontWeight: 900, fontSize: 12, backgroundColor: "#e2e8f0", borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", position: "sticky", top: 0, left: 0, zIndex: 5 };
const headerCell = { p: 0.55, backgroundColor: "#e2e8f0", borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", position: "sticky", top: 0, zIndex: 3, textAlign: "center" };
const residentCell = { p: 0.6, backgroundColor: "#f8fafc", borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", position: "sticky", left: 0, zIndex: 2, minWidth: 0 };
const matrixCell = { minHeight: 50, p: 0.55, borderRight: "1px solid", borderBottom: "1px solid", borderColor: "divider", minWidth: 0 };
