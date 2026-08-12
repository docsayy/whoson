import { useEffect, useState } from "react";
import type { AcademicBlock } from "../types/block";
import {
  getAcademicBlocks,
  publishActiveChiefsForYear,
  restoreActiveChiefsFromVersion,
  saveAcademicBlocks,
  saveActiveChiefDraft,
} from "../services/blockService";

export function useAcademicBlocks() {
  const [blocks, setBlocks] = useState<AcademicBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadBlocks() {
    try {
      setLoading(true);
      setError("");
      const data = await getAcademicBlocks();
      setBlocks(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load academic blocks.");
    } finally {
      setLoading(false);
    }
  }

  async function runMutation(
    action: () => Promise<void>,
    failureMessage: string
  ) {
    try {
      setSaving(true);
      setError("");
      await action();
      await loadBlocks();
    } catch (err) {
      console.error(err);
      setError(failureMessage);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function saveBlocks(blocksToSave: AcademicBlock[]) {
    await runMutation(
      () => saveAcademicBlocks(blocksToSave),
      "Unable to save academic blocks."
    );
  }

  async function saveActiveChief(params: {
    blockId: string;
    residentId?: string;
    residentName?: string;
  }) {
    await runMutation(
      () => saveActiveChiefDraft(params),
      "Unable to save Active Chief."
    );
  }

  async function publishActiveChiefs(
    academicYear: string,
    version: number
  ) {
    await runMutation(
      () =>
        publishActiveChiefsForYear({
          academicYear,
          version,
          blocks,
        }),
      "Unable to publish Active Chief assignments."
    );
  }

  async function restoreActiveChiefs(
    academicYear: string,
    sourceVersion: number,
    newVersion: number
  ) {
    await runMutation(
      () =>
        restoreActiveChiefsFromVersion({
          academicYear,
          sourceVersion,
          newVersion,
          blocks,
        }),
      "Unable to restore Active Chief assignments."
    );
  }

  useEffect(() => {
    loadBlocks();
  }, []);

  return {
    blocks,
    loading,
    saving,
    error,
    reloadBlocks: loadBlocks,
    saveBlocks,
    saveActiveChief,
    publishActiveChiefs,
    restoreActiveChiefs,
  };
}
