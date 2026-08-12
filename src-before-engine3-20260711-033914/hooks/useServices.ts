import { useEffect, useState } from "react";
import { getServices, seedDefaultServices } from "../services/serviceService";
import type { ScheduleService } from "../types/schedule";

export function useServices() {
  const [services, setServices] = useState<ScheduleService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadServices() {
    try {
      setLoading(true);
      setError("");
      const data = await getServices();
      setServices(data.filter((service) => service.active));
    } catch (err) {
      console.error(err);
      setError("Unable to load services.");
    } finally {
      setLoading(false);
    }
  }

  async function seedServices() {
    try {
      setError("");
      await seedDefaultServices();
      await loadServices();
    } catch (err) {
      console.error(err);
      setError("Unable to seed services.");
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  return {
    services,
    loading,
    error,
    reloadServices: loadServices,
    seedServices,
  };
}