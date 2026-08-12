import { useMemo, useState } from "react";
import {
  Alert,
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
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

import { findResidentCallService } from "../config/scheduleServices";
import { useAuth } from "../context/AuthContext";
import { useAcademicBlocks } from "../hooks/useAcademicBlocks";
import { useBlockAssignments } from "../hooks/useBlockAssignments";
import { useCallSwaps } from "../hooks/useCallSwaps";
import { useMonthlyScheduleRange } from "../hooks/useMonthlyScheduleRange";
import { useResidents } from "../hooks/useResidents";
import {
  acceptCallSwap,
  approveAndApplyCallSwap,
  cancelCallSwap,
  createCallSwapRequest,
  declineCallSwap,
  rejectCallSwap,
} from "../services/callSwapService";
import { getDraftAssignmentsForYear } from "../services/blockAssignmentService";
import type { CallSwapRequest, CallSwapStatus } from "../types/callSwap";
import type { MonthlyScheduleCell } from "../types/monthSchedule";
import { canBuildSchedule } from "../utils/permissions";
import { ruleIssueSummary, validateCallAssignment } from "../utils/scheduleRules";

function monthId(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayString() {
  const current = new Date();
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
}

function statusLabel(status: CallSwapStatus) {
  return {
    "pending-recipient": "Waiting for recipient",
    "pending-approval": "Waiting for approval",
    "approved-draft": "Approved in draft",
    declined: "Declined",
    rejected: "Not approved",
    cancelled: "Cancelled",
  }[status];
}

function statusColor(status: CallSwapStatus) {
  if (status === "approved-draft") return "success" as const;
  if (status === "pending-approval") return "warning" as const;
  if (status === "pending-recipient") return "info" as const;
  return "default" as const;
}

export default function CallSwapsPage() {
  const { user, profile } = useAuth();
  const manager = canBuildSchedule(profile?.role);
  const { residents } = useResidents();
  const { blocks } = useAcademicBlocks();
  const { assignments: allBlockAssignments } = useBlockAssignments();
  const { requests, loading, error } = useCallSwaps();
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");

  const requestMonths = requests.map((request) => request.date.slice(0, 7));
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const monthIds = useMemo(
    () =>
      Array.from(
        new Set([monthId(new Date()), monthId(nextMonth), ...requestMonths])
      ).sort(),
    [requests]
  );
  const { assignments: monthlyAssignments } = useMonthlyScheduleRange(monthIds);



  const visibleRequests = useMemo(() => {
    if (manager) return requests;
    if (!profile?.residentId) return [];
    return requests.filter(
      (request) =>
        request.requesterResidentId === profile.residentId ||
        request.targetResidentId === profile.residentId
    );
  }, [manager, profile?.residentId, requests]);

  const myUpcomingCalls = useMemo(() => {
    if (!profile?.residentId) return [];
    const today = todayString();
    return Object.values(monthlyAssignments)
      .filter(
        (cell) =>
          cell.residentId === profile.residentId && cell.date >= today
      )
      .sort((a, b) =>
        a.date === b.date
          ? a.serviceName.localeCompare(b.serviceName)
          : a.date.localeCompare(b.date)
      );
  }, [monthlyAssignments, profile?.residentId]);

  async function runAction(id: string, action: () => Promise<void>, success: string) {
    try {
      setBusyId(id);
      setActionError("");
      await action();
      setMessage(success);
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "Unable to update call swap.");
    } finally {
      setBusyId("");
    }
  }

  async function approve(request: CallSwapRequest) {
    const target = residents.find((resident) => resident.id === request.targetResidentId);
    const service = findResidentCallService(request.serviceId || request.serviceName);
    if (!target || !service || !user || !profile) {
      setActionError("Unable to resolve the resident or call service.");
      return;
    }

    const years = Array.from(
      new Set(
        blocks
          .filter((block) => request.date >= block.startDate && request.date <= block.endDate)
          .map((block) => block.academicYear)
      )
    );
    const blockAssignments = years.flatMap((year) =>
      getDraftAssignmentsForYear(allBlockAssignments, year)
    );
    const validation = validateCallAssignment({
      date: request.date,
      service,
      resident: target,
      existingAssignments: monthlyAssignments,
      blocks,
      blockAssignments,
      allowCoverageOverride: false,
    });

    const critical = validation.issues.filter((issue) => issue.severity === "critical");
    if (critical.length > 0) {
      setActionError(`Cannot approve: ${ruleIssueSummary(validation)}`);
      return;
    }

    const warningText = ruleIssueSummary(validation);
    if (
      validation.issues.some((issue) => issue.severity === "warning") &&
      !window.confirm(`${warningText}\n\nApprove this documented override?`)
    ) {
      return;
    }

    await runAction(
      request.id,
      () =>
        approveAndApplyCallSwap({
          request,
          targetResident: target,
          actor: { uid: user.uid, name: profile.displayName },
          note: warningText || "Rules validated.",
        }),
      "Swap approved and applied to the draft schedule. Publish the daily schedule when ready."
    );
  }

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 1180, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={900}>
            Call Swaps
          </Typography>
          <Typography color="text.secondary" fontSize={12.5}>
            Resident acceptance and chief/coordinator approval are required. Approved changes go to Draft and never publish automatically.
          </Typography>
        </Box>
        {profile?.residentId && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Request Swap
          </Button>
        )}
      </Stack>

      {message && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setMessage("")}>{message}</Alert>}
      {(error || actionError) && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setActionError("")}>{error || actionError}</Alert>}

      <Stack spacing={1}>
        {visibleRequests.length === 0 ? (
          <Card><CardContent><Typography color="text.secondary">No call-swap requests.</Typography></CardContent></Card>
        ) : (
          visibleRequests.map((request) => {
            const isRequester = request.requesterResidentId === profile?.residentId;
            const isTarget = request.targetResidentId === profile?.residentId;
            const busy = busyId === request.id;
            return (
              <Card key={request.id} sx={{ borderRadius: 2.5 }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                        <SwapHorizIcon fontSize="small" />
                        <Typography fontWeight={900}>{request.serviceName}</Typography>
                        <Chip size="small" label={request.date} />
                        <Chip size="small" color={statusColor(request.status)} label={statusLabel(request.status)} />
                      </Stack>
                      <Typography fontSize={12.5} sx={{ mt: 0.6 }}>
                        <b>{request.requesterName}</b> → <b>{request.targetName}</b>
                      </Typography>
                      {request.reason && <Typography fontSize={11.5} color="text.secondary" sx={{ mt: 0.35 }}>{request.reason}</Typography>}
                      <Typography fontSize={10.5} color="text.disabled" sx={{ mt: 0.35 }}>
                        Requested {new Date(request.createdAt).toLocaleString()}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap alignContent="flex-start">
                      {isTarget && request.status === "pending-recipient" && (
                        <>
                          <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />} disabled={busy} onClick={() => user && profile && void runAction(request.id, () => acceptCallSwap(request, { uid: user.uid, name: profile.displayName }), "Swap accepted and sent for approval.")}>Accept</Button>
                          <Button size="small" variant="outlined" color="error" startIcon={<CloseIcon />} disabled={busy} onClick={() => user && profile && void runAction(request.id, () => declineCallSwap(request, { uid: user.uid, name: profile.displayName }), "Swap declined.")}>Decline</Button>
                        </>
                      )}
                      {isRequester && ["pending-recipient", "pending-approval"].includes(request.status) && (
                        <Button size="small" variant="outlined" disabled={busy} onClick={() => user && profile && void runAction(request.id, () => cancelCallSwap(request, { uid: user.uid, name: profile.displayName }), "Swap request cancelled.")}>Cancel</Button>
                      )}
                      {manager && request.status === "pending-approval" && (
                        <>
                          <Button size="small" variant="contained" color="success" disabled={busy} onClick={() => void approve(request)}>Approve to Draft</Button>
                          <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => {
                            const note = window.prompt("Reason for declining approval:") || "Not approved.";
                            if (user && profile) void runAction(request.id, () => rejectCallSwap(request, { uid: user.uid, name: profile.displayName }, note), "Swap not approved.");
                          }}>Reject</Button>
                        </>
                      )}
                    </Stack>
                  </Stack>
                  {request.history?.length > 1 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Typography fontSize={10.75} color="text.secondary">
                        Latest: {request.history[request.history.length - 1].actorName} — {request.history[request.history.length - 1].note || statusLabel(request.status)}
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </Stack>

      {createOpen && profile?.residentId && user && (
        <CreateSwapDialog
          calls={myUpcomingCalls}
          residents={residents}
          requesterResidentId={profile.residentId}
          requesterUid={user.uid}
          requesterName={profile.displayName}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setMessage("Call-swap request sent.");
          }}
        />
      )}
    </Box>
  );
}

function CreateSwapDialog({
  calls,
  residents,
  requesterResidentId,
  requesterUid,
  requesterName,
  onClose,
  onCreated,
}: {
  calls: MonthlyScheduleCell[];
  residents: ReturnType<typeof useResidents>["residents"];
  requesterResidentId: string;
  requesterUid: string;
  requesterName: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [callKey, setCallKey] = useState("");
  const [targetResidentId, setTargetResidentId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const call = calls.find((item) => `${item.date}_${item.serviceId}` === callKey);
  const requester = residents.find((item) => item.id === requesterResidentId);
  const candidates = residents
    .filter(
      (resident) =>
        resident.active &&
        resident.id !== requesterResidentId &&
        (!requester || resident.pgy === requester.pgy)
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  async function submit() {
    const target = residents.find((item) => item.id === targetResidentId);
    if (!call || !target) return;
    try {
      setSaving(true);
      setError("");
      await createCallSwapRequest({
        date: call.date,
        serviceId: call.serviceId,
        serviceName: call.serviceName,
        requesterUid,
        requesterResidentId,
        requesterName,
        targetResidentId: target.id,
        targetName: target.displayName,
        reason: reason.trim(),
      });
      onCreated();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unable to create swap request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Request a Call Swap</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Your call" value={callKey} onChange={(event) => { setCallKey(event.target.value); setTargetResidentId(""); }} fullWidth>
            {calls.map((item) => (
              <MenuItem key={`${item.date}_${item.serviceId}`} value={`${item.date}_${item.serviceId}`}>
                {item.date} — {item.serviceName}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Resident who will cover" value={targetResidentId} onChange={(event) => setTargetResidentId(event.target.value)} fullWidth disabled={!call}>
            {candidates.map((resident) => (
              <MenuItem key={resident.id} value={resident.id}>
                {resident.displayName} — {resident.pgy}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Reason or note" value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={3} />
          <Alert severity="info">
            The recipient must accept, and a chief/coordinator must approve. Approval changes Draft only.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!call || !targetResidentId || saving} onClick={() => void submit()}>
          Send Request
        </Button>
      </DialogActions>
    </Dialog>
  );
}
