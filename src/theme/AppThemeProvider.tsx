import { useMemo } from "react";
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  type PaletteMode,
} from "@mui/material";

import { useSidebarSettings } from "../hooks/useSidebarSettings";

const APP_FONT =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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
        borderRadius: 9,
      },
      typography: {
        fontFamily: APP_FONT,
        fontSize: 12.5,
        h4: {
          fontFamily: APP_FONT,
          fontSize: "1.45rem",
          lineHeight: 1.12,
          fontWeight: 800,
          letterSpacing: "-0.025em",
        },
        h5: {
          fontFamily: APP_FONT,
          fontSize: "1.12rem",
          lineHeight: 1.2,
          fontWeight: 800,
        },
        h6: {
          fontFamily: APP_FONT,
          fontSize: "0.95rem",
          lineHeight: 1.25,
          fontWeight: 800,
        },
        body1: { fontSize: "0.79rem" },
        body2: { fontSize: "0.74rem" },
        button: {
          fontFamily: APP_FONT,
          fontSize: "0.72rem",
          fontWeight: 700,
          textTransform: "none",
        },
      },
      components: {
        MuiButton: {
          defaultProps: {
            disableElevation: true,
            size: "small",
          },
          styleOverrides: {
            root: {
              minHeight: 30,
              borderRadius: 8,
              paddingLeft: 10,
              paddingRight: 10,
            },
          },
        },
        MuiChip: {
          defaultProps: { size: "small" },
          styleOverrides: {
            root: { minHeight: 20 },
            label: { fontSize: "0.64rem", fontWeight: 700 },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              minHeight: 34,
              paddingTop: 5,
              paddingBottom: 5,
              fontSize: "0.69rem",
              fontWeight: 800,
            },
          },
        },
        MuiCardContent: {
          styleOverrides: {
            root: {
              paddingTop: 12,
              paddingBottom: 12,
            },
          },
        },
        MuiInputBase: {
          styleOverrides: {
            root: { fontFamily: APP_FONT, fontSize: "0.75rem" },
          },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: { fontFamily: APP_FONT, fontSize: "0.72rem" },
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
