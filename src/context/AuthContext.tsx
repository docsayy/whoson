import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { auth } from "../config/firebase";
import { getInviteByCode, markInviteUsed } from "../services/inviteService";
import {
  createUserProfile,
  ensureSuperAdminProfile,
  getUserProfile,
  isSuperAdminEmail,
  updateUserLoginState,
} from "../services/userService";
import type { InviteCode } from "../types/inviteCode";
import type { UserProfile } from "../types/userProfile";

type SignupParams = {
  email: string;
  password: string;
  inviteCode: string;
  phone: string;
};

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (params: SignupParams) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  previewInvite: (inviteCode: string) => Promise<InviteCode>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function withLoginState(profile: UserProfile): UserProfile {
  return {
    ...profile,
    emailVerified: true,
    lastLogin: new Date().toISOString(),
  };
}

function requireActiveProfile(profile: UserProfile | null) {
  if (!profile) throw new Error("No WhosOn profile was found for this account.");
  if (!profile.active) throw new Error("Your WhosOn profile is inactive.");
  if (!profile.approved) throw new Error("Your WhosOn profile is not approved yet.");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const authActionInProgress = useRef(false);

  async function loadProfileForUser(firebaseUser: User) {
    let userProfile = await getUserProfile(firebaseUser.uid);

    if (!userProfile && firebaseUser.email && isSuperAdminEmail(firebaseUser.email)) {
      userProfile = await ensureSuperAdminProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
      });
    }

    requireActiveProfile(userProfile);

    const updatedProfile = withLoginState(userProfile!);

    await updateUserLoginState(firebaseUser.uid, {
      emailVerified: true,
      lastLogin: updatedProfile.lastLogin,
    });

    setUser(firebaseUser);
    setProfile(updatedProfile);

    return updatedProfile;
  }

  async function login(email: string, password: string) {
    try {
      authActionInProgress.current = true;

      const credential = await signInWithEmailAndPassword(
        auth,
        normalizeEmail(email),
        password
      );

      await loadProfileForUser(credential.user);
    } finally {
      authActionInProgress.current = false;
    }
  }

  async function previewInvite(inviteCode: string) {
    return getInviteByCode(inviteCode);
  }

  async function signup(params: SignupParams) {
    try {
      authActionInProgress.current = true;

      const cleanEmail = normalizeEmail(params.email);
      const cleanCode = params.inviteCode.trim().toUpperCase();

      const invite = await getInviteByCode(cleanCode);

      const credential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        params.password
      );

      await createUserProfile({
        uid: credential.user.uid,
        email: cleanEmail,
        displayName: invite.displayName,
        role: invite.role,
        residentId: invite.residentId,
        attendingId: invite.attendingId,
        phone: params.phone.trim(),
        inviteCode: cleanCode,
        emailVerified: true,
      });

      await markInviteUsed({
        code: cleanCode,
        uid: credential.user.uid,
        email: cleanEmail,
      });

      await loadProfileForUser(credential.user);
    } finally {
      authActionInProgress.current = false;
    }
  }

  async function resetPassword(email: string) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) throw new Error("Please enter your email first.");
    await sendPasswordResetEmail(auth, cleanEmail);
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (authActionInProgress.current) return;

      try {
        setLoading(true);

        if (!firebaseUser) {
          setUser(null);
          setProfile(null);
          return;
        }

        await loadProfileForUser(firebaseUser);
      } catch (err) {
        console.error("Auth profile load failed:", err);
        setUser(null);
        setProfile(null);
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        signup,
        resetPassword,
        previewInvite,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}