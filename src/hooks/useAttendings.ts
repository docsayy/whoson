import { useEffect, useState } from "react";
import type { Attending } from "../types/attending";
import {
  createAttending,
  deleteAttendingById,
  getAttendings,
  updateAttending,
} from "../services/attendingService";

function sortAttendings(items: Attending[]) {
  return items.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function useAttendings() {
  const [attendings, setAttendings] = useState<Attending[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadAttendings(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      setError("");
      setAttendings(await getAttendings());
    } catch (err) {
      console.error(err);
      setError("Unable to load attendings.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function addAttending(attending: Omit<Attending, "id">) {
    try {
      setSaving(true);
      setError("");
      const id = await createAttending(attending);
      setAttendings((current) =>
        sortAttendings([...current, { id, ...attending }])
      );
    } catch (err) {
      console.error(err);
      setError("Unable to add attending.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function saveAttending(attending: Attending) {
    try {
      setSaving(true);
      setError("");
      await updateAttending(attending);
      setAttendings((current) =>
        sortAttendings(current.map((item) => (item.id === attending.id ? attending : item)))
      );
    } catch (err) {
      console.error(err);
      setError("Unable to save attending.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function removeAttending(id: string) {
    try {
      setSaving(true);
      setError("");
      await deleteAttendingById(id);
      setAttendings((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      setError("Unable to delete attending.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadAttendings();
  }, []);

  return {
    attendings,
    loading,
    saving,
    error,
    reloadAttendings: () => loadAttendings(false),
    addAttending,
    saveAttending,
    removeAttending,
  };
}
