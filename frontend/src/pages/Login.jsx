import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress,
  FormControlLabel, IconButton, InputAdornment, Stack, TextField, Typography,
} from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import { getSetupStatus, loginUser } from "../services/api";
import logo from "../assets/Resolvent-Logo.jpg";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ user_id: "", password: "" });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Desktop-only first-run check: a brand-new local SQLite database has no
  // admin account yet, so there is no one who could log in here at all --
  // send the shop owner straight to account creation instead. Gated on
  // window.electronAPI so this never runs (and never adds an extra request)
  // on the web build, where every business already has an admin by
  // definition.
  useEffect(() => {
    if (!window.electronAPI) return;
    let cancelled = false;
    getSetupStatus()
      .then(({ has_admin }) => {
        if (!cancelled && !has_admin) navigate("/signup", { replace: true });
      })
      .catch(() => {
        // If the local backend isn't reachable yet or the check fails for
        // any reason, fall back to showing the normal login form rather
        // than blocking the app on this check.
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.user_id.trim() || !form.password) return setError("Enter your username and password.");
    try {
      setLoading(true);
      const user = await loginUser({ user_id: form.user_id.trim(), password: form.password });
      localStorage.setItem("user", JSON.stringify(user));
      if (user.access_token) localStorage.setItem("token", user.access_token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.08fr .92fr" }, bgcolor: "#F8FAFC" }}>
      <Box sx={{ display: { xs: "none", lg: "flex" }, position: "relative", overflow: "hidden", p: 8, flexDirection: "column", justifyContent: "space-between", color: "white", background: "linear-gradient(145deg,#081225 0%,#102554 55%,#2563EB 135%)" }}>
        <Box sx={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", bgcolor: "rgba(37,99,235,.22)", right: -120, top: -100 }} />
        <Box sx={{ position: "absolute", width: 280, height: 280, borderRadius: "50%", border: "1px solid rgba(255,255,255,.12)", left: -90, bottom: -90 }} />
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ zIndex: 1 }}>
          <Box sx={{ width: 46, height: 46, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#2563EB" }}><ReceiptLongRoundedIcon /></Box>
          <Box><Typography fontSize={19} fontWeight={850}>Billing 24×7</Typography><Typography variant="caption" sx={{ color: "#B9C7DD" }}>by Resolvent</Typography></Box>
        </Stack>
        <Box sx={{ zIndex: 1, maxWidth: 590 }}>
          <Typography variant="h2" fontWeight={850} lineHeight={1.1} letterSpacing="-.045em">Billing that keeps your business moving.</Typography>
          <Typography sx={{ mt: 2.5, color: "#CBD5E1", fontSize: 18, lineHeight: 1.7 }}>Create GST-ready invoices, manage inventory, track credit, and review sales from one secure workspace.</Typography>
          <Stack direction="row" spacing={4} sx={{ mt: 5 }}>
            {[['Fast','Billing'],['Clear','Reports'],['Secure','Access']].map(([a,b]) => <Box key={a}><Typography fontSize={24} fontWeight={850}>{a}</Typography><Typography sx={{ color: "#94A3B8" }}>{b}</Typography></Box>)}
          </Stack>
        </Box>
        <Typography variant="caption" sx={{ color: "#7F93B3", zIndex: 1 }}>© 2026 Resolvent IT Services Pvt. Ltd.</Typography>
      </Box>

      <Box sx={{ display: "grid", placeItems: "center", p: { xs: 2.5, sm: 5 } }}>
        <Box sx={{ width: "100%", maxWidth: 470 }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <img src={logo} alt="Resolvent" style={{ width: 190, maxHeight: 74, objectFit: "contain" }} />
          </Box>
          <Card sx={{ borderRadius: 4, boxShadow: "0 24px 70px rgba(15,23,42,.12)" }}>
            <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
              <Typography variant="h4">Welcome back</Typography>
              <Typography color="text.secondary" sx={{ mt: 1, mb: 3.5 }}>Sign in to manage billing and business operations.</Typography>
              {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
              <Box component="form" onSubmit={submit}>
                <Stack spacing={2.2}>
                  <TextField label="Username" autoComplete="username" autoFocus value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon color="action" /></InputAdornment> }} />
                  <TextField label="Password" type={show ? "text" : "password"} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><LockRoundedIcon color="action" /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShow(!show)} edge="end">{show ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</IconButton></InputAdornment> }} />
                  <FormControlLabel control={<Checkbox size="small" />} label={<Typography variant="body2">Remember me on this device</Typography>} />
                  <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ height: 50 }}>{loading ? <CircularProgress size={23} color="inherit" /> : "Sign in securely"}</Button>
                </Stack>
              </Box>
              <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mt: 3 }}>New to Billing 24×7? <Box component="span" onClick={() => navigate("/signup")} sx={{ color: "primary.main", fontWeight: 750, cursor: "pointer" }}>Create business account</Box></Typography>
            </CardContent>
          </Card>
          <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ mt: 2.5 }}>Secure business login · Version 1.0</Typography>
        </Box>
      </Box>
    </Box>
  );
}
