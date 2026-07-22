import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2563EB", dark: "#1D4ED8", light: "#DBEAFE" },
    secondary: { main: "#0F766E" },
    success: { main: "#059669" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
    background: { default: "#F4F7FB", paper: "#FFFFFF" },
    text: { primary: "#111827", secondary: "#64748B" },
    divider: "#E2E8F0",
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
    h4: { fontWeight: 800, letterSpacing: "-0.03em" },
    h5: { fontWeight: 750, letterSpacing: "-0.02em" },
    h6: { fontWeight: 700 },
    button: { fontWeight: 700 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { minWidth: 320 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: { styleOverrides: { root: { border: "1px solid #E2E8F0", boxShadow: "0 10px 30px rgba(15,23,42,.06)" } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 46,
          borderRadius: 10,
          textTransform: "none",
          paddingInline: 18,
          fontWeight: 700,
        },
        outlined: {
          backgroundColor: "#FFFFFF",
          borderColor: "#2563EB",
          color: "#2563EB",
          "&:hover": {
            backgroundColor: "#DBEAFE",
            borderColor: "#1D4ED8",
          },
        },
      },
    },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10, backgroundColor: "#fff" } } },
    MuiTableHead: { styleOverrides: { root: { backgroundColor: "#F8FAFC" } } },
    MuiTableCell: { styleOverrides: { head: { color: "#475569", fontWeight: 700 } } },
  },
});
export default theme;
