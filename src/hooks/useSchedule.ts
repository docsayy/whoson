import { useEffect, useState } from "react";
import type { ScheduleAssignment } from "../types/schedule";
import {
  createScheduleAssignment,
  deleteScheduleAssignmentById,
  getScheduleAssignments,
  updateScheduleAssignment,
} from "../services/scheduleService";

export function useSchedule() {
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSchedule() {
    try {
      setLoading(true);
      setError("");
      const data = await getScheduleAssignments();
      setAssignments(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load schedule.");
    } finally {
      setLoading(false);
    }
  }

  async function addAssignment(
    assignment: Omit<ScheduleAssignment, "id">
  ) {
    try {
      setError("");
      await createScheduleAssignment(assignment);
      await loadSchedule();
    } catch (err) {
      console.error(err);
      setError("Unable to add schedule assignment.");
    }
  }

  async function saveAssignment(assignment: ScheduleAssignment) {
    try {
      setError("");
      await updateScheduleAssignment(assignment);
      await loadSchedule();
    } catch (err) {
      console.error(err);
      setError("Unable to save schedule assignment.");
    }
  }

  async function removeAssignment(id: string) {
    try {
      setError("");
      await deleteScheduleAssignmentById(id);
      await loadSchedule();
    } catch (err) {
      console.error(err);
      setError("Unable to delete schedule assignment.");
    }
  }

  useEffect(() => {
    loadSchedule();
  }, []);

  return {
    assignments,
    loading,
    error,
    reloadSchedule: loadSchedule,
    addAssignment,
    saveAssignment,
    removeAssignment,
  };
}