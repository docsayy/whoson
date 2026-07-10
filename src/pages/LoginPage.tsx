import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockResetIcon from "@mui/icons-material/LockReset";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

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

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatInviteExpiration(value?: string) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function roleChipStyle(role?: string) {
  const cleanRole = (role || "").toLowerCase();

  if (cleanRole.includes("admin")) {
    return {
      color: "#7c2d12",
      backgroundColor: "#fff7ed",
      borderColor: "#fed7aa",
    };
  }

  if (cleanRole.includes("chief")) {
    return {
      color: "#6d28d9",
      backgroundColor: "#f5f3ff",
      borderColor: "#ddd6fe",
    };
  }

  if (cleanRole.includes("attending")) {
    return {
      color: "#0369a1",
      backgroundColor: "#f0f9ff",
      borderColor: "#bae6fd",
    };
  }

  if (cleanRole.includes("coordinator")) {
    return {
      color: "#be123c",
      backgroundColor: "#fff1f2",
      borderColor: "#fecdd3",
    };
  }

  return {
    color: "#15803d",
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
  };
}

export default function LoginPage() {
  const { login, signup, resetPassword, previewInvite } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupStep, setSignupStep] = useState<"code" | "confirm">("code");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [phone, setPhone] = useState("");
  const [invitePreview, setInvitePreview] = useState<InviteCode | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      if (!email.trim()) throw new Error("Please enter your email.");
      if (!password) throw new Error("Please enter your password.");

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

  async function handlePreviewInvite(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      if (!email.trim()) throw new Error("Please enter your email.");
      if (!password) throw new Error("Please enter a password.");
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      if (!confirmPassword) throw new Error("Please confirm your password.");
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
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

      if (!resetEmail.trim()) {
        throw new Error("Please enter your email.");
      }

      await resetPassword(resetEmail.trim());

      setResetDialogOpen(false);
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

  function openResetDialog() {
    setError("");
    setSuccess("");
    setResetEmail(email.trim());
    setResetDialogOpen(true);
  }

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setSignupStep("code");
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
    setInviteCode("");
    setPhone("");
    setInvitePreview(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  const chipStyle = roleChipStyle(invitePreview?.role);

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
          maxWidth: 540,
          borderRadius: 4,
          boxShadow: "0 20px 60px rgba(15,23,42,0.16)",
        }}
      >
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Stack spacing={2.2}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2.25,
                  display: "grid",
                  placeItems: "center",
                  backgroundColor: "#eff6ff",
                  color: "#2563eb",
                  flexShrink: 0,
                }}
              >
                <LocalHospitalIcon />
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h4"
                  fontWeight={900}
                  lineHeight={1}
                  sx={{ fontSize: { xs: 28, sm: 34 } }}
                >
                  WhosOn
                </Typography>

                <Typography color="text.secondary" fontSize={14}>
                  Flushing Hospital Internal Medicine
                </Typography>
              </Box>
            </Stack>

            <Alert
              severity={mode === "login" ? "info" : "warning"}
              sx={{ borderRadius: 2 }}
              icon={mode === "login" ? undefined : <VpnKeyIcon />}
            >
              {mode === "login"
                ? "Sign in with your email and password."
                : "New user signup is by invite code only. Use your personal email so password reset works reliably."}
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
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    fullWidth
                  />

                  <TextField
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    fullWidth
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            onClick={() => setShowPassword((current) => !current)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
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
                    {submitting ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={18} color="inherit" />
                        <span>Signing in...</span>
                      </Stack>
                    ) : (
                      "Login"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="text"
                    disabled={submitting}
                    startIcon={<LockResetIcon />}
                    onClick={openResetDialog}
                    sx={{ textTransform: "none", fontWeight: 750 }}
                  >
                    Forgot password?
                  </Button>

                  <Divider />

                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => switchMode("signup")}
                    sx={{
                      textTransform: "none",
                      borderRadius: 2,
                      fontWeight: 800,
                    }}
                  >
                    New user signup
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={2}>
                {signupStep === "code" ? (
                  <Box component="form" onSubmit={handlePreviewInvite}>
                    <Stack spacing={2}>
                      <TextField
                        label="Email"
                        placeholder="your personal email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        fullWidth
                      />

                      <TextField
                        label="Create Password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                        fullWidth
                        helperText="Use at least 6 characters."
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                edge="end"
                                onClick={() => setShowPassword((current) => !current)}
                                aria-label={
                                  showPassword ? "Hide password" : "Show password"
                                }
                              >
                                {showPassword ? (
                                  <VisibilityOffIcon />
                                ) : (
                                  <VisibilityIcon />
                                )}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />

                      <TextField
                        label="Confirm Password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        fullWidth
                        error={
                          Boolean(confirmPassword) && password !== confirmPassword
                        }
                        helperText={
                          Boolean(confirmPassword) && password !== confirmPassword
                            ? "Passwords do not match."
                            : "Re-enter the same password."
                        }
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                edge="end"
                                onClick={() =>
                                  setShowConfirmPassword((current) => !current)
                                }
                                aria-label={
                                  showConfirmPassword
                                    ? "Hide confirm password"
                                    : "Show confirm password"
                                }
                              >
                                {showConfirmPassword ? (
                                  <VisibilityOffIcon />
                                ) : (
                                  <VisibilityIcon />
                                )}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />

                      <TextField
                        label="Invite Code"
                        placeholder="WHOSON-XXXX-XXXX"
                        value={inviteCode}
                        onChange={(event) =>
                          setInviteCode(event.target.value.toUpperCase())
                        }
                        fullWidth
                      />

                      <Button
                        type="submit"
                        variant="contained"
                        disabled={submitting}
                        sx={{
                          py: 1.15,
                          borderRadius: 2,
                          fontWeight: 900,
                          textTransform: "none",
                        }}
                      >
                        {submitting ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={18} color="inherit" />
                            <span>Checking invite...</span>
                          </Stack>
                        ) : (
                          "Verify Invite"
                        )}
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  invitePreview && (
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        borderColor: "#bbf7d0",
                        backgroundColor: "#f0fdf4",
                      }}
                    >
                      <CardContent>
                        <Stack spacing={1.5}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <VerifiedUserIcon color="success" />

                            <Box>
                              <Typography fontWeight={900}>
                                Invite Verified
                              </Typography>

                              <Typography fontSize={13} color="text.secondary">
                                Confirm this is your WhosOn profile.
                              </Typography>
                            </Box>
                          </Stack>

                          <Divider />

                          <Stack spacing={1}>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              spacing={1}
                            >
                              <Typography color="text.secondary">Name</Typography>
                              <Typography fontWeight={850} textAlign="right">
                                {invitePreview.displayName}
                              </Typography>
                            </Stack>

                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              spacing={1}
                              alignItems="center"
                            >
                              <Typography color="text.secondary">Role</Typography>

                              <Chip
                                label={invitePreview.role}
                                size="small"
                                icon={<CheckCircleIcon />}
                                sx={{
                                  fontWeight: 850,
                                  color: chipStyle.color,
                                  backgroundColor: chipStyle.backgroundColor,
                                  border: "1px solid",
                                  borderColor: chipStyle.borderColor,
                                  "& .MuiChip-icon": {
                                    color: chipStyle.color,
                                  },
                                }}
                              />
                            </Stack>

                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              spacing={1}
                            >
                              <Typography color="text.secondary">Email</Typography>
                              <Typography fontWeight={750} textAlign="right">
                                {email.trim()}
                              </Typography>
                            </Stack>

                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              spacing={1}
                            >
                              <Typography color="text.secondary">
                                Invite expires
                              </Typography>
                              <Typography fontWeight={750} textAlign="right">
                                {formatInviteExpiration(invitePreview.expiresAt)}
                              </Typography>
                            </Stack>
                          </Stack>

                          <TextField
                            label="Phone Number"
                            value={phone}
                            onChange={(event) =>
                              setPhone(formatPhoneNumber(event.target.value))
                            }
                            placeholder="(555) 555-5555"
                            fullWidth
                          />

                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                          >
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
                              {submitting ? (
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <CircularProgress size={18} color="inherit" />
                                  <span>Creating...</span>
                                </Stack>
                              ) : (
                                "Agree & Create Account"
                              )}
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  )
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

                <Typography
                  variant="caption"
                  color="text.secondary"
                  textAlign="center"
                >
                  Signup requires a valid invite code from a chief resident,
                  coordinator, or administrator.
                </Typography>
              </Stack>
            )}

            <Typography
              variant="caption"
              color="text.secondary"
              textAlign="center"
              sx={{ pt: 0.5 }}
            >
              WhosOn v0.9.0
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Dialog
        open={resetDialogOpen}
        onClose={() => {
          if (!submitting) setResetDialogOpen(false);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Reset Password</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography color="text.secondary" fontSize={14}>
              Enter the email you use for WhosOn. A password reset link will be
              sent to that inbox.
            </Typography>

            <TextField
              label="Email"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              autoComplete="email"
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setResetDialogOpen(false)}
            disabled={submitting}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleResetPassword}
            disabled={submitting}
            sx={{ textTransform: "none", fontWeight: 850 }}
          >
            {submitting ? "Sending..." : "Send Reset Link"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}