import { useMemo } from "react";
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  type PaletteMode,
} from "@mui/material";

import { useSidebarSettings } from "../hooks/useSidebarSettings";

export default function AppThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = useSidebarSettings();

  const theme = useMemo(() => {
    const mode: PaletteMode = settings.theme.mode;

    return createTheme({
      palette: {
        mode,
        primary: {
          main: settings.theme.primaryColor,
        },
        background:
          mode === "light"
            ? {
                default: "#f8fafc",
                paper: "#ffffff",
              }
            : {
                default: "#0f172a",
                paper: "#172033",
              },
      },
      shape: {
        borderRadius: 10,
      },
      typography: {
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      components: {
        MuiButton: {
          defaultProps: {
            disableElevation: true,
          },
          styleOverrides: {
            root: {
              textTransform: "none",
              fontWeight: 700,
            },
          },
        },
      },
    });
  }, [settings.theme.mode, settings.theme.primaryColor]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
