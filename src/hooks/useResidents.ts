import { useEffect, useState } from "react";
import type { Resident } from "../types/resident";
import {
  createResident,
  deleteResidentById,
  getResidents,
  updateResident,
} from "../services/residentService";

function sortResidents(items: Resident[]) {
  return items.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function useResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadResidents(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      setError("");
      setResidents(await getResidents());
    } catch (err) {
      console.error(err);
      setError("Unable to load residents.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function addResident(resident: Omit<Resident, "id">) {
    try {
      setSaving(true);
      setError("");
      const id = await createResident(resident);
      setResidents((current) => sortResidents([...current, { id, ...resident }]));
    } catch (err) {
      console.error(err);
      setError("Unable to add resident.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function saveResident(resident: Resident) {
    try {
      setSaving(true);
      setError("");
      await updateResident(resident);
      setResidents((current) =>
        sortResidents(current.map((item) => (item.id === resident.id ? resident : item)))
      );
    } catch (err) {
      console.error(err);
      setError("Unable to save resident.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function removeResident(id: string) {
    try {
      setSaving(true);
      setError("");
      await deleteResidentById(id);
      setResidents((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      setError("Unable to delete resident.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadResidents();
  }, []);

  return {
    residents,
    loading,
    saving,
    error,
    reloadResidents: () => loadResidents(false),
    addResident,
    saveResident,
    removeResident,
  };
}
