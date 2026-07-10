import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  createDefaultSidebarSettings,
  normalizeSidebarSettings,
} from "../config/navigation";
import type { SidebarSettings } from "../types/sidebarSettings";

const interfaceSettingsRef = doc(db, "appSettings", "sidebar");

export function subscribeToSidebarSettings(
  onValue: (settings: SidebarSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    interfaceSettingsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onValue(createDefaultSidebarSettings());
        return;
      }

      onValue(normalizeSidebarSettings(snapshot.data()));
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function saveSidebarSettings(
  settings: SidebarSettings,
  updatedBy: string
): Promise<void> {
  const normalized = normalizeSidebarSettings(settings);

  await setDoc(
    interfaceSettingsRef,
    {
      ...normalized,
      updatedAt: serverTimestamp(),
      updatedBy,
    },
    { merge: false }
  );
}

export async function restoreDefaultSidebarSettings(
  updatedBy: string
): Promise<void> {
  await saveSidebarSettings(createDefaultSidebarSettings(), updatedBy);
}
