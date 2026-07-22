import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, CircularProgress, Grid, Stack, TextField, Typography } from "@mui/material";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import { signupUser } from "../services/api";
import logo from "../assets/Resolvent-Logo.jpg";

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ business_name: "", user_id: "", password: "", email: "", mobile: "", logo: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const change = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (!form.business_name || !form.user_id || !form.email || form.password.length < 6) return setError("Complete all required fields. Password must contain at least 6 characters.");
    try { setLoading(true); await signupUser(form); navigate("/", { replace: true }); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return <Box sx={{ minHeight: "100vh", bgcolor: "#F4F7FB", py: { xs: 3, md: 6 }, px: 2 }}>
    <Box sx={{ maxWidth: 880, mx: "auto" }}>
      <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}><img src={logo} alt="Resolvent" style={{ width: 180, maxHeight: 70, objectFit: "contain" }} /><Typography variant="h4">Create your workspace</Typography><Typography color="text.secondary">Set up Billing 24×7 for your business.</Typography></Stack>
      <Card sx={{ borderRadius: 4 }}><CardContent sx={{ p: { xs: 3, md: 5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}><Box sx={{ p: 1.2, borderRadius: 2, bgcolor: "primary.light", color: "primary.main", display: "flex" }}><BusinessRoundedIcon /></Box><Box><Typography variant="h6">Business account details</Typography><Typography variant="body2" color="text.secondary">You can update these later from Settings.</Typography></Box></Stack>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        <Box component="form" onSubmit={submit}><Grid container spacing={2.5}>
          <Grid size={{ xs: 12 }}><TextField required label="Business Name" value={form.business_name} onChange={change("business_name")} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField required label="Username" value={form.user_id} onChange={change("user_id")} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField required label="Password" type="password" helperText="Minimum 6 characters" value={form.password} onChange={change("password")} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField required label="Business Email" type="email" value={form.email} onChange={change("email")} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField label="Mobile Number" value={form.mobile} onChange={change("mobile")} /></Grid>
          <Grid size={{ xs: 12 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><Button type="submit" size="large" variant="contained" disabled={loading} sx={{ minWidth: 220 }}>{loading ? <CircularProgress size={22} color="inherit" /> : "Create business account"}</Button><Button size="large" onClick={() => navigate("/")}>Back to sign in</Button></Stack></Grid>
        </Grid></Box>
      </CardContent></Card>
    </Box>
  </Box>;
}
