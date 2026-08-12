import { useEffect, useState } from "react";
import type { BlockAssignment } from "../types/blockAssignment";
import {
  createBlockAssignment,
  deleteBlockAssignmentById,
  getBlockAssignments,
  peekBlockAssignments,
  publishBlockSchedule,
  restoreBlockScheduleVersion,
  updateBlockAssignment,
  upsertBlockAssignments,
  type BlockAssignmentUpsert,
} from "../services/blockAssignmentService";
import { shouldRefreshThisSession } from "../services/dataCache";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return `${fallback} ${error.message.replace(/^FirebaseError:\s*/i, "").trim()}`;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return `${fallback} ${message}`;
  }
  return fallback;
}

export function useBlockAssignments() {
  const cached = peekBlockAssignments();
  const [assignments, setAssignments] = useState<BlockAssignment[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadAssignments(showLoading = true, force = false) {
    try {
      if (showLoading) setLoading(true);
      setError("");
      setAssignments(await getBlockAssignments(force));
    } catch (err) {
      console.error(err);
      if (!assignments.length) setError(getErrorMessage(err, "Unable to load block assignments."));
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function addAssignment(assignment: Omit<BlockAssignment, "id">) {
    try {
      setSaving(true); setError("");
      const id = await createBlockAssignment(assignment);
      setAssignments((current) => [...current, { id, ...assignment }]);
    } catch (err) {
      console.error(err); setError(getErrorMessage(err, "Unable to add block assignment.")); throw err;
    } finally { setSaving(false); }
  }

  async function saveAssignment(assignment: BlockAssignment) {
    try {
      setSaving(true); setError("");
      await updateBlockAssignment(assignment);
      setAssignments((current) => current.map((item) => item.id === assignment.id ? assignment : item));
    } catch (err) {
      console.error(err); setError(getErrorMessage(err, "Unable to save block assignment.")); throw err;
    } finally { setSaving(false); }
  }

  async function removeAssignment(id: string) {
    try {
      setSaving(true); setError("");
      await deleteBlockAssignmentById(id);
      setAssignments((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err); setError(getErrorMessage(err, "Unable to delete block assignment.")); throw err;
    } finally { setSaving(false); }
  }

  async function importAssignments(items: BlockAssignmentUpsert[]) {
    try {
      setSaving(true); setError("");
      await upsertBlockAssignments(items);
      await loadAssignments(false, true);
    } catch (err) {
      console.error(err); setError(getErrorMessage(err, "Unable to import block assignments.")); throw err;
    } finally { setSaving(false); }
  }

  async function publishYear(academicYear: string, draftAssignments: BlockAssignment[]) {
    try {
      setSaving(true); setError("");
      const version = await publishBlockSchedule(academicYear, draftAssignments);
      await loadAssignments(false, true);
      return version;
    } catch (err) {
      console.error(err); setError(getErrorMessage(err, "Unable to publish block schedule.")); throw err;
    } finally { setSaving(false); }
  }

  async function restoreVersion(academicYear: string, version: number) {
    try {
      setSaving(true); setError("");
      const restoredVersion = await restoreBlockScheduleVersion(academicYear, version);
      await loadAssignments(false, true);
      return restoredVersion;
    } catch (err) {
      console.error(err); setError(getErrorMessage(err, "Unable to restore block schedule version.")); throw err;
    } finally { setSaving(false); }
  }

  useEffect(() => {
    const refresh = shouldRefreshThisSession("block-assignments");
    void loadAssignments(!cached, refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    assignments, loading, saving, error,
    reloadAssignments: () => loadAssignments(false, true),
    addAssignment, saveAssignment, removeAssignment, importAssignments, publishYear, restoreVersion,
  };
}
