import { useEffect, useState } from "react";
import type { AttendingScheduleAssignment } from "../types/attendingSchedule";
import {
  createAttendingScheduleAssignment,
  deleteAttendingScheduleAssignmentById,
  getAttendingScheduleAssignments,
  updateAttendingScheduleAssignment,
} from "../services/attendingScheduleService";

export function useAttendingSchedule() {
  const [assignments, setAssignments] = useState<AttendingScheduleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadAssignments(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      setError("");
      setAssignments(await getAttendingScheduleAssignments());
    } catch (err) {
      console.error(err);
      setError("Unable to load attending schedule.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function addAssignment(
    assignment: Omit<AttendingScheduleAssignment, "id">
  ) {
    try {
      setSaving(true);
      setError("");
      const id = await createAttendingScheduleAssignment(assignment);
      setAssignments((current) => [...current, { id, ...assignment }]);
    } catch (err) {
      console.error(err);
      setError("Unable to add attending schedule assignment.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignment(assignment: AttendingScheduleAssignment) {
    try {
      setSaving(true);
      setError("");
      await updateAttendingScheduleAssignment(assignment);
      setAssignments((current) =>
        current.map((item) => (item.id === assignment.id ? assignment : item))
      );
    } catch (err) {
      console.error(err);
      setError("Unable to save attending schedule assignment.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(id: string) {
    try {
      setSaving(true);
      setError("");
      await deleteAttendingScheduleAssignmentById(id);
      setAssignments((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      setError("Unable to delete attending schedule assignment.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadAssignments();
  }, []);

  return {
    assignments,
    loading,
    saving,
    error,
    reloadAssignments: () => loadAssignments(false),
    addAssignment,
    saveAssignment,
    removeAssignment,
  };
}
