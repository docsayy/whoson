import { AppBar, Box, Button, Stack, Toolbar, Typography } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { useNavigate } from "react-router-dom";
import SourceWhosOnPage from "./SourceWhosOnPage";

export default function PublicSourceWhosOnPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "white",
          color: "#0f172a",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <Toolbar>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ width: "100%" }}
          >
            <Typography fontWeight={900} fontSize={22}>
              WhosOn
            </Typography>
            <Button
              variant="contained"
              startIcon={<LoginIcon />}
              onClick={() => navigate("/login")}
              sx={{ textTransform: "none", fontWeight: 850 }}
            >
              Sign in / Sign up
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          width: "100%",
          maxWidth: 1180,
          mx: "auto",
          p: { xs: 1, sm: 1.5, md: 2 },
        }}
      >
        <SourceWhosOnPage />
      </Box>
    </Box>
  );
}
