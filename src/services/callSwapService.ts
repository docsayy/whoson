import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  query,
  orderBy,
  limit,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { CallSwapRequest, CallSwapStatus } from "../types/callSwap";
import type { MonthlySchedule } from "../types/monthSchedule";
import type { Resident } from "../types/resident";
import { notifyResident } from "./notificationService";
import { noteWrite, registerActiveListener } from "./dataCache";

const swapsCollection = collection(db, "callSwapRequests");

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

type SwapSubscriber = {
  onValue: (requests: CallSwapRequest[]) => void;
  onError?: (error: Error) => void;
};

const swapSubscribers = new Set<SwapSubscriber>();
let swapFirestoreUnsubscribe: Unsubscribe | null = null;
let swapReleaseMetric: (() => void) | null = null;
let currentSwapRequests: CallSwapRequest[] | null = null;

function startSharedSwapListener() {
  if (swapFirestoreUnsubscribe) return;
  swapReleaseMetric = registerActiveListener();
  swapFirestoreUnsubscribe = onSnapshot(
    query(swapsCollection, orderBy("createdAt", "desc"), limit(100)),
    (snapshot) => {
      currentSwapRequests = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...(item.data() as Omit<CallSwapRequest, "id">),
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      swapSubscribers.forEach((subscriber) =>
        subscriber.onValue(currentSwapRequests || [])
      );
    },
    (error) =>
      swapSubscribers.forEach((subscriber) => subscriber.onError?.(error))
  );
}

function stopSharedSwapListenerIfUnused() {
  if (swapSubscribers.size > 0 || !swapFirestoreUnsubscribe) return;
  swapFirestoreUnsubscribe();
  swapFirestoreUnsubscribe = null;
  swapReleaseMetric?.();
  swapReleaseMetric = null;
  currentSwapRequests = null;
}

