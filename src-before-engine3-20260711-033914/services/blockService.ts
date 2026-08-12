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

const blocksCollection = collection(db, "academicBlocks");

export async function getAcademicBlocks(): Promise<AcademicBlock[]> {
  const q = query(blocksCollection, orderBy("startDate", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<AcademicBlock, "id">),
  }));
}

export async function saveAcademicBlocks(blocks: AcademicBlock[]) {
  for (const block of blocks) {
    const { id, ...data } = block;
    await setDoc(doc(db, "academicBlocks", id), data, { merge: true });
  }
}

export async function saveActiveChiefDraft(params: {
  blockId: string;
  residentId?: string;
  residentName?: string;
}) {
  const ref = doc(db, "academicBlocks", params.blockId);

  if (!params.residentId || !params.residentName) {
    await setDoc(
      ref,
      {
        activeChiefDraft: deleteField(),
      },
      { merge: true }
    );
    return;
  }

  const selection: ActiveChiefSelection = {
    residentId: params.residentId,
    residentName: params.residentName,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(
    ref,
    {
      activeChiefDraft: selection,
    },
    { merge: true }
  );
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
}
