import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export type SourcePersonType = "resident" | "attending";
export type SourceProfileLink = { id: string; sourceName: string; personType: SourcePersonType; profileId: string; updatedAt: string };

export function sourceNameKey(value: string) {
  return value.toLowerCase().replace(/\b(dr|md|do)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function getSourceProfileLinks() {
  const snapshot = await getDocs(collection(db, "sourceProfileLinks"));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as SourceProfileLink));
}

export async function saveSourceProfileLink(sourceName: string, personType: SourcePersonType, profileId: string) {
  const key = `${personType}_${sourceNameKey(sourceName).replace(/ /g, "_")}`;
  const link: SourceProfileLink = { id: key, sourceName, personType, profileId, updatedAt: new Date().toISOString() };
  await setDoc(doc(db, "sourceProfileLinks", key), link);
  return link;
}