export function subscribeToCallSwaps(
  onValue: (requests: CallSwapRequest[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const subscriber = { onValue, onError };
  swapSubscribers.add(subscriber);
  if (currentSwapRequests) {
    queueMicrotask(() => onValue(currentSwapRequests || []));
  }
  startSharedSwapListener();

  return () => {
    swapSubscribers.delete(subscriber);
    stopSharedSwapListenerIfUnused();
  };
}

export async function createCallSwapRequest(input: {
  date: string;
  serviceId: string;
  serviceName: string;
  requesterUid: string;
  requesterResidentId: string;
  requesterName: string;
  targetUid?: string;
  targetResidentId: string;
  targetName: string;
  reason: string;
}) {
  const now = new Date().toISOString();
  noteWrite();
  const docRef = await addDoc(
    swapsCollection,
    removeUndefined({
      ...input,
      status: "pending-recipient" as CallSwapStatus,
      history: [
        {
          status: "pending-recipient" as CallSwapStatus,
          actorUid: input.requesterUid,
          actorName: input.requesterName,
          note: input.reason,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    })
  );

  if (input.targetUid) {
    await notifyResident({
      residentId: input.targetResidentId,
      type: "swap-requested",
      title: "New call-swap request",
      message: `${input.requesterName} asked you to cover ${input.serviceName} on ${input.date}.`,
      linkPage: "call-swaps",
      relatedId: docRef.id,
    });
  }

  return docRef.id;
}

async function transitionSwap(
  request: CallSwapRequest,
  status: CallSwapStatus,
  actor: { uid: string; name: string },
  note?: string,
  extras: Record<string, unknown> = {}
) {
  const now = new Date().toISOString();
  await updateDoc(
    doc(db, "callSwapRequests", request.id),
    removeUndefined({
      status,
      updatedAt: now,
      history: [
        ...(request.history || []),
        {
          status,
          actorUid: actor.uid,
          actorName: actor.name,
          note,
          createdAt: now,
        },
      ],
      ...extras,
    })
  );
}

export async function acceptCallSwap(
  request: CallSwapRequest,
  actor: { uid: string; name: string }
) {
  await transitionSwap(request, "pending-approval", actor, "Recipient accepted.");
  await notifyResident({
    residentId: request.requesterResidentId,
    type: "swap-accepted",
    title: "Call swap accepted",
    message: `${request.targetName} accepted the proposed swap for ${request.serviceName} on ${request.date}. It now needs chief/coordinator approval.`,
    linkPage: "call-swaps",
    relatedId: request.id,
  });
}

export async function declineCallSwap(
  request: CallSwapRequest,
  actor: { uid: string; name: string },
  note?: string
) {
  await transitionSwap(request, "declined", actor, note || "Recipient declined.");
  await notifyResident({
    residentId: request.requesterResidentId,
    type: "swap-declined",
    title: "Call swap declined",
    message: `${request.targetName} declined the proposed swap for ${request.serviceName} on ${request.date}.`,
    linkPage: "call-swaps",
    relatedId: request.id,
  });
}

export async function cancelCallSwap(
  request: CallSwapRequest,
  actor: { uid: string; name: string }
) {
  await transitionSwap(request, "cancelled", actor, "Requester cancelled.");
}

export async function rejectCallSwap(
  request: CallSwapRequest,
  actor: { uid: string; name: string },
  note: string
) {
  await transitionSwap(request, "rejected", actor, note || "Approval declined.");
  await Promise.all([
    notifyResident({
      residentId: request.requesterResidentId,
      type: "swap-rejected",
      title: "Call swap not approved",
      message: `${request.serviceName} on ${request.date} was not approved. ${note}`,
      linkPage: "call-swaps",
      relatedId: request.id,
    }),
    notifyResident({
      residentId: request.targetResidentId,
      type: "swap-rejected",
      title: "Call swap not approved",
      message: `${request.serviceName} on ${request.date} was not approved. ${note}`,
      linkPage: "call-swaps",
      relatedId: request.id,
    }),
  ]);
}

export async function approveAndApplyCallSwap({
  request,
  targetResident,
  actor,
  note,
}: {
  request: CallSwapRequest;
  targetResident: Resident;
  actor: { uid: string; name: string };
  note?: string;
}) {
  const monthId = request.date.slice(0, 7);
  const scheduleRef = doc(db, "scheduleMonths", monthId);
  const scheduleSnapshot = await getDoc(scheduleRef);
  if (!scheduleSnapshot.exists()) {
    throw new Error(`No call schedule exists for ${monthId}.`);
  }

  const schedule = {
    id: scheduleSnapshot.id,
    ...(scheduleSnapshot.data() as Omit<MonthlySchedule, "id">),
  };
  const key = `${request.date}_${request.serviceId}`;
  const currentCell = schedule.assignments[key];
  if (!currentCell) {
    throw new Error("The original call assignment no longer exists.");
  }
  if (currentCell.residentId !== request.requesterResidentId) {
    throw new Error(
      `This call is now assigned to ${currentCell.residentName}; review the schedule before approving.`
    );
  }

  const now = new Date().toISOString();
  const nextSchedule: MonthlySchedule = {
    ...schedule,
    status: "draft",
    assignments: {
      ...schedule.assignments,
      [key]: {
        ...currentCell,
        residentId: targetResident.id,
        residentName: targetResident.displayName,
        training: targetResident.pgy,
        pager: targetResident.pager,
        notes: [
          currentCell.notes,
          `Call swap approved: ${request.requesterName} → ${targetResident.displayName}.`,
          note,
        ]
          .filter(Boolean)
          .join(" "),
      },
    },
    updatedAt: now,
  };

  const nextHistory = [
    ...(request.history || []),
    {
      status: "approved-draft" as CallSwapStatus,
      actorUid: actor.uid,
      actorName: actor.name,
      note: note || "Approved and applied to draft schedule.",
      createdAt: now,
    },
  ];

  const batch = writeBatch(db);
  const { id: _id, ...scheduleData } = nextSchedule;
  batch.set(scheduleRef, scheduleData);
  batch.update(doc(db, "callSwapRequests", request.id), {
    status: "approved-draft",
    history: nextHistory,
    updatedAt: now,
    approvedByUid: actor.uid,
    approvedByName: actor.name,
    appliedAt: now,
  });
  await batch.commit();

  await Promise.all([
    notifyResident({
      residentId: request.requesterResidentId,
      type: "swap-approved",
      title: "Call swap approved",
      message: `${request.serviceName} on ${request.date} was moved to ${targetResident.displayName} in the draft schedule. It will be visible to residents after publication.`,
      linkPage: "call-swaps",
      relatedId: request.id,
    }),
    notifyResident({
      residentId: request.targetResidentId,
      type: "swap-approved",
      title: "Call swap approved",
      message: `${request.serviceName} on ${request.date} was assigned to you in the draft schedule. It will be visible after publication.`,
      linkPage: "call-swaps",
      relatedId: request.id,
    }),
  ]);
}

export async function saveCallSwapRequest(request: CallSwapRequest) {
  const { id, ...data } = request;
  await setDoc(doc(db, "callSwapRequests", id), data, { merge: true });
}
