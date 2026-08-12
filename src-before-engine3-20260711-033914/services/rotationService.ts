import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  DEFAULT_ROTATIONS,
  LEGACY_TWO_NORTH_CCU_BLOCK_ROTATION_ID,
  NIGHT_FLOAT_ROTATION_IDS,
  OLD_GENERIC_NIGHT_FLOAT_ROTATION_ID,
} from "../config/rotationDefinitions";
import type { RotationRequirement } from "../types/rotation";

export {
  LEGACY_TWO_NORTH_CCU_BLOCK_ROTATION_ID,
  NIGHT_FLOAT_ROTATION_IDS,
  OLD_GENERIC_NIGHT_FLOAT_ROTATION_ID,
};

const rotationsCollection = collection(db, "rotations");

export async function getRotations(): Promise<RotationRequirement[]> {
  const q = query(rotationsCollection, orderBy("displayOrder", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<RotationRequirement, "id">),
  }));
}

export async function seedDefaultRotations() {
  for (const rotation of DEFAULT_ROTATIONS) {
    const { id, ...data } = rotation;
    await setDoc(doc(db, "rotations", id), data, { merge: true });
  }
}
