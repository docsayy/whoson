import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  orderBy,
  limit,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { AppNotification } from "../types/notification";
import type { AppPage } from "../types/page";
import type { UserProfile } from "../types/userProfile";
import { noteWrite, registerActiveListener } from "./dataCache";

const notificationsCollection = collection(db, "notifications");

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

type NotificationSubscriber = {
  onValue: (notifications: AppNotification[]) => void;
  onError?: (error: Error) => void;
};

type NotificationStream = {
  uid: string;
  residentId?: string;
  subscribers: Set<NotificationSubscriber>;
  records: Map<string, AppNotification>;
  uidLoaded: boolean;
  residentLoaded: boolean;
  current: AppNotification[] | null;
  unsubscribers: Unsubscribe[];
  releaseMetrics: Array<() => void>;
};

const notificationStreams = new Map<string, NotificationStream>();

function notificationStreamKey(uid: string, residentId?: string) {
  return `${uid}|${residentId || ""}`;
}

function emitNotificationStream(stream: NotificationStream) {
  if (!stream.uidLoaded || !stream.residentLoaded) return;
  stream.current = Array.from(stream.records.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  stream.subscribers.forEach((subscriber) =>
    subscriber.onValue(stream.current || [])
  );
}

function replaceNotificationSource(
  stream: NotificationStream,
  source: "uid" | "resident",
  items: AppNotification[]
) {
  for (const [id, item] of stream.records.entries()) {
    const belongsToSource =
      source === "uid"
        ? item.recipientUid === stream.uid
        : Boolean(
            stream.residentId &&
              item.recipientResidentId === stream.residentId
          );
    if (belongsToSource) stream.records.delete(id);
  }
  for (const item of items) stream.records.set(item.id, item);
  if (source === "uid") stream.uidLoaded = true;
  else stream.residentLoaded = true;
  emitNotificationStream(stream);
}

function startNotificationStream(stream: NotificationStream) {
  if (stream.unsubscribers.length) return;

  stream.releaseMetrics.push(registerActiveListener());
  stream.unsubscribers.push(
    onSnapshot(
      query(
        notificationsCollection,
        where("recipientUid", "==", stream.uid),
        orderBy("createdAt", "desc"),
        limit(50)
      ),
      (snapshot) =>
        replaceNotificationSource(
          stream,
          "uid",
          snapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<AppNotification, "id">),
          }))
        ),
      (error) =>
        stream.subscribers.forEach((subscriber) =>
          subscriber.onError?.(error)
        )
    )
  );

  if (stream.residentId) {
    stream.releaseMetrics.push(registerActiveListener());
    stream.unsubscribers.push(
      onSnapshot(
        query(
          notificationsCollection,
          where("recipientResidentId", "==", stream.residentId),
          orderBy("createdAt", "desc"),
          limit(50)
        ),
        (snapshot) =>
          replaceNotificationSource(
            stream,
            "resident",
            snapshot.docs.map((item) => ({
              id: item.id,
              ...(item.data() as Omit<AppNotification, "id">),
            }))
          ),
        (error) =>
          stream.subscribers.forEach((subscriber) =>
            subscriber.onError?.(error)
          )
      )
    );
  }
}

function stopNotificationStreamIfUnused(key: string, stream: NotificationStream) {
  if (stream.subscribers.size > 0) return;
  stream.unsubscribers.forEach((unsubscribe) => unsubscribe());
  stream.releaseMetrics.forEach((release) => release());
  notificationStreams.delete(key);
}

export function subscribeToNotifications(
  uid: string,
  residentId: string | undefined,
  onValue: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const key = notificationStreamKey(uid, residentId);
  let stream = notificationStreams.get(key);
  if (!stream) {
    stream = {
      uid,
      residentId,
      subscribers: new Set(),
      records: new Map(),
      uidLoaded: false,
      residentLoaded: !residentId,
      current: null,
      unsubscribers: [],
      releaseMetrics: [],
    };
    notificationStreams.set(key, stream);
  }

  const subscriber = { onValue, onError };
  stream.subscribers.add(subscriber);
  if (stream.current) {
    queueMicrotask(() => onValue(stream?.current || []));
  }
  startNotificationStream(stream);

  return () => {
    stream?.subscribers.delete(subscriber);
    if (stream) stopNotificationStreamIfUnused(key, stream);
  };
}

export async function createNotification(input: {
  recipientUid?: string;
  recipientResidentId?: string;
  type: AppNotification["type"];
  title: string;
  message: string;
  linkPage?: AppPage;
  relatedId?: string;
}) {
  if (!input.recipientUid && !input.recipientResidentId) {
    throw new Error("A notification recipient is required.");
  }
  noteWrite();
  await addDoc(
    notificationsCollection,
    removeUndefined({
      ...input,
      createdAt: new Date().toISOString(),
    })
  );
}

export async function getActiveUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs
    .map((item) => ({
      uid: item.id,
      ...(item.data() as Omit<UserProfile, "uid">),
    }))
    .filter((profile) => profile.active !== false && profile.approved !== false);
}

export async function notifyResident({
  residentId,
  type,
  title,
  message,
  linkPage,
  relatedId,
}: {
  residentId: string;
  type: AppNotification["type"];
  title: string;
  message: string;
  linkPage?: AppPage;
  relatedId?: string;
}) {
  await createNotification({
    recipientResidentId: residentId,
    type,
    title,
    message,
    linkPage,
    relatedId,
  });
}

export async function notifyAllActiveUsers(input: {
  type: AppNotification["type"];
  title: string;
  message: string;
  linkPage?: AppPage;
  relatedId?: string;
}) {
  const users = await getActiveUsers();
  await Promise.all(
    users.map((profile) =>
      createNotification({
        recipientUid: profile.uid,
        recipientResidentId: profile.residentId,
        ...input,
      })
    )
  );
}

export async function markNotificationRead(id: string) {
  noteWrite();
  await updateDoc(doc(db, "notifications", id), {
    readAt: new Date().toISOString(),
  });
}

export async function markAllNotificationsRead(notifications: AppNotification[]) {
  const unread = notifications.filter((item) => !item.readAt);
  if (!unread.length) return;
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  for (const notification of unread) {
    noteWrite();
    batch.update(doc(db, "notifications", notification.id), { readAt: now });
  }
  await batch.commit();
}
