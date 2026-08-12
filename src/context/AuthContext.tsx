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
import { completeInviteSignup, getInviteByCode } from "../services/inviteService";
import {
  ensureSuperAdminProfile,
  getUserProfile,
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
  previewInvite: (code: string) => Promise<InviteCode>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isEmailAlreadyInUse(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  return text.includes("auth/email-already-in-use");
}

function formatLoginProblem(parts: string[]) {
  return `Unable to sign in:\n\n${parts.map((item) => `• ${item}`).join("\n")}`;
}

function withLoginState(profile: UserProfile): UserProfile {
  return {
    ...profile,
    emailVerified: true,
    lastLogin: new Date().toISOString(),
  };
}

async function safeUpdateLoginState(uid: string, updatedProfile: UserProfile) {
  try {
    const storageKey = `whoson:last-login-write:${uid}`;
    const previous = Number(localStorage.getItem(storageKey) || 0);
    const sixHours = 6 * 60 * 60 * 1000;
    if (Date.now() - previous < sixHours) return;

    await updateUserLoginState(uid, {
      emailVerified: true,
      lastLogin: updatedProfile.lastLogin,
    });
    localStorage.setItem(storageKey, String(Date.now()));
  } catch (err) {
    console.warn("Unable to update login timestamp.", err);
  }
}

async function loadUsableProfile(firebaseUser: User) {
  const cleanEmail = normalizeEmail(firebaseUser.email || "");

  let userProfile = await getUserProfile(firebaseUser.uid);

  if (!userProfile && cleanEmail) {
    userProfile = await ensureSuperAdminProfile({
      uid: firebaseUser.uid,
      email: cleanEmail,
    });
  }

  return userProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const signupInProgressRef = useRef(false);

  async function login(email: string, password: string) {
    const cleanEmail = normalizeEmail(email);

    const credential = await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

    const userProfile = await loadUsableProfile(credential.user);
    const problems: string[] = [];

    if (!userProfile) {
      problems.push(
        "No WhosOn user profile was found for this Firebase account. Please ask an admin to send an invite or repair the account."
      );
    } else {
      if (!userProfile.active) problems.push("Your app user profile is inactive.");
      if (!userProfile.approved) problems.push("Your app user profile is not approved.");
    }

    if (problems.length > 0 || !userProfile) {
      await signOut(auth);
      setUser(null);
      setProfile(null);
      throw new Error(formatLoginProblem(problems));
    }

    const updatedProfile = withLoginState(userProfile);

    await safeUpdateLoginState(credential.user.uid, updatedProfile);

    setUser(credential.user);
    setProfile(updatedProfile);
  }

  async function previewInvite(code: string) {
    return getInviteByCode(code);
  }

  async function signup(params: SignupParams) {
    const cleanEmail = normalizeEmail(params.email);
    const cleanCode = params.inviteCode.trim().toUpperCase();

    if (!cleanEmail) throw new Error("Please enter your email.");
    if (!params.password) throw new Error("Please enter your password.");
    if (!cleanCode) throw new Error("Please enter your invite code.");
    if (!params.phone.trim()) throw new Error("Please enter your phone number.");

    // Confirm the code before creating/signing in the Firebase Auth account.
    await getInviteByCode(cleanCode);
    signupInProgressRef.current = true;

    try {
      let credential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>;

      try {
        credential = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          params.password
        );
      } catch (err) {
        if (!isEmailAlreadyInUse(err)) throw err;

        credential = await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          params.password
        );
      }

      const userProfile = await completeInviteSignup({
        code: cleanCode,
        uid: credential.user.uid,
        email: cleanEmail,
        phone: params.phone.trim(),
      });

      setUser(credential.user);
      setProfile(withLoginState(userProfile));
    } catch (err) {
      await signOut(auth).catch(() => undefined);
      setUser(null);
      setProfile(null);
      throw err;
    } finally {
      signupInProgressRef.current = false;
    }
  }

  async function resetPassword(email: string) {
    const cleanEmail = normalizeEmail(email);
    await sendPasswordResetEmail(auth, cleanEmail);
  }

  async function resendVerification(email: string, password: string) {
    const cleanEmail = normalizeEmail(email);
    await signInWithEmailAndPassword(auth, cleanEmail, password);
    await signOut(auth);
    throw new Error("Email verification is not required for WhosOn signup.");
  }


  async function refreshProfile() {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setUser(null);
      setProfile(null);
      return;
    }

    const userProfile = await loadUsableProfile(firebaseUser);
    if (!userProfile || !userProfile.active || !userProfile.approved) {
      throw new Error("Your WhosOn profile is unavailable or inactive.");
    }

    setUser(firebaseUser);
    setProfile(withLoginState(userProfile));
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setLoading(true);

        if (!firebaseUser) {
          setUser(null);
          setProfile(null);
          return;
        }

        // Firebase emits an auth-state event immediately after account creation,
        // before the invite transaction has created the Firestore profile.
        if (signupInProgressRef.current) {
          setLoading(false);
          return;
        }

        const userProfile = await loadUsableProfile(firebaseUser);

        if (!userProfile || !userProfile.active || !userProfile.approved) {
          setUser(null);
          setProfile(null);
          await signOut(auth);
          return;
        }

        const updatedProfile = withLoginState(userProfile);
        await safeUpdateLoginState(firebaseUser.uid, updatedProfile);

        setUser(firebaseUser);
        setProfile(updatedProfile);
      } catch (err) {
        console.error(err);
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
        previewInvite,
        resetPassword,
        resendVerification,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
