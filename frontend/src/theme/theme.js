import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2563EB",
      dark: "#1D4ED8",
      light: "#DBEAFE",
    },
    secondary: { main: "#0F766E" },
    success: { main: "#059669" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
    background: {
      default: "#F4F7FB",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#111827",
      secondary: "#64748B",
    },
    divider: "#E2E8F0",
  },

  typography: {
    fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
    h4: {
      fontWeight: 800,
      letterSpacing: "-0.03em",
    },
    h5: {
      fontWeight: 750,
      letterSpacing: "-0.02em",
    },
    h6: { fontWeight: 700 },
    button: {
      fontSize: 14,
      fontWeight: 700,
      textTransform: "none",
    },
  },

  shape: {
    borderRadius: 12,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minWidth: 320,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #E2E8F0",
          boxShadow:
            "0 10px 30px rgba(15, 23, 42, 0.06)",
        },
      },
    },

    /*
     * Global action-button system.
     *
     * Medium is used for page-level actions:
     * Add / Import / Export / Print / Refresh / Save.
     *
     * Small remains compact for row actions, dialogs and tables.
     */
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        size: "medium",
      },

      styleOverrides: {
        root: {
          minWidth: 0,
          borderRadius: 10,
          textTransform: "none",
          fontWeight: 700,
          whiteSpace: "nowrap",
          lineHeight: 1.2,
          boxShadow: "none",
          transition:
            "background-color .18s ease, border-color .18s ease, color .18s ease, transform .18s ease",
          "& .MuiButton-startIcon": {
            marginRight: 7,
          },
          "& .MuiButton-endIcon": {
            marginLeft: 7,
          },
          "& .MuiButton-startIcon svg, & .MuiButton-endIcon svg":
            {
              fontSize: 19,
            },
          "&:active": {
            transform: "translateY(1px)",
          },
        },

        sizeSmall: {
          minHeight: 34,
          padding: "6px 10px",
          borderRadius: 8,
          fontSize: 12.5,
          "& .MuiButton-startIcon svg, & .MuiButton-endIcon svg":
            {
              fontSize: 17,
            },
        },

        sizeMedium: {
          minHeight: 42,
          padding: "9px 16px",
          borderRadius: 10,
          fontSize: 14,
        },

        sizeLarge: {
          minHeight: 46,
          padding: "11px 20px",
          borderRadius: 11,
          fontSize: 14.5,
        },

        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },

        outlined: {
          backgroundColor: "#FFFFFF",
          borderColor: "#2563EB",
          color: "#2563EB",
          "&:hover": {
            backgroundColor: "#EFF6FF",
            borderColor: "#1D4ED8",
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 9,
        },
        sizeSmall: {
          width: 32,
          height: 32,
        },
        sizeMedium: {
          width: 38,
          height: 38,
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        size: "small",
        fullWidth: true,
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 42,
          borderRadius: 10,
          backgroundColor: "#FFFFFF",
        },
      },
    },

    MuiSelect: {
      defaultProps: {
        size: "small",
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 650,
        },
        sizeSmall: {
          height: 25,
          fontSize: 12,
        },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: "#F8FAFC",
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#475569",
          fontWeight: 700,
        },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "16px 24px",
          gap: 8,
        },
      },
    },
  },
});

export default theme;
