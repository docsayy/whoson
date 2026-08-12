import { useEffect, useState } from "react";
import type { BlockAssignment } from "../types/blockAssignment";
import {
  createBlockAssignment,
  deleteBlockAssignmentById,
  getBlockAssignments,
  publishBlockSchedule,
  restoreBlockScheduleVersion,
  updateBlockAssignment,
  upsertBlockAssignments,
  type BlockAssignmentUpsert,
} from "../services/blockAssignmentService";

export function useBlockAssignments() {
  const [assignments, setAssignments] = useState<BlockAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadAssignments() {
    try {
      setLoading(true);
      setError("");
      const data = await getBlockAssignments();
      setAssignments(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load block assignments.");
    } finally {
      setLoading(false);
    }
  }

  async function runMutation(
    action: () => Promise<unknown>,
    failureMessage: string
  ) {
    try {
      setSaving(true);
      setError("");
      await action();
      await loadAssignments();
    } catch (err) {
      console.error(err);
      setError(failureMessage);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function addAssignment(assignment: Omit<BlockAssignment, "id">) {
    await runMutation(
      () => createBlockAssignment(assignment),
      "Unable to add block assignment."
    );
  }

  async function saveAssignment(assignment: BlockAssignment) {
    await runMutation(
      () => updateBlockAssignment(assignment),
      "Unable to save block assignment."
    );
  }

  async function removeAssignment(id: string) {
    await runMutation(
      () => deleteBlockAssignmentById(id),
      "Unable to delete block assignment."
    );
  }

  async function importAssignments(items: BlockAssignmentUpsert[]) {
    await runMutation(
      () => upsertBlockAssignments(items),
      "Unable to import block assignments."
    );
  }

  async function publishYear(
    academicYear: string,
    draftAssignments: BlockAssignment[]
  ) {
    let version = 0;
    await runMutation(async () => {
      version = await publishBlockSchedule(academicYear, draftAssignments);
    }, "Unable to publish block schedule.");
    return version;
  }

  async function restoreVersion(academicYear: string, version: number) {
    let restoredVersion = 0;
    await runMutation(async () => {
      restoredVersion = await restoreBlockScheduleVersion(academicYear, version);
    }, "Unable to restore block schedule version.");
    return restoredVersion;
  }

  useEffect(() => {
    loadAssignments();
  }, []);

  return {
    assignments,
    loading,
    saving,
    error,
    reloadAssignments: loadAssignments,
    addAssignment,
    saveAssignment,
    removeAssignment,
    importAssignments,
    publishYear,
    restoreVersion,
  };
}
