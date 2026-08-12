import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";

import { useAuth } from "../context/AuthContext";
import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useResidents } from "../hooks/useResidents";
import { useRotations } from "../hooks/useRotations";
import type { AcademicBlock } from "../types/block";
import type { BlockAssignment } from "../types/blockAssignment";
import type { Resident } from "../types/resident";
import type { RotationRequirement } from "../types/rotation";
import { generateAcademicBlocks } from "../utils/academicBlocks";
import { canBuildSchedule } from "../utils/permissions";

type BlockTab = "Everyone" | "PGY-1" | "PGY-2" | "PGY-3" | "Statistics";

function getDefaultAcademicYear() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

export default function BlockSchedulePage() {
  const { profile } = useAuth();
  const allowBuild = canBuildSchedule(profile?.role);

  const { blocks, loading, error, saveBlocks } = useAcademicBlocks();
  const { residents } = useResidents();

  const {
    rotations,
    loading: rotationsLoading,
    error: rotationsError,
    seedRotations,
  } = useRotations();

  const {
    assignments,
    loading: assignmentsLoading,
    error: assignmentsError,
    addAssignment,
    saveAssignment,
    removeAssignment,
  } = useBlockAssignments();

  const [tab, setTab] = useState<BlockTab>("Everyone");
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());
  const [firstBlockEndDate, setFirstBlockEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingCell, setEditingCell] = useState<{
    resident: Resident;
    block: AcademicBlock;
    assignment?: BlockAssignment;
  } | null>(null);

  const previewBlocks = useMemo(() => {
    if (!academicYear || !firstBlockEndDate) return [];
    return generateAcademicBlocks({ academicYear, firstBlockEndDate });
  }, [academicYear, firstBlockEndDate]);

  const displayedBlocks = useMemo(() => {
    const source = previewBlocks.length > 0 ? previewBlocks : blocks;
    return source.filter((block) => block.academicYear === academicYear);
  }, [previewBlocks, blocks, academicYear]);

  const activeResidents = useMemo(() => {
    return residents
      .filter((resident) => resident.active)
      .filter((resident) => {
        if (tab === "Everyone") return true;
        if (tab === "Statistics") return true;
        return resident.pgy === tab;
      })
      .sort((a, b) => {
        const pgyOrder = a.pgy.localeCompare(b.pgy);
        if (pgyOrder !== 0) return pgyOrder;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [residents, tab]);

  const activeRotations = useMemo(
    () =>
      rotations
        .filter((rotation) => rotation.active)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [rotations]
  );

  const assignmentsByResidentBlock = useMemo(() => {
    const grouped: Record<string, BlockAssignment> = {};

    for (const assignment of assignments) {
      grouped[`${assignment.residentId}_${assignment.blockId}`] = assignment;
    }

    return grouped;
  }, [assignments]);

  const rotationStats = useMemo(() => {
    const stats: Record<
      string,
      {
        residentName: string;
        pgy: string;
        totalBlocks: number;
        rotations: Record<string, number>;
      }
    > = {};

    for (const resident of residents.filter((item) => item.active)) {
      stats[resident.id] = {
        residentName: resident.displayName,
        pgy: resident.pgy,
        totalBlocks: 0,
        rotations: {},
      };
    }

    for (const assignment of assignments) {
      if (!stats[assignment.residentId]) continue;

      stats[assignment.residentId].totalBlocks += 1;
      stats[assignment.residentId].rotations[assignment.rotationName] =
        (stats[assignment.residentId].rotations[assignment.rotationName] || 0) +
        1;
    }

    return Object.values(stats).sort((a, b) => {
      const pgyOrder = a.pgy.localeCompare(b.pgy);
      if (pgyOrder !== 0) return pgyOrder;
      return a.residentName.localeCompare(b.residentName);
    });
  }, [assignments, residents]);

  async function handleSaveBlocks() {
    if (!allowBuild || previewBlocks.length === 0) return;

    setSaving(true);
    try {
      await saveBlocks(previewBlocks);
    } finally {
      setSaving(false);
    }
  }

  async function handleSeedRotations() {
    if (!allowBuild) return;

    setSaving(true);
    try {
      await seedRotations();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAssignment(data: {
    resident: Resident;
    block: AcademicBlock;
    rotationId: string;
    notes: string;
    existingAssignment?: BlockAssignment;
  }) {
    if (!allowBuild) return;

    const rotation = activeRotations.find((item) => item.id === data.rotationId);
    if (!rotation) return;

    const now = new Date().toISOString();

    setSaving(true);
    try {
      if (data.existingAssignment) {
        await saveAssignment({
          ...data.existingAssignment,
          rotationId: rotation.id,
          rotationName: rotation.name,
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
          notes: data.notes,
          createdAt: now,
          updatedAt: now,
        });
      }

      setEditingCell(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveAssignment(id: string) {
    if (!allowBuild) return;

    setSaving(true);
    try {
      await removeAssignment(id);
      setEditingCell(null);
    } finally {
      setSaving(false);
    }
  }

  const pageError = error || rotationsError || assignmentsError;
  const pageLoading = loading || rotationsLoading || assignmentsLoading;

  return (
    <Box>
      <Stack sx={{ mb: 2 }}>
        <Typography variant="h4" fontWeight={800}>
          Resident Block Schedule
        </Typography>
        <Typography color="text.secondary">
          Assign residents to rotations across academic blocks.
        </Typography>
      </Stack>

      {!allowBuild && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have view-only access. Chiefs, program coordinators, and admins can
          edit block assignments.
        </Alert>
      )}

      {pageError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {pageError}
        </Alert>
      )}

      {allowBuild && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight={800}>
                Academic Year Setup
              </Typography>

              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField
                  label="Academic Year"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2026-2027"
                  fullWidth
                />

                <TextField
                  label="First Block End Date"
                  type="date"
                  value={firstBlockEndDate}
                  onChange={(e) => setFirstBlockEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="Block 1 starts July 1. Next block starts Thursday. Last block ends June 30."
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  onClick={handleSaveBlocks}
                  disabled={previewBlocks.length === 0 || saving}
                >
                  Save Academic Blocks
                </Button>

                {activeRotations.length === 0 && (
                  <Button
                    variant="outlined"
                    onClick={handleSeedRotations}
                    disabled={saving}
                  >
                    Seed Rotations
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            Block Assignment Matrix
          </Typography>

          <Tabs
            value={tab}
            onChange={(_, value: BlockTab) => setTab(value)}
            sx={{ mb: 2 }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Everyone" value="Everyone" />
            <Tab label="PGY1" value="PGY-1" />
            <Tab label="PGY2" value="PGY-2" />
            <Tab label="PGY3" value="PGY-3" />
            <Tab label="Statistics" value="Statistics" />
          </Tabs>

          {pageLoading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress />
              <Typography color="text.secondary" sx={{ mt: 2 }}>
                Loading block schedule...
              </Typography>
            </Stack>
          ) : tab === "Statistics" ? (
            <BlockStatistics stats={rotationStats} />
          ) : displayedBlocks.length === 0 ? (
            <Typography color="text.secondary">
              No blocks found for this academic year.
            </Typography>
          ) : (
            <Box
              sx={{
                overflow: "auto",
                maxHeight: "calc(100vh - 210px)",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: `170px repeat(${displayedBlocks.length}, 130px)`,
                  minWidth: 170 + displayedBlocks.length * 130,
                }}
              >
                <Box sx={topLeftCell}>Resident</Box>

                {displayedBlocks.map((block) => (
                  <Box key={block.id} sx={headerCell}>
                    <Typography fontWeight={900} fontSize={12}>
                      {block.name}
                    </Typography>
                    <Typography variant="caption">
                      {block.startDate.slice(5)} → {block.endDate.slice(5)}
                    </Typography>
                  </Box>
                ))}

                {activeResidents.map((resident) => (
                  <Box key={resident.id} sx={{ display: "contents" }}>
                    <Box sx={residentCell}>
                      <Typography fontWeight={800} fontSize={12}>
                        {resident.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {resident.pgy}
                      </Typography>
                    </Box>

                    {displayedBlocks.map((block) => {
                      const assignment =
                        assignmentsByResidentBlock[
                          `${resident.id}_${block.id}`
                        ];

                      return (
                        <Box
                          key={`${resident.id}-${block.id}`}
                          sx={{
                            ...matrixCell,
                            cursor: allowBuild ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (!allowBuild) return;
                            setEditingCell({ resident, block, assignment });
                          }}
                        >
                          {assignment ? (
                            <Stack spacing={0.25}>
                              <Typography fontWeight={800} fontSize={12}>
                                {assignment.rotationName}
                              </Typography>

                              {assignment.notes && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {assignment.notes}
                                </Typography>
                              )}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {allowBuild ? "Assign" : "—"}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {saving && allowBuild && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Saving...
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            Rotation Requirements
          </Typography>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {activeRotations.map((rotation) => (
              <Chip
                key={rotation.id}
                label={`${rotation.name}: I ${rotation.requiredPGY1}, II ${rotation.requiredPGY2}, III ${rotation.requiredPGY3}, Sr ${rotation.requiredSenior}`}
                sx={{ height: 22 }}
              />
            ))}

            {activeRotations.length === 0 && (
              <Typography color="text.secondary">
                No rotations saved yet.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {editingCell && allowBuild && (
        <BlockAssignmentDialog
          open={Boolean(editingCell)}
          resident={editingCell.resident}
          block={editingCell.block}
          rotations={activeRotations}
          existingAssignment={editingCell.assignment}
          saving={saving}
          onCancel={() => setEditingCell(null)}
          onSave={handleSaveAssignment}
          onRemove={handleRemoveAssignment}
        />
      )}
    </Box>
  );
}

function BlockStatistics({
  stats,
}: {
  stats: {
    residentName: string;
    pgy: string;
    totalBlocks: number;
    rotations: Record<string, number>;
  }[];
}) {
  return (
    <Stack spacing={1}>
      <Alert severity="info">
        Basic rotation statistics are shown here. Later this will include
        weekend calls, holiday calls, night float, jeopardy, vacation, and
        average spacing.
      </Alert>

      {stats.map((item) => (
        <Box
          key={`${item.residentName}-${item.pgy}`}
          sx={{
            p: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            justifyContent="space-between"
          >
            <Box>
              <Typography fontWeight={900}>{item.residentName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {item.pgy} • {item.totalBlocks} assigned block(s)
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {Object.entries(item.rotations).map(([rotation, count]) => (
                <Chip
                  key={rotation}
                  label={`${rotation}: ${count}`}
                  size="small"
                />
              ))}

              {Object.keys(item.rotations).length === 0 && (
                <Chip label="No assignments" size="small" />
              )}
            </Stack>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function BlockAssignmentDialog({
  open,
  resident,
  block,
  rotations,
  existingAssignment,
  saving,
  onCancel,
  onSave,
  onRemove,
}: {
  open: boolean;
  resident: Resident;
  block: AcademicBlock;
  rotations: RotationRequirement[];
  existingAssignment?: BlockAssignment;
  saving: boolean;
  onCancel: () => void;
  onSave: (data: {
    resident: Resident;
    block: AcademicBlock;
    rotationId: string;
    notes: string;
    existingAssignment?: BlockAssignment;
  }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [selectedRotation, setSelectedRotation] =
    useState<RotationRequirement | null>(
      rotations.find((item) => item.id === existingAssignment?.rotationId) ||
        null
    );

  const [notes, setNotes] = useState(existingAssignment?.notes || "");

  async function handleSave() {
    if (!selectedRotation) return;

    await onSave({
      resident,
      block,
      rotationId: selectedRotation.id,
      notes,
      existingAssignment,
    });
  }

  async function handleRemove() {
    if (!existingAssignment) return;

    const confirmed = window.confirm(
      `Clear ${resident.displayName}'s assignment for ${block.name}?`
    );

    if (!confirmed) return;

    await onRemove(existingAssignment.id);
  }

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>
        {existingAssignment ? "Edit Assignment" : "Add Assignment"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              backgroundColor: "#f8fafc",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography fontWeight={900}>{resident.displayName}</Typography>
            <Typography variant="body2" color="text.secondary">
              {resident.pgy} • {block.name}: {block.startDate} →{" "}
              {block.endDate}
            </Typography>

            {existingAssignment && (
              <Typography variant="body2" sx={{ mt: 0.75 }}>
                Current: <b>{existingAssignment.rotationName}</b>
              </Typography>
            )}
          </Box>

          <Autocomplete
            options={rotations}
            value={selectedRotation}
            onChange={(_, value) => setSelectedRotation(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search and select rotation"
                placeholder="Start typing rotation name..."
                fullWidth
              />
            )}
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Box>
          {existingAssignment && (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleRemove}
              disabled={saving}
            >
              Clear
            </Button>
          )}
        </Box>

        <Stack direction="row" spacing={1}>
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!selectedRotation || saving}
          >
            Save
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

const topLeftCell = {
  p: 0.75,
  fontWeight: 900,
  backgroundColor: "#e2e8f0",
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  position: "sticky",
  top: 0,
  left: 0,
  zIndex: 5,
};

const headerCell = {
  p: 0.75,
  fontWeight: 900,
  backgroundColor: "#e2e8f0",
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  position: "sticky",
  top: 0,
  zIndex: 3,
};

const residentCell = {
  p: 0.75,
  backgroundColor: "#f8fafc",
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  position: "sticky",
  left: 0,
  zIndex: 2,
};

const matrixCell = {
  minHeight: 70,
  p: 0.75,
  borderRight: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
  backgroundColor: "white",
  "&:hover": {
    backgroundColor: "#f8fafc",
  },
};