import { useEffect, useState } from "react";
import type { Attending } from "../types/attending";
import {
  createAttending,
  deleteAttendingById,
  getAttendings,
  updateAttending,
} from "../services/attendingService";

export function useAttendings() {
  const [attendings, setAttendings] = useState<Attending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAttendings() {
    try {
      setLoading(true);
      setError("");
      const data = await getAttendings();
      setAttendings(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load attendings.");
    } finally {
      setLoading(false);
    }
  }

  async function addAttending(attending: Omit<Attending, "id">) {
    await createAttending(attending);
    await loadAttendings();
  }

  async function saveAttending(attending: Attending) {
    await updateAttending(attending);
    await loadAttendings();
  }

  async function removeAttending(id: string) {
    await deleteAttendingById(id);
    await loadAttendings();
  }

  useEffect(() => {
    loadAttendings();
  }, []);

  return {
    attendings,
    loading,
    error,
    reloadAttendings: loadAttendings,
    addAttending,
    saveAttending,
    removeAttending,
  };
}