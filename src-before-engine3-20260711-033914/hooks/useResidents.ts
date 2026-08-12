import { useEffect, useState } from "react";
import type { Resident } from "../types/resident";
import {
  createResident,
  deleteResidentById,
  getResidents,
  updateResident,
} from "../services/residentService";

export function useResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadResidents() {
    try {
      setLoading(true);
      setError("");
      const data = await getResidents();
      setResidents(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load residents.");
    } finally {
      setLoading(false);
    }
  }

  async function addResident(resident: Omit<Resident, "id">) {
    try {
      setError("");
      await createResident(resident);
      await loadResidents();
    } catch (err) {
      console.error(err);
      setError("Unable to add resident.");
    }
  }

  async function saveResident(resident: Resident) {
    try {
      setError("");
      await updateResident(resident);
      await loadResidents();
    } catch (err) {
      console.error(err);
      setError("Unable to save resident.");
    }
  }

  async function removeResident(id: string) {
    try {
      setError("");
      await deleteResidentById(id);
      await loadResidents();
    } catch (err) {
      console.error(err);
      setError("Unable to delete resident.");
    }
  }

  useEffect(() => {
    loadResidents();
  }, []);

  return {
    residents,
    loading,
    error,
    reloadResidents: loadResidents,
    addResident,
    saveResident,
    removeResident,
  };
}