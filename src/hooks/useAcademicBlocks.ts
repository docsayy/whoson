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

  async function loadBlocks(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      setError("");
      setBlocks(await getAcademicBlocks());
    } catch (err) {
      console.error(err);
      setError("Unable to load academic blocks.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function saveBlocks(blocksToSave: AcademicBlock[]) {
    try {
      setSaving(true);
      setError("");
      await saveAcademicBlocks(blocksToSave);
      setBlocks((current) => {
        const next = new Map(current.map((item) => [item.id, item]));
        blocksToSave.forEach((item) => next.set(item.id, item));
        return Array.from(next.values()).sort((a, b) =>
          a.startDate.localeCompare(b.startDate)
        );
      });
    } catch (err) {
      console.error(err);
      setError("Unable to save academic blocks.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function saveActiveChief(params: {
    blockId: string;
    residentId?: string;
    residentName?: string;
  }) {
    try {
      setSaving(true);
      setError("");
      await saveActiveChiefDraft(params);
      setBlocks((current) =>
        current.map((block) =>
          block.id !== params.blockId
            ? block
            : {
                ...block,
                activeChiefDraft:
                  params.residentId && params.residentName
                    ? {
                        residentId: params.residentId,
                        residentName: params.residentName,
                        updatedAt: new Date().toISOString(),
                      }
                    : null,
              }
        )
      );
    } catch (err) {
      console.error(err);
      setError("Unable to save Active Chief.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function publishActiveChiefs(academicYear: string, version: number) {
    try {
      setSaving(true);
      setError("");
      await publishActiveChiefsForYear({ academicYear, version, blocks });
      await loadBlocks(false);
    } catch (err) {
      console.error(err);
      setError("Unable to publish Active Chief assignments.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function restoreActiveChiefs(
    academicYear: string,
    sourceVersion: number,
    newVersion: number
  ) {
    try {
      setSaving(true);
      setError("");
      await restoreActiveChiefsFromVersion({
        academicYear,
        sourceVersion,
        newVersion,
        blocks,
      });
      await loadBlocks(false);
    } catch (err) {
      console.error(err);
      setError("Unable to restore Active Chief assignments.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadBlocks();
  }, []);

  return {
    blocks,
    loading,
    saving,
    error,
    reloadBlocks: () => loadBlocks(false),
    saveBlocks,
    saveActiveChief,
    publishActiveChiefs,
    restoreActiveChiefs,
  };
}
