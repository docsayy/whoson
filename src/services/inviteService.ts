import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { InviteCode } from "../types/inviteCode";
import type { UserProfile } from "../types/userProfile";

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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

function validateInvite(invite: InviteCode) {
  if (!valueIsTrue(invite.active)) {
    throw new Error("This invite code is inactive.");
  }

  if (!valueIsFalse(invite.used)) {
    throw new Error("This invite code has already been used.");
  }

  if (isExpired(invite.expiresAt)) {
    throw new Error("This invite code has expired.");
  }
}

function removeUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
}

export async function getInviteByCode(code: string): Promise<InviteCode> {
  const cleanCode = normalizeCode(code);
  const ref = doc(db, "inviteCodes", cleanCode);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Invalid invite code.");
  }

  const invite = snap.data() as InviteCode;
  validateInvite(invite);

  return {
    ...invite,
    code: invite.code || cleanCode,
  };
}

/**
 * Redeems the invite and creates the user's WhosOn profile in one Firestore
 * transaction. This prevents an invite from being consumed without a profile,
 * or a profile from being created while the invite remains reusable.
 */
export async function completeInviteSignup(params: {
  code: string;
  uid: string;
  email: string;
  phone: string;
}): Promise<UserProfile> {
  const cleanCode = normalizeCode(params.code);
  const cleanEmail = normalizeEmail(params.email);
  const inviteRef = doc(db, "inviteCodes", cleanCode);
  const userRef = doc(db, "users", params.uid);
  const now = new Date().toISOString();

  return runTransaction(db, async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteRef);
    const userSnapshot = await transaction.get(userRef);

    if (!inviteSnapshot.exists()) {
      throw new Error("Invalid invite code.");
    }

    const invite = inviteSnapshot.data() as InviteCode;
    validateInvite(invite);

    if (userSnapshot.exists()) {
      throw new Error(
        "A WhosOn profile already exists for this account. Please sign in instead."
      );
    }

    const profile = removeUndefinedFields({
      uid: params.uid,
      email: cleanEmail,
      displayName: invite.displayName,
      role: invite.role,
      active: true,
      approved: true,
      emailVerified: true,
      residentId: invite.residentId,
      attendingId: invite.attendingId,
      phone: params.phone.trim(),
      inviteCode: cleanCode,
      createdAt: now,
      updatedAt: now,
      lastLogin: now,
    }) as unknown as UserProfile;

    transaction.update(inviteRef, {
      used: true,
      usedByUid: params.uid,
      usedByEmail: cleanEmail,
      usedAt: now,
      updatedAt: serverTimestamp(),
    });

    transaction.set(userRef, profile, { merge: true });

    return profile;
  });
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
    validateInvite(invite);

    transaction.update(ref, {
      used: true,
      usedByUid: params.uid,
      usedByEmail: normalizeEmail(params.email),
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
