import { useEffect, useState } from "react";
import type { AttendingScheduleAssignment } from "../types/attendingSchedule";
import {
  createAttendingScheduleAssignment,
  deleteAttendingScheduleAssignmentById,
  getAttendingScheduleAssignments,
  updateAttendingScheduleAssignment,
} from "../services/attendingScheduleService";

export function useAttendingSchedule() {
  const [assignments, setAssignments] = useState<
    AttendingScheduleAssignment[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAssignments() {
    try {
      setLoading(true);
      setError("");
      const data = await getAttendingScheduleAssignments();
      setAssignments(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load attending schedule.");
    } finally {
      setLoading(false);
    }
  }

  async function addAssignment(
    assignment: Omit<AttendingScheduleAssignment, "id">
  ) {
    try {
      setError("");
      await createAttendingScheduleAssignment(assignment);
      await loadAssignments();
    } catch (err) {
      console.error(err);
      setError("Unable to add attending schedule assignment.");
    }
  }

  async function saveAssignment(assignment: AttendingScheduleAssignment) {
    try {
      setError("");
      await updateAttendingScheduleAssignment(assignment);
      await loadAssignments();
    } catch (err) {
      console.error(err);
      setError("Unable to save attending schedule assignment.");
    }
  }

  async function removeAssignment(id: string) {
    try {
      setError("");
      await deleteAttendingScheduleAssignmentById(id);
      await loadAssignments();
    } catch (err) {
      console.error(err);
      setError("Unable to delete attending schedule assignment.");
    }
  }

  useEffect(() => {
    loadAssignments();
  }, []);

  return {
    assignments,
    loading,
    error,
    reloadAssignments: loadAssignments,
    addAssignment,
    saveAssignment,
    removeAssignment,
  };
}