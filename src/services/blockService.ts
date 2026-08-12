import {
  collection,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type {
  AcademicBlock,
  ActiveChiefSelection,
} from "../types/block";
import { CACHE_TTL, getCachedValue, invalidateCachedValue, noteWrite, readThroughCache, setCachedValue } from "./dataCache";

const blocksCollection = collection(db, "academicBlocks");
const CACHE_KEY = "academic-blocks:all";

export async function getAcademicBlocks(force = false): Promise<AcademicBlock[]> {
  return readThroughCache(
    CACHE_KEY,
    async () => {
      const q = query(blocksCollection, orderBy("startDate", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<AcademicBlock, "id">),
      }));
    },
    CACHE_TTL.reference,
    force
  );
}

export async function saveAcademicBlocks(blocks: AcademicBlock[]) {
  const current = getCachedValue<AcademicBlock[]>(CACHE_KEY) || [];
  for (const block of blocks) {
    noteWrite();
    const { id, ...data } = block;
    await setDoc(doc(db, "academicBlocks", id), data, { merge: true });
  }
  const next = new Map(current.map((item) => [item.id, item]));
  blocks.forEach((item) => next.set(item.id, item));
  setCachedValue(CACHE_KEY, Array.from(next.values()).sort((a, b) => a.startDate.localeCompare(b.startDate)), CACHE_TTL.reference);
}

function updateCachedChief(blockId: string, selection: ActiveChiefSelection | null) {
  const current = getCachedValue<AcademicBlock[]>(CACHE_KEY);
  if (!current) return;
  setCachedValue(
    CACHE_KEY,
    current.map((block) =>
      block.id === blockId ? { ...block, activeChiefDraft: selection } : block
    ),
    CACHE_TTL.reference
  );
}

export async function saveActiveChiefDraft(params: {
  blockId: string;
  residentId?: string;
  residentName?: string;
}) {
  const ref = doc(db, "academicBlocks", params.blockId);

  if (!params.residentId || !params.residentName) {
    noteWrite();
    await setDoc(
      ref,
      {
        activeChiefDraft: deleteField(),
      },
      { merge: true }
    );
    updateCachedChief(params.blockId, null);
    return;
  }

  const selection: ActiveChiefSelection = {
    residentId: params.residentId,
    residentName: params.residentName,
    updatedAt: new Date().toISOString(),
  };

  noteWrite();
  await setDoc(
    ref,
    {
      activeChiefDraft: selection,
    },
    { merge: true }
  );
  updateCachedChief(params.blockId, selection);
}

export async function publishActiveChiefsForYear(params: {
  academicYear: string;
  version: number;
  blocks: AcademicBlock[];
}) {
  const now = new Date().toISOString();
  const yearBlocks = params.blocks.filter(
    (block) => block.academicYear === params.academicYear
  );

  for (let index = 0; index < yearBlocks.length; index += 400) {
    const batch = writeBatch(db);

    for (const block of yearBlocks.slice(index, index + 400)) {
      const draft = block.activeChiefDraft || null;
      const published = draft
        ? {
            ...draft,
            version: params.version,
            updatedAt: now,
          }
        : null;

      batch.set(
        doc(db, "academicBlocks", block.id),
        {
          activeChiefPublished: published,
          activeChiefHistory: {
            ...(block.activeChiefHistory || {}),
            [String(params.version)]: published,
          },
        },
        { merge: true }
      );
    }

    await batch.commit();
  }
  invalidateCachedValue(CACHE_KEY);
}

export async function restoreActiveChiefsFromVersion(params: {
  academicYear: string;
  sourceVersion: number;
  newVersion: number;
  blocks: AcademicBlock[];
}) {
  const now = new Date().toISOString();
  const yearBlocks = params.blocks.filter(
    (block) => block.academicYear === params.academicYear
  );

  for (let index = 0; index < yearBlocks.length; index += 400) {
    const batch = writeBatch(db);

    for (const block of yearBlocks.slice(index, index + 400)) {
      const source =
        block.activeChiefHistory?.[String(params.sourceVersion)] || null;
      const restored = source
        ? {
            ...source,
            version: params.newVersion,
            updatedAt: now,
          }
        : null;

      batch.set(
        doc(db, "academicBlocks", block.id),
        {
          activeChiefDraft: restored,
          activeChiefPublished: restored,
          activeChiefHistory: {
            ...(block.activeChiefHistory || {}),
            [String(params.newVersion)]: restored,
          },
        },
        { merge: true }
      );
    }

    await batch.commit();
  }
  invalidateCachedValue(CACHE_KEY);
}
