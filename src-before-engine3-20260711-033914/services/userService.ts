import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import { db } from "../config/firebase";
import { getAttendings } from "./attendingService";
import { getResidents } from "./residentService";
import type { AppRole, UserProfile } from "../types/userProfile";

const SUPER_ADMIN_EMAILS = ["msayyar@jhmc.org"];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function removeUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
}

export function isSuperAdminEmail(email: string) {
  const cleanEmail = normalizeEmail(email);
  return SUPER_ADMIN_EMAILS.map((item) => item.toLowerCase()).includes(cleanEmail);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data() as Partial<UserProfile>;

  return {
    uid: data.uid || uid,
    email: data.email || "",
    displayName: data.displayName || data.email?.split("@")[0] || "User",
    role: data.role || "Resident",
    active: data.active !== false,
    approved: data.approved !== false,
    emailVerified: data.emailVerified !== false,
    residentId: data.residentId,
    attendingId: data.attendingId,
    phone: data.phone,
    inviteCode: data.inviteCode,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt,
    lastLogin: data.lastLogin,
  };
}

export async function findApprovedPersonByEmail(email: string): Promise<{
  email: string;
  displayName: string;
  role: AppRole;
  residentId?: string;
  attendingId?: string;
}> {
  const cleanEmail = normalizeEmail(email);

  if (isSuperAdminEmail(cleanEmail)) {
    return {
      email: cleanEmail,
      displayName: "Super Admin",
      role: "Admin",
    };
  }

  const residents = await getResidents();
  const resident = residents.find(
    (item) => item.email?.trim().toLowerCase() === cleanEmail
  );

  if (resident) {
    const canLogin = (resident as unknown as { canLogin?: boolean }).canLogin;

    if (!resident.active) {
      throw new Error("Your resident profile exists but is inactive.");
    }

    if (canLogin === false) {
      throw new Error("Your resident profile exists, but Can Login is turned off.");
    }

    return {
      email: cleanEmail,
      displayName: resident.displayName,
      role: resident.role === "Chief Resident" ? "Chief Resident" : "Resident",
      residentId: resident.id,
    };
  }

  const attendings = await getAttendings();
  const attending = attendings.find(
    (item) => item.email?.trim().toLowerCase() === cleanEmail
  );

  if (attending) {
    const canLogin = (attending as unknown as { canLogin?: boolean }).canLogin;

    if (!attending.active) {
      throw new Error("Your attending profile exists but is inactive.");
    }

    if (canLogin === false) {
      throw new Error("Your attending profile exists, but Can Login is turned off.");
    }

    return {
      email: cleanEmail,
      displayName: attending.displayName,
      role: "Attending",
      attendingId: attending.id,
    };
  }

  throw new Error(
    "No matching resident, attending, or admin authorization was found for this email."
  );
}

export async function createUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  role: AppRole;
  residentId?: string;
  attendingId?: string;
  phone?: string;
  inviteCode?: string;
  emailVerified?: boolean;
}) {
  const now = new Date().toISOString();

  const profile = removeUndefinedFields({
    uid: params.uid,
    email: normalizeEmail(params.email),
    displayName: params.displayName,
    role: params.role,
    active: true,
    approved: true,
    emailVerified: params.emailVerified !== false,
    residentId: params.residentId,
    attendingId: params.attendingId,
    phone: params.phone,
    inviteCode: params.inviteCode,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, "users", params.uid), profile, { merge: true });

  return {
    ...(profile as unknown as UserProfile),
    createdAt: String(profile.createdAt),
  };
}

export async function ensureSuperAdminProfile(params: {
  uid: string;
  email: string;
}) {
  const cleanEmail = normalizeEmail(params.email);

  if (!isSuperAdminEmail(cleanEmail)) return null;

  const existingProfile = await getUserProfile(params.uid);
  if (existingProfile) return existingProfile;

  return createUserProfile({
    uid: params.uid,
    email: cleanEmail,
    displayName: "Super Admin",
    role: "Admin",
    emailVerified: true,
  });
}

export async function updateUserRole(uid: string, role: AppRole) {
  await updateDoc(doc(db, "users", uid), {
    role,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateUserLoginState(
  uid: string,
  data: Partial<Pick<UserProfile, "emailVerified" | "lastLogin">>
) {
  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function repairUserProfileLink(
  uid: string,
  data: {
    displayName: string;
    role: AppRole;
    residentId?: string;
    attendingId?: string;
    emailVerified?: boolean;
  }
) {
  await updateDoc(
    doc(db, "users", uid),
    removeUndefinedFields({
      displayName: data.displayName,
      role: data.role,
      residentId: data.residentId,
      attendingId: data.attendingId,
      approved: true,
      active: true,
      emailVerified: data.emailVerified !== false,
      updatedAt: new Date().toISOString(),
    })
  );
}
