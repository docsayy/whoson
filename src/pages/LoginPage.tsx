import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";

import { useAuth } from "../context/AuthContext";
import type { InviteCode } from "../types/inviteCode";

function friendlyAuthError(message: string) {
  if (message.includes("auth/invalid-credential")) {
    return "The email or password is incorrect. Please check both and try again.";
  }

  if (message.includes("auth/user-not-found")) {
    return "No account was found with this email. Please sign up first.";
  }

  if (message.includes("auth/wrong-password")) {
    return "The password does not match this email.";
  }

  if (message.includes("auth/email-already-in-use")) {
    return "An account already exists with this email. Please sign in or use Forgot Password.";
  }

  if (message.includes("auth/weak-password")) {
    return "Password is too weak. Please use at least 6 characters.";
  }

  if (message.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  if (message.includes("auth/network-request-failed")) {
    return "Network error. Please check your internet connection.";
  }

  return message;
}

export default function LoginPage() {
  const { login, signup, resetPassword, previewInvite } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupStep, setSignupStep] = useState<"code" | "confirm">("code");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [inviteCode, setInviteCode] = useState("");
  const [phone, setPhone] = useState("");
  const [invitePreview, setInvitePreview] = useState<InviteCode | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await login(email.trim(), password);
    } catch (err) {
      console.error(err);
      const rawMessage =
        err instanceof Error ? err.message : "Authentication failed.";
      setError(friendlyAuthError(rawMessage));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreviewInvite() {
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      if (!email.trim()) throw new Error("Please enter your email.");
      if (!password) throw new Error("Please enter a password.");
      if (!inviteCode.trim()) throw new Error("Please enter your invite code.");

      const invite = await previewInvite(inviteCode);
      setInvitePreview(invite);
      setSignupStep("confirm");
    } catch (err) {
      console.error(err);
      const rawMessage =
        err instanceof Error ? err.message : "Unable to verify invite code.";
      setError(friendlyAuthError(rawMessage));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignup() {
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      if (!invitePreview) throw new Error("Please verify your invite code first.");
      if (!phone.trim()) throw new Error("Please enter your phone number.");

      await signup({
        email: email.trim(),
        password,
        inviteCode,
        phone,
      });
    } catch (err) {
      console.error(err);
      const rawMessage =
        err instanceof Error ? err.message : "Unable to create account.";
      setError(friendlyAuthError(rawMessage));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      if (!email.trim()) {
        throw new Error("Please enter your email first.");
      }

      await resetPassword(email.trim());

      setSuccess("Password reset email sent. Please check your inbox and spam folder.");
    } catch (err) {
      console.error(err);
      const rawMessage =
        err instanceof Error ? err.message : "Unable to send reset email.";
      setError(friendlyAuthError(rawMessage));
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setSignupStep("code");
    setError("");
    setSuccess("");
    setPassword("");
    setInviteCode("");
    setPhone("");
    setInvitePreview(null);
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, #dbeafe 0, transparent 32%), linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
        p: 2,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 480,
          borderRadius: 4,
          boxShadow: "0 20px 60px rgba(15,23,42,0.16)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  backgroundColor: "#eff6ff",
                  color: "#2563eb",
                }}
              >
                <LocalHospitalIcon />
              </Box>

              <Box>
                <Typography variant="h4" fontWeight={900} lineHeight={1}>
                  WhosOn
                </Typography>
                <Typography color="text.secondary" fontSize={14}>
                  Flushing Hospital Internal Medicine
                </Typography>
              </Box>
            </Stack>

            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {mode === "login"
                ? "Sign in with your email and password."
                : "New user signup is by invite code only. Use your personal email for login and password reset."}
            </Alert>

            {error && (
              <Alert severity="error" sx={{ whiteSpace: "pre-line", borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ whiteSpace: "pre-line", borderRadius: 2 }}>
                {success}
              </Alert>
            )}

            {mode === "login" ? (
              <Box component="form" onSubmit={handleLogin}>
                <Stack spacing={2}>
                  <TextField
                    label="Email"
                    placeholder="yourname@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    fullWidth
                  />

                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    fullWidth
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting}
                    fullWidth
                    sx={{
                      py: 1.15,
                      borderRadius: 2,
                      fontWeight: 900,
                      textTransform: "none",
                    }}
                  >
                    {submitting ? "Please wait..." : "Login"}
                  </Button>

                  <Button
                    type="button"
                    variant="text"
                    disabled={submitting}
                    onClick={handleResetPassword}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    Forgot password?
                  </Button>

                  <Divider />

                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => switchMode("signup")}
                    sx={{ textTransform: "none", borderRadius: 2 }}
                  >
                    New user signup
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  placeholder="your personal email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  fullWidth
                  disabled={signupStep === "confirm"}
                />

                <TextField
                  label="Create Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  fullWidth
                  disabled={signupStep === "confirm"}
                />

                <TextField
                  label="Invite Code"
                  placeholder="WHOSON-XXXX-XXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  fullWidth
                  disabled={signupStep === "confirm"}
                />

                {signupStep === "code" && (
                  <Button
                    variant="contained"
                    disabled={submitting}
                    onClick={handlePreviewInvite}
                    sx={{
                      py: 1.15,
                      borderRadius: 2,
                      fontWeight: 900,
                      textTransform: "none",
                    }}
                  >
                    {submitting ? "Checking..." : "Continue"}
                  </Button>
                )}

                {signupStep === "confirm" && invitePreview && (
                  <Card variant="outlined" sx={{ borderRadius: 3 }}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <VerifiedUserIcon color="success" />
                          <Typography fontWeight={900}>
                            Confirm your WhosOn profile
                          </Typography>
                        </Stack>

                        <Typography>
                          <b>Name:</b> {invitePreview.displayName}
                        </Typography>

                        <Typography>
                          <b>Role:</b> {invitePreview.role}
                        </Typography>

                        <Typography>
                          <b>Email:</b> {email.trim()}
                        </Typography>

                        <TextField
                          label="Phone Number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Your best contact number"
                          fullWidth
                        />

                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="outlined"
                            onClick={() => {
                              setSignupStep("code");
                              setInvitePreview(null);
                              setPhone("");
                            }}
                            disabled={submitting}
                            sx={{ textTransform: "none" }}
                          >
                            Not me / Go back
                          </Button>

                          <Button
                            variant="contained"
                            onClick={handleSignup}
                            disabled={submitting}
                            sx={{ textTransform: "none", fontWeight: 900 }}
                          >
                            {submitting ? "Creating..." : "Agree & Create Account"}
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                <Divider />

                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => switchMode("login")}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  Already have an account? Login
                </Button>

                <Typography variant="caption" color="text.secondary" textAlign="center">
                  Signup requires a valid invite code from a chief resident,
                  coordinator, or administrator.
                </Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}