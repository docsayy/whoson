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
        borderRadius: 7,
      },
      typography: {
        fontFamily: APP_FONT,
        fontSize: 11.5,
        h4: {
          fontFamily: APP_FONT,
          fontSize: "1.18rem",
          lineHeight: 1.12,
          fontWeight: 800,
          letterSpacing: "-0.025em",
        },
        h5: {
          fontFamily: APP_FONT,
          fontSize: "0.98rem",
          lineHeight: 1.2,
          fontWeight: 800,
        },
        h6: {
          fontFamily: APP_FONT,
          fontSize: "0.84rem",
          lineHeight: 1.25,
          fontWeight: 800,
        },
        subtitle1: { fontSize: "0.78rem" },
        subtitle2: { fontSize: "0.72rem" },
        body1: { fontSize: "0.72rem" },
        body2: { fontSize: "0.68rem" },
        caption: { fontSize: "0.62rem" },
        button: {
          fontFamily: APP_FONT,
          fontSize: "0.66rem",
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
              minHeight: 26,
              borderRadius: 6,
              paddingLeft: 8,
              paddingRight: 8,
            },
          },
        },
        MuiChip: {
          defaultProps: { size: "small" },
          styleOverrides: {
            root: { minHeight: 18, height: 18 },
            label: { paddingLeft: 6, paddingRight: 6, fontSize: "0.59rem", fontWeight: 700 },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              minHeight: 30,
              paddingTop: 4,
              paddingBottom: 4,
              fontSize: "0.64rem",
              fontWeight: 800,
            },
          },
        },
        MuiCardContent: {
          styleOverrides: {
            root: {
              padding: 9,
              "&:last-child": { paddingBottom: 9 },
            },
          },
        },
        MuiInputBase: {
          styleOverrides: {
            root: { fontFamily: APP_FONT, fontSize: "0.69rem" },
          },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: { fontFamily: APP_FONT, fontSize: "0.66rem" },
          },
        },
        MuiIconButton: {
          defaultProps: { size: "small" },
          styleOverrides: { root: { padding: 5 }, sizeSmall: { padding: 4 } },
        },
        MuiToolbar: {
          styleOverrides: { root: { minHeight: "46px !important" } },
        },
        MuiTableCell: {
          styleOverrides: {
            root: { padding: "5px 7px", fontSize: "0.68rem" },
            head: { fontWeight: 800 },
          },
        },
        MuiAlert: {
          styleOverrides: { root: { padding: "3px 8px", fontSize: "0.68rem" } },
        },
        MuiDialogTitle: {
          styleOverrides: { root: { padding: "10px 12px", fontSize: "0.95rem" } },
        },
        MuiDialogContent: {
          styleOverrides: { root: { padding: "8px 12px" } },
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
