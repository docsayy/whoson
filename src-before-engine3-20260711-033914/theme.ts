import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  typography: {
    fontFamily: [
      "Inter",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      "Segoe UI",
      "sans-serif",
    ].join(","),
    fontSize: 13,
    h4: {
      fontSize: "1.5rem",
      fontWeight: 800,
    },
    h5: {
      fontSize: "1.15rem",
      fontWeight: 800,
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 800,
    },
    body1: {
      fontSize: "0.86rem",
    },
    body2: {
      fontSize: "0.78rem",
    },
    caption: {
      fontSize: "0.7rem",
    },
    button: {
      fontSize: "0.78rem",
      textTransform: "none",
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: "12px",
          "&:last-child": {
            paddingBottom: "12px",
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        size: "small",
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiChip: {
      defaultProps: {
        size: "small",
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: "52px !important",
        },
      },
    },
  },
});