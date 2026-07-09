import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import { db } from "../config/firebase";
import { getAttendings } from "./attendingService";
import { getResidents } from "./residentService";
import type { AppRole, UserProfile } from "../types/userProfile";

const SUPER_ADMIN_EMAILS = ["msayyar@jhmc.org"];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isSuperAdminEmail(email: string) {
  return SUPER_ADMIN_EMAILS.map((item) => item.toLowerCase()).includes(
    normalizeEmail(email)
  );
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
    if (!resident.active) {
      throw new Error("Your resident profile exists but is inactive.");
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
    if (!attending.active) {
      throw new Error("Your attending profile exists but is inactive.");
    }

    return {
      email: cleanEmail,
      displayName: attending.displayName,
      role: "Attending",
      attendingId: attending.id,
    };
  }

  throw new Error("No matching resident, attending, or admin authorization was found.");
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
  const profile: UserProfile = {
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
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, "users", params.uid), profile, { merge: true });
  return profile;
}

export async function ensureSuperAdminProfile(params: {
  uid: string;
  email: string;
}) {
  return createUserProfile({
    uid: params.uid,
    email: params.email,
    displayName: "Super Admin",
    role: "Admin",
    emailVerified: true,
  });
}

export async function updateUserRole(uid: string, role: AppRole) {
  await updateDoc(doc(db, "users", uid), { role });
}

export async function updateUserLoginState(
  uid: string,
  data: Partial<Pick<UserProfile, "emailVerified" | "lastLogin">>
) {
  await updateDoc(doc(db, "users", uid), data);
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
  await updateDoc(doc(db, "users", uid), {
    displayName: data.displayName,
    role: data.role,
    residentId: data.residentId,
    attendingId: data.attendingId,
    approved: true,
    active: true,
    emailVerified: data.emailVerified !== false,
    updatedAt: new Date().toISOString(),
  });
}