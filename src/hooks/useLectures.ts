import { useEffect, useState } from "react";
import type { LectureEvent } from "../types/lecture";
import {
  createLectureEvent,
  deleteLectureEvent,
  getLectureEvents,
  peekLectureEvents,
  updateLectureEvent,
} from "../services/lectureService";
import { shouldRefreshThisSession } from "../services/dataCache";

export function useLectures() {
  const cached = peekLectureEvents();
  const [lectures, setLectures] = useState<LectureEvent[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load(force = false, quiet = false) {
    try {
      if (!quiet) setLoading(true);
      setError("");
      setLectures(await getLectureEvents(force));
    } catch (err) {
      console.error(err);
      if (!lectures.length) setError("Unable to load the lecture schedule.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function add(event: Omit<LectureEvent, "id">) {
    setSaving(true);
    try {
      const id = await createLectureEvent(event);
      setLectures((current) => [...current, { id, ...event }].sort((a, b) =>
        a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)
      ));
    } finally {
      setSaving(false);
    }
  }

  async function save(event: LectureEvent) {
    setSaving(true);
    try {
      await updateLectureEvent(event);
      setLectures((current) => current.map((item) => item.id === event.id ? event : item));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      await deleteLectureEvent(id);
      setLectures((current) => current.filter((item) => item.id !== id));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const refresh = shouldRefreshThisSession("lectures");
    void load(refresh, Boolean(cached));
    // Cached data is intentionally captured only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    lectures,
    loading,
    saving,
    error,
    reload: () => load(true),
    addLecture: add,
    saveLecture: save,
    removeLecture: remove,
  };
}
