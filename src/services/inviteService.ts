import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { InviteCode } from "../types/inviteCode";

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function valueIsTrue(value: boolean | string | undefined) {
  return value === true || value === "true";
}

function valueIsFalse(value: boolean | string | undefined) {
  return value === false || value === "false" || value === undefined;
}

function isExpired(expiresAt?: string) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}

export async function getInviteByCode(code: string): Promise<InviteCode> {
  const cleanCode = normalizeCode(code);
  const ref = doc(db, "inviteCodes", cleanCode);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Invalid invite code.");
  }

  const invite = snap.data() as InviteCode;

  if (!valueIsTrue(invite.active)) {
    throw new Error("This invite code is inactive.");
  }

  if (!valueIsFalse(invite.used)) {
    throw new Error("This invite code has already been used.");
  }

  if (isExpired(invite.expiresAt)) {
    throw new Error("This invite code has expired.");
  }

  return {
    ...invite,
    code: invite.code || cleanCode,
  };
}

export async function markInviteUsed(params: {
  code: string;
  uid: string;
  email: string;
}) {
  const cleanCode = normalizeCode(params.code);
  const ref = doc(db, "inviteCodes", cleanCode);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);

    if (!snap.exists()) {
      throw new Error("Invalid invite code.");
    }

    const invite = snap.data() as InviteCode;

    if (!valueIsTrue(invite.active)) {
      throw new Error("This invite code is inactive.");
    }

    if (!valueIsFalse(invite.used)) {
      throw new Error("This invite code has already been used.");
    }

    if (isExpired(invite.expiresAt)) {
      throw new Error("This invite code has expired.");
    }

    transaction.update(ref, {
      used: true,
      usedByUid: params.uid,
      usedByEmail: params.email.trim().toLowerCase(),
      usedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  });
}

export function generateInviteCode() {
  const part = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase().replace(/O/g, "X");

  return `WHOSON-${part()}-${part()}`;
}

export async function createInviteCode(invite: InviteCode) {
  const cleanCode = normalizeCode(invite.code);
  await setDoc(doc(db, "inviteCodes", cleanCode), {
    ...invite,
    code: cleanCode,
    active: true,
    used: false,
    createdAt: invite.createdAt || new Date().toISOString(),
  });
  return cleanCode;
}