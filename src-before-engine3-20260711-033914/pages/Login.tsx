import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { login } from "../services/auth";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      setLoading(true);
      setError("");

      await login(email, password);

      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        bgcolor: "#f5f7fb",
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={4}>
          <CardContent sx={{ p: 5 }}>
            <Stack spacing={3}>
              <Typography
                variant="h4"
                fontWeight={700}
                textAlign="center"
              >
                Residency Scheduler
              </Typography>

              <Typography
                color="text.secondary"
                textAlign="center"
              >
                Sign in with your hospital email
              </Typography>

              {error && <Alert severity="error">{error}</Alert>}

              <TextField
                fullWidth
                label="Hospital Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <TextField
                fullWidth
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <Button
                variant="contained"
                size="large"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  "Sign In"
                )}
              </Button>

              <Button variant="text">
                Forgot Password?
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}