import { useEffect, useState } from "react";
import {
  getRotations,
  seedDefaultRotations,
} from "../services/rotationService";
import type { RotationRequirement } from "../types/rotation";

export function useRotations() {
  const [rotations, setRotations] = useState<RotationRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRotations() {
    try {
      setLoading(true);
      setError("");
      const data = await getRotations();
      setRotations(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load rotations.");
    } finally {
      setLoading(false);
    }
  }

  async function seedRotations() {
    try {
      setError("");
      await seedDefaultRotations();
      await loadRotations();
    } catch (err) {
      console.error(err);
      setError("Unable to seed rotations.");
    }
  }

  useEffect(() => {
    loadRotations();
  }, []);

  return {
    rotations,
    loading,
    error,
    reloadRotations: loadRotations,
    seedRotations,
  };
}