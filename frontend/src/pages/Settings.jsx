import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import {
  getSettings,
  updatePassword,
  updateSettings,
  updateUsername,
} from "../services/api";

const DEFAULT_PRINT_SETTINGS = {
  layout: "a4",
  thermal_size: "80mm",
  invoice_text_size: "medium",
  show_logo: true,
  show_barcode: true,
  show_batch_expiry: true,
  show_savings: true,
  auto_cut: false,
  footer_message: "Thank you for your business. Visit again.",
};

export default function Settings() {
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const userId = user.user_id || "admin";

  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);

  const [business, setBusiness] = useState({
    business_name: "",
    email: "",
    mobile: "",
    gst_number: "",
    address: "",
  });

  const [username, setUsername] = useState({
    new_user_id: "",
  });

  const [password, setPassword] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [printSettings, setPrintSettings] = useState(() => {
    try {
      return {
        ...DEFAULT_PRINT_SETTINGS,
        ...(JSON.parse(
          localStorage.getItem("billing_print_settings")
        ) || {}),
      };
    } catch {
      return DEFAULT_PRINT_SETTINGS;
    }
  });

  useEffect(() => {
    getSettings(userId)
      .then((data) => {
        setBusiness({
          business_name: data.business_name || "",
          email: data.email || "",
          mobile: data.mobile || "",
          gst_number: data.gst_number || "",
          address: data.address || "",
        });
        setUsername({
          new_user_id: data.user_id || userId,
        });
      })
      .catch((error) =>
        setMessage({
          type: "error",
          text: error.message,
        })
      );
  }, [userId]);

  const saveBusiness = async () => {
    try {
      setLoading(true);
      await updateSettings(userId, business);
      setMessage({
        type: "success",
        text: "Business profile updated successfully.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const saveUsername = async () => {
    if (!username.new_user_id) {
      setMessage({
        type: "warning",
        text: "Enter a new username.",
      });
      return;
    }

    try {
      await updateUsername(userId, username);
      alert("Username updated. Please login again.");
      localStorage.removeItem("user");
      window.location.href = "/";
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const savePassword = async () => {
    if (!password.old_password || !password.new_password) {
      setMessage({
        type: "warning",
        text: "Enter old and new password.",
      });
      return;
    }

    if (password.new_password !== password.confirm_password) {
      setMessage({
        type: "warning",
        text: "New password and confirmation do not match.",
      });
      return;
    }

    try {
      await updatePassword(userId, {
        old_password: password.old_password,
        new_password: password.new_password,
      });

      setPassword({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });

      setMessage({
        type: "success",
        text: "Password changed successfully.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const savePrintSettings = () => {
    localStorage.setItem(
      "billing_print_settings",
      JSON.stringify(printSettings)
    );
    setMessage({
      type: "success",
      text: "Print settings saved successfully.",
    });
  };

  const businessPanel = (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2.5,
                  bgcolor: "primary.light",
                  color: "primary.main",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <BusinessRoundedIcon />
              </Box>
              <Box>
                <Typography variant="h6">Business profile</Typography>
                <Typography variant="body2" color="text.secondary">
                  Information displayed on invoices and reports.
                </Typography>
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Business Name"
                  value={business.business_name}
                  onChange={(event) =>
                    setBusiness({
                      ...business,
                      business_name: event.target.value,
                    })
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="GST Number"
                  value={business.gst_number}
                  onChange={(event) =>
                    setBusiness({
                      ...business,
                      gst_number: event.target.value,
                    })
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Business Email"
                  value={business.email}
                  onChange={(event) =>
                    setBusiness({
                      ...business,
                      email: event.target.value,
                    })
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Mobile Number"
                  value={business.mobile}
                  onChange={(event) =>
                    setBusiness({
                      ...business,
                      mobile: event.target.value,
                    })
                  }
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Business Address"
                  value={business.address}
                  onChange={(event) =>
                    setBusiness({
                      ...business,
                      address: event.target.value,
                    })
                  }
                />
              </Grid>
            </Grid>

            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={saveBusiness}
              disabled={loading}
              sx={{ mt: 2.5 }}
            >
              {loading ? "Saving..." : "Save Business Profile"}
            </Button>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6">Invoice identity</Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              These details are used on bills, reports and customer statements.
            </Typography>

            <Box
              sx={{
                mt: 3,
                p: 2.5,
                borderRadius: 3,
                bgcolor: "#F8FAFC",
                border: "1px dashed #CBD5E1",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                BUSINESS NAME
              </Typography>
              <Typography fontWeight={800} mt={0.5}>
                {business.business_name || "Your Business"}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                {business.gst_number || "GST number not configured"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {business.mobile || "Mobile not configured"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {business.email || "Email not configured"}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const accountPanel = (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
              <PersonRoundedIcon color="primary" />
              <Box>
                <Typography variant="h6">Login Username</Typography>
                <Typography variant="body2" color="text.secondary">
                  Change the username used to sign in.
                </Typography>
              </Box>
            </Stack>

            <TextField
              fullWidth
              label="New Username"
              value={username.new_user_id}
              onChange={(event) =>
                setUsername({
                  new_user_id: event.target.value,
                })
              }
            />

            <Button
              fullWidth
              variant="contained"
              onClick={saveUsername}
              sx={{ mt: 2 }}
            >
              Update Username
            </Button>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
              <LockResetRoundedIcon color="warning" />
              <Box>
                <Typography variant="h6">Account security</Typography>
                <Typography variant="body2" color="text.secondary">
                  Use a strong, unique password.
                </Typography>
              </Box>
            </Stack>

            <Stack spacing={2}>
              <TextField
                fullWidth
                type="password"
                label="Current Password"
                value={password.old_password}
                onChange={(event) =>
                  setPassword({
                    ...password,
                    old_password: event.target.value,
                  })
                }
              />

              <TextField
                fullWidth
                type="password"
                label="New Password"
                value={password.new_password}
                onChange={(event) =>
                  setPassword({
                    ...password,
                    new_password: event.target.value,
                  })
                }
              />

              <TextField
                fullWidth
                type="password"
                label="Confirm New Password"
                value={password.confirm_password}
                onChange={(event) =>
                  setPassword({
                    ...password,
                    confirm_password: event.target.value,
                  })
                }
              />

              <Button
                color="warning"
                variant="contained"
                onClick={savePassword}
              >
                Change Password
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const printPanel = (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
              <PrintRoundedIcon color="primary" />
              <Box>
                <Typography variant="h6">Invoice Print Settings</Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure A4 and thermal invoice printing for this browser.
                </Typography>
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Default Print Layout"
                  value={printSettings.layout}
                  onChange={(event) =>
                    setPrintSettings({
                      ...printSettings,
                      layout: event.target.value,
                    })
                  }
                >
                  <MenuItem value="a4">A4 Tax Invoice</MenuItem>
                  <MenuItem value="thermal">Thermal Receipt</MenuItem>
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Thermal Paper Size"
                  value={printSettings.thermal_size}
                  disabled={printSettings.layout !== "thermal"}
                  onChange={(event) =>
                    setPrintSettings({
                      ...printSettings,
                      thermal_size: event.target.value,
                    })
                  }
                >
                  <MenuItem value="58mm">2 Inch / 58mm</MenuItem>
                  <MenuItem value="80mm">3 Inch / 80mm</MenuItem>
                  <MenuItem value="88mm">4 Inch / 88mm</MenuItem>
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Invoice Text Size"
                  value={printSettings.invoice_text_size}
                  onChange={(event) =>
                    setPrintSettings({
                      ...printSettings,
                      invoice_text_size: event.target.value,
                    })
                  }
                >
                  <MenuItem value="small">Small</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                </TextField>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Invoice Footer Message"
                  value={printSettings.footer_message}
                  onChange={(event) =>
                    setPrintSettings({
                      ...printSettings,
                      footer_message: event.target.value,
                    })
                  }
                />
              </Grid>
            </Grid>

            <Stack mt={2}>
              {[
                ["show_logo", "Show business logo"],
                ["show_barcode", "Show product barcode"],
                ["show_batch_expiry", "Show batch and expiry details"],
                ["show_savings", "Show MRP and customer savings"],
                ["auto_cut", "Auto-cut paper after printing (printer dependent)"],
              ].map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={Boolean(printSettings[key])}
                      onChange={(event) =>
                        setPrintSettings({
                          ...printSettings,
                          [key]: event.target.checked,
                        })
                      }
                    />
                  }
                  label={label}
                />
              ))}
            </Stack>

            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={savePrintSettings}
              sx={{ mt: 2 }}
            >
              Save Print Settings
            </Button>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6">Print Preview Summary</Typography>
            <Box
              sx={{
                mt: 2,
                p: 2.5,
                borderRadius: 3,
                bgcolor: "#F8FAFC",
                border: "1px dashed #CBD5E1",
              }}
            >
              <Typography fontWeight={800}>
                {printSettings.layout === "a4"
                  ? "A4 Tax Invoice"
                  : `Thermal ${printSettings.thermal_size}`}
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                Logo: {printSettings.show_logo ? "Visible" : "Hidden"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                MRP & Savings: {printSettings.show_savings ? "Visible" : "Hidden"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Batch & Expiry:{" "}
                {printSettings.show_batch_expiry ? "Visible" : "Hidden"}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        subtitle="Configure business identity, print layout, login account and security"
      />

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 2.5 }}>
          {message.text}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          <Tab
            icon={<BusinessRoundedIcon />}
            iconPosition="start"
            label="Business Profile"
          />
          <Tab
            icon={<PrintRoundedIcon />}
            iconPosition="start"
            label="Print Settings"
          />
          <Tab
            icon={<PersonRoundedIcon />}
            iconPosition="start"
            label="Account & Security"
          />
        </Tabs>
      </Card>

      {tab === 0 && businessPanel}
      {tab === 1 && printPanel}
      {tab === 2 && accountPanel}
    </AppLayout>
  );
}
