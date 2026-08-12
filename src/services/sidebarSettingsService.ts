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
import { noteWrite, registerActiveListener } from "./dataCache";

const interfaceSettingsRef = doc(db, "appSettings", "sidebar");

type Subscriber = {
  onValue: (settings: SidebarSettings) => void;
  onError?: (error: Error) => void;
};

const subscribers = new Set<Subscriber>();
let firestoreUnsubscribe: Unsubscribe | null = null;
let currentSettings: SidebarSettings | null = null;
let releaseListenerMetric: (() => void) | null = null;

function startSharedListener() {
  if (firestoreUnsubscribe) return;
  releaseListenerMetric = registerActiveListener();
  firestoreUnsubscribe = onSnapshot(
    interfaceSettingsRef,
    (snapshot) => {
      currentSettings = snapshot.exists()
        ? normalizeSidebarSettings(snapshot.data())
        : createDefaultSidebarSettings();
      subscribers.forEach((subscriber) => subscriber.onValue(currentSettings!));
    },
    (error) => subscribers.forEach((subscriber) => subscriber.onError?.(error))
  );
}

function stopSharedListenerIfUnused() {
  if (subscribers.size > 0 || !firestoreUnsubscribe) return;
  firestoreUnsubscribe();
  firestoreUnsubscribe = null;
  releaseListenerMetric?.();
  releaseListenerMetric = null;
}

export function subscribeToSidebarSettings(
  onValue: (settings: SidebarSettings) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const subscriber = { onValue, onError };
  subscribers.add(subscriber);
  if (currentSettings) queueMicrotask(() => onValue(currentSettings!));
  startSharedListener();

  return () => {
    subscribers.delete(subscriber);
    stopSharedListenerIfUnused();
  };
}

export async function saveSidebarSettings(
  settings: SidebarSettings,
  updatedBy: string
): Promise<void> {
  const normalized = normalizeSidebarSettings(settings);
  noteWrite();
  await setDoc(
    interfaceSettingsRef,
    {
      ...normalized,
      updatedAt: serverTimestamp(),
      updatedBy,
    },
    { merge: false }
  );
  currentSettings = normalized;
  subscribers.forEach((subscriber) => subscriber.onValue(normalized));
}

export async function restoreDefaultSidebarSettings(
  updatedBy: string
): Promise<void> {
  await saveSidebarSettings(createDefaultSidebarSettings(), updatedBy);
}
