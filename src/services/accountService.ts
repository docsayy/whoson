import { doc, getDoc, writeBatch } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

import { auth, db } from "../config/firebase";
import type { UserProfile } from "../types/userProfile";

export type MyAccountDetails = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  pager: string;
  linkedType: "resident" | "attending" | "user";
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getMyAccountDetails(
  profile: UserProfile
): Promise<MyAccountDetails> {
  const base: MyAccountDetails = {
    firstName: "",
    lastName: "",
    displayName: profile.displayName || "",
    email: profile.email || "",
    phone: profile.phone || "",
    pager: "",
    linkedType: "user",
  };

  if (profile.residentId) {
    const snapshot = await getDoc(doc(db, "residents", profile.residentId));
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        firstName: clean(data.firstName),
        lastName: clean(data.lastName),
        displayName: clean(data.displayName) || base.displayName,
        email: base.email,
        phone: clean(data.phone) || base.phone,
        pager: clean(data.pager),
        linkedType: "resident",
      };
    }
  }

  if (profile.attendingId) {
    const snapshot = await getDoc(doc(db, "attendings", profile.attendingId));
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        firstName: clean(data.firstName),
        lastName: clean(data.lastName),
        displayName: clean(data.displayName) || base.displayName,
        email: base.email,
        phone: clean(data.phone) || base.phone,
        pager: clean(data.pager),
        linkedType: "attending",
      };
    }
  }

  return base;
}

export async function saveMyAccountDetails(
  profile: UserProfile,
  details: Pick<
    MyAccountDetails,
    "firstName" | "lastName" | "displayName" | "phone" | "pager"
  >
) {
  const displayName = details.displayName.trim();
  if (!displayName) throw new Error("Display name is required.");

  const now = new Date().toISOString();
  const batch = writeBatch(db);

  batch.set(
    doc(db, "users", profile.uid),
    {
      displayName,
      phone: details.phone.trim(),
      updatedAt: now,
    },
    { merge: true }
  );

  if (profile.residentId) {
    batch.set(
      doc(db, "residents", profile.residentId),
      {
        firstName: details.firstName.trim(),
        lastName: details.lastName.trim(),
        displayName,
        phone: details.phone.trim(),
        pager: details.pager.trim(),
        updatedAt: now,
      },
      { merge: true }
    );
  }

  if (profile.attendingId) {
    batch.set(
      doc(db, "attendings", profile.attendingId),
      {
        firstName: details.firstName.trim(),
        lastName: details.lastName.trim(),
        displayName,
        phone: details.phone.trim(),
        pager: details.pager.trim(),
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await batch.commit();

  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName });
  }
}
