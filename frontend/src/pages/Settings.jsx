import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import UploadRoundedIcon from "@mui/icons-material/UploadRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import PrintDesignerPreview from "../components/PrintDesignerPreview";
import AppTable from "../components/AppTable";
import ActionButton from "../components/ActionButton";
import {
  getSettings,
  getLoyaltySettings,
  getAISettings,
  testAIConnection,
  updateAISettings,
  updateLoyaltySettings,
  updatePassword,
  updateSettings,
  updateUsername,
  createEmployee,
  getEmployees,
  updateEmployee,
  resetEmployeePassword,
  setEmployeeActive,
} from "../services/api";
import {
  DEFAULT_UPI_SETTINGS,
  isValidUpiId,
} from "../utils/upi";

const DEFAULT_PRINT_SETTINGS = {
  layout: "a4",
  thermal_size: "80mm",
  invoice_text_size: "medium",
  invoice_theme: "professional",
  header_alignment: "left",
  logo_position: "left",
  logo_width: 90,
  logo_height: 60,
  show_logo: true,
  show_business_details: true,
  show_customer_details: true,
  show_barcode: true,
  show_batch_expiry: true,
  show_savings: true,
  show_payment_qr: true,
  show_footer: true,
  auto_cut: false,
  footer_message: "Thank you for your business. Visit again.",
};

const DEFAULT_LOYALTY_SETTINGS = {
  enabled: true,
  earn_amount: 100,
  points_per_earn_amount: 1,
  point_value: 1,
  minimum_redeem_points: 10,
  max_redeem_percent: 20,
  silver_threshold: 10000,
  gold_threshold: 25000,
  platinum_threshold: 50000,
};

const loadJson = (key, fallback) => {
  try {
    return {
      ...fallback,
      ...(JSON.parse(localStorage.getItem(key)) || {}),
    };
  } catch {
    return fallback;
  }
};

const PERMISSION_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "create_bill", label: "Create Bill" },
  { key: "credit_customers", label: "Credit Customers" },
  { key: "returns_inventory", label: "Returns & Inventory" },
  { key: "sales_report", label: "Sales Report (own bills only)" },
  { key: "settings_print", label: "Settings → Print Setting" },
  { key: "settings_ai", label: "Settings → AI Setting" },
];

const EMPTY_PERMISSIONS = PERMISSION_MODULES.reduce(
  (acc, m) => ({ ...acc, [m.key]: false }),
  {}
);

export default function Settings() {
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const userId = user.user_id || "admin";
  // Accounts created before Sprint 7 have no `role` stored -- treat that as
  // admin, since that was the only kind of account that existed then.
  const isAdmin = user.role !== "employee";
  const myPermissions = user.permissions || {};

  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);

  // --- Sprint 7: employee accounts (Admin-only tab) ---------------------
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeDialog, setEmployeeDialog] = useState(null); // null | "create" | employee object being edited
  const [employeeForm, setEmployeeForm] = useState({ user_id: "", name: "", password: "", permissions: EMPTY_PERMISSIONS });
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [revealedCredentials, setRevealedCredentials] = useState(null); // { user_id, password } shown once after create/reset

  const loadEmployees = () => {
    if (!isAdmin) return;
    setEmployeesLoading(true);
    getEmployees()
      .then(setEmployees)
      .catch((err) => setMessage({ type: "error", text: err.message || "Failed to load employees" }))
      .finally(() => setEmployeesLoading(false));
  };

  useEffect(() => {
    if (isAdmin) loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateEmployee = () => {
    setEmployeeForm({ user_id: "", name: "", password: "", permissions: EMPTY_PERMISSIONS });
    setEmployeeDialog("create");
  };

  const openEditEmployee = (emp) => {
    setEmployeeForm({
      user_id: emp.user_id,
      name: emp.name || "",
      password: "",
      permissions: { ...EMPTY_PERMISSIONS, ...(emp.permissions || {}) },
    });
    setEmployeeDialog(emp);
  };

  const closeEmployeeDialog = () => setEmployeeDialog(null);

  const toggleEmployeePermission = (key) => {
    setEmployeeForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  };

  const saveEmployee = async () => {
    setEmployeeSaving(true);
    try {
      if (employeeDialog === "create") {
        if (!employeeForm.user_id.trim() || !employeeForm.name.trim()) {
          setMessage({ type: "error", text: "Username and name are required." });
          return;
        }
        const result = await createEmployee({
          user_id: employeeForm.user_id.trim(),
          name: employeeForm.name.trim(),
          password: employeeForm.password.trim() || null,
          permissions: employeeForm.permissions,
        });
        setRevealedCredentials({ user_id: employeeForm.user_id.trim(), password: result.password });
        setMessage({ type: "success", text: "Employee created. Share the credentials shown below with them now -- the password won't be shown again." });
      } else {
        await updateEmployee(employeeDialog.id, {
          name: employeeForm.name.trim(),
          permissions: employeeForm.permissions,
        });
        setMessage({ type: "success", text: "Employee updated." });
      }
      closeEmployeeDialog();
      loadEmployees();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to save employee" });
    } finally {
      setEmployeeSaving(false);
    }
  };

  const handleResetPassword = async (emp) => {
    try {
      const result = await resetEmployeePassword(emp.id, null);
      setRevealedCredentials({ user_id: emp.user_id, password: result.password });
      setMessage({ type: "success", text: `Password reset for ${emp.user_id}. Share the new password shown below with them now.` });
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to reset password" });
    }
  };

  const handleToggleActive = async (emp) => {
    try {
      await setEmployeeActive(emp.id, !emp.is_active);
      loadEmployees();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to update employee" });
    }
  };

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

  const [printSettings, setPrintSettings] = useState(() =>
    loadJson("billing_print_settings", DEFAULT_PRINT_SETTINGS)
  );

  const [upiSettings, setUpiSettings] = useState(() =>
    loadJson("billing_upi_settings", DEFAULT_UPI_SETTINGS)
  );

  const [loyaltySettings, setLoyaltySettings] = useState(
    DEFAULT_LOYALTY_SETTINGS
  );
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  const [aiSettings, setAISettings] = useState({
    enabled: false,
    provider: "openai",
    model: "gpt-5-mini",
    api_key: "",
    api_key_configured: false,
    api_key_masked: "",
    base_url: "http://127.0.0.1:11434",
    ollama_mode: "local",
  });
  const [aiSaving, setAISaving] = useState(false);
  const [aiTesting, setAITesting] = useState(false);

  const logoInputRef = useRef(null);
  const [businessLogo, setBusinessLogo] = useState(
    localStorage.getItem("billing_business_logo") || "/resolvent-logo.jpg"
  );

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
        setMessage({ type: "error", text: error.message })
      );
  }, [userId]);

  useEffect(() => {
    getLoyaltySettings()
      .then((data) =>
        setLoyaltySettings({
          ...DEFAULT_LOYALTY_SETTINGS,
          ...(data || {}),
        })
      )
      .catch((error) =>
        setMessage({
          type: "error",
          text: error.message,
        })
      );
  }, []);

  useEffect(() => {
    getAISettings()
      .then((data) =>
        setAISettings((current) => ({
          ...current,
          ...(data || {}),
          api_key: "",
        }))
      )
      .catch(() => {});
  }, []);

  const updateAISetting = (key, value) => {
    setAISettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateLoyaltySetting = (key, value) => {
    setLoyaltySettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updatePrintSetting = (key, value) => {
    setPrintSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateUpiSetting = (key, value) => {
    setUpiSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({
        type: "warning",
        text: "Please select a valid image file.",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({
        type: "warning",
        text: "Logo file must be 2 MB or smaller.",
      });
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const logoData = String(reader.result || "");
      setBusinessLogo(logoData);
      localStorage.setItem("billing_business_logo", logoData);
      setMessage({
        type: "success",
        text: "Business logo updated successfully.",
      });
    };

    reader.onerror = () =>
      setMessage({
        type: "error",
        text: "Unable to read the selected logo file.",
      });

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const removeBusinessLogo = () => {
    localStorage.removeItem("billing_business_logo");
    setBusinessLogo("/resolvent-logo.jpg");
    setMessage({
      type: "success",
      text: "Default Resolvent logo restored.",
    });
  };

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

  const savePrintSettings = () => {
    localStorage.setItem(
      "billing_print_settings",
      JSON.stringify(printSettings)
    );
    setMessage({
      type: "success",
      text: "Print designer settings saved successfully.",
    });
  };

  const saveUpiSettings = () => {
    if (
      upiSettings.enabled &&
      !isValidUpiId(upiSettings.upi_id)
    ) {
      setMessage({
        type: "warning",
        text: "Enter a valid UPI ID, for example business@bank.",
      });
      return;
    }

    if (
      upiSettings.enabled &&
      !String(upiSettings.payee_name || "").trim()
    ) {
      setMessage({
        type: "warning",
        text: "Payee name is required when UPI QR is enabled.",
      });
      return;
    }

    localStorage.setItem(
      "billing_upi_settings",
      JSON.stringify(upiSettings)
    );
    setMessage({
      type: "success",
      text: "UPI payment QR settings saved successfully.",
    });
  };

  const saveLoyaltySettings = async () => {
    try {
      setLoyaltySaving(true);

      await updateLoyaltySettings({
        ...loyaltySettings,
        earn_amount: Number(loyaltySettings.earn_amount || 0),
        points_per_earn_amount: Number(
          loyaltySettings.points_per_earn_amount || 0
        ),
        point_value: Number(loyaltySettings.point_value || 0),
        minimum_redeem_points: Number(
          loyaltySettings.minimum_redeem_points || 0
        ),
        max_redeem_percent: Number(
          loyaltySettings.max_redeem_percent || 0
        ),
        silver_threshold: Number(
          loyaltySettings.silver_threshold || 0
        ),
        gold_threshold: Number(
          loyaltySettings.gold_threshold || 0
        ),
        platinum_threshold: Number(
          loyaltySettings.platinum_threshold || 0
        ),
      });

      setMessage({
        type: "success",
        text: "Customer loyalty settings saved successfully.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    } finally {
      setLoyaltySaving(false);
    }
  };

  const saveAISettings = async () => {
    try {
      setAISaving(true);
      await updateAISettings({
        enabled: Boolean(aiSettings.enabled),
        provider: aiSettings.provider,
        model: aiSettings.model || null,
        api_key: aiSettings.api_key || null,
        base_url: aiSettings.base_url || null,
        ollama_mode: aiSettings.ollama_mode || "local",
      });
      const refreshed = await getAISettings();
      setAISettings((current) => ({
        ...current,
        ...refreshed,
        api_key: "",
      }));
      setMessage({ type: "success", text: "AI configuration saved securely." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setAISaving(false);
    }
  };

  const testConfiguredAI = async () => {
    try {
      setAITesting(true);

      await updateAISettings({
        enabled: Boolean(aiSettings.enabled),
        provider: aiSettings.provider,
        model: aiSettings.model || null,
        api_key: aiSettings.api_key || null,
        base_url: aiSettings.base_url || null,
        ollama_mode: aiSettings.ollama_mode || "local",
      });

      const result = await testAIConnection();

      setMessage({
        type: "success",
        text:
          result.message ||
          "AI connection successful.",
      });

      const refreshed = await getAISettings();
      setAISettings((current) => ({
        ...current,
        ...refreshed,
        api_key: "",
      }));
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    } finally {
      setAITesting(false);
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

  const businessPanel = (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3.5}>
              <BusinessRoundedIcon color="primary" />
              <Box>
                <Typography variant="h6">Business profile</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Information displayed on invoices and reports.
                </Typography>
              </Box>
            </Stack>

            <Box
              sx={{
                mb: 3,
                p: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 3,
                display: "flex",
                gap: 2,
                alignItems: "center",
                flexDirection: { xs: "column", sm: "row" },
              }}
            >
              <Avatar
                variant="rounded"
                src={businessLogo}
                sx={{
                  width: 100,
                  height: 76,
                  bgcolor: "background.default",
                  border: "1px solid",
                  borderColor: "divider",
                  "& img": { objectFit: "contain", p: 0.5 },
                }}
              />

              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={800}>Business Logo</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Upload PNG, JPG or WEBP up to 2 MB.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
                  <Button
                    variant="outlined"
                    startIcon={<UploadRoundedIcon />}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    Upload Logo
                  </Button>
                  <Button
                    color="error"
                    startIcon={<DeleteOutlineRoundedIcon />}
                    onClick={removeBusinessLogo}
                  >
                    Restore Default
                  </Button>
                </Stack>
                <input
                  hidden
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                />
              </Box>
            </Box>

            <Grid container spacing={2.25}>
              {[
                ["Business Name", "business_name"],
                ["GST Number", "gst_number"],
                ["Business Email", "email"],
                ["Mobile Number", "mobile"],
              ].map(([label, key]) => (
                <Grid key={key} size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label={label}
                    value={business[key]}
                    onChange={(event) =>
                      setBusiness({
                        ...business,
                        [key]: event.target.value,
                      })
                    }
                  />
                </Grid>
              ))}

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
            <Box
              sx={{
                mt: 2,
                p: 2.5,
                borderRadius: 3,
                bgcolor: "#F8FAFC",
                border: "1px dashed #CBD5E1",
              }}
            >
              <Box
                component="img"
                src={businessLogo}
                alt="Business Logo"
                sx={{
                  width: 90,
                  height: 58,
                  objectFit: "contain",
                  display: "block",
                  mb: 1.5,
                }}
              />
              <Typography fontWeight={800}>
                {business.business_name || "Your Business"}
              </Typography>
              <Typography variant="body2">
                GSTIN: {business.gst_number || "Not configured"}
              </Typography>
              <Typography variant="body2">{business.mobile || "-"}</Typography>
              <Typography variant="body2">{business.email || "-"}</Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const designerPanel = (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Stack spacing={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6">Invoice layout</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                Configure paper, theme, alignment and visible invoice sections. Theme changes appear instantly in Live Invoice Preview.
              </Typography>

              <Grid container spacing={2.25}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    select
                    label="Print Layout"
                    value={printSettings.layout}
                    onChange={(e) => updatePrintSetting("layout", e.target.value)}
                  >
                    <MenuItem value="a4">A4 Tax Invoice</MenuItem>
                    <MenuItem value="thermal">Thermal Receipt</MenuItem>
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    select
                    label="Thermal Paper"
                    value={printSettings.thermal_size}
                    disabled={printSettings.layout !== "thermal"}
                    onChange={(e) => updatePrintSetting("thermal_size", e.target.value)}
                  >
                    <MenuItem value="58mm">2 Inch / 58mm</MenuItem>
                    <MenuItem value="80mm">3 Inch / 80mm</MenuItem>
                    <MenuItem value="88mm">4 Inch / 88mm</MenuItem>
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    select
                    label="Invoice Theme"
                    value={printSettings.invoice_theme}
                    onChange={(e) => updatePrintSetting("invoice_theme", e.target.value)}
                  >
                    <MenuItem value="professional">
                      Professional Blue
                    </MenuItem>
                    <MenuItem value="modern">
                      Modern Green
                    </MenuItem>
                    <MenuItem value="minimal">
                      Premium Black
                    </MenuItem>
                    <MenuItem value="retail">
                      Elegant Purple
                    </MenuItem>
                    <MenuItem value="classic">
                      Classic Orange
                    </MenuItem>
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    select
                    label="Text Size"
                    value={printSettings.invoice_text_size}
                    onChange={(e) => updatePrintSetting("invoice_text_size", e.target.value)}
                  >
                    <MenuItem value="small">Small</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="large">Large</MenuItem>
                  </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    select
                    label="Header Alignment"
                    value={printSettings.header_alignment}
                    onChange={(e) => updatePrintSetting("header_alignment", e.target.value)}
                  >
                    <MenuItem value="left">Left</MenuItem>
                    <MenuItem value="center">Center</MenuItem>
                    <MenuItem value="right">Right</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography fontWeight={800}>Logo placement</Typography>
              <Grid container spacing={2.25} sx={{ mt: 0.25 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    select
                    label="Logo Position"
                    value={printSettings.logo_position}
                    onChange={(e) => updatePrintSetting("logo_position", e.target.value)}
                  >
                    <MenuItem value="left">Left</MenuItem>
                    <MenuItem value="center">Center</MenuItem>
                    <MenuItem value="right">Right</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2">Logo Width: {printSettings.logo_width}px</Typography>
                  <Slider
                    value={Number(printSettings.logo_width)}
                    min={40}
                    max={160}
                    onChange={(_, value) => updatePrintSetting("logo_width", value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="body2">Logo Height: {printSettings.logo_height}px</Typography>
                  <Slider
                    value={Number(printSettings.logo_height)}
                    min={30}
                    max={120}
                    onChange={(_, value) => updatePrintSetting("logo_height", value)}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography fontWeight={800} mb={1}>Visible information</Typography>
              <Grid container>
                {[
                  ["show_logo", "Business logo"],
                  ["show_business_details", "Business details"],
                  ["show_customer_details", "Customer details"],
                  ["show_barcode", "Barcode"],
                  ["show_batch_expiry", "Batch and expiry"],
                  ["show_savings", "MRP and savings"],
                  ["show_payment_qr", "UPI payment QR"],
                  ["show_footer", "Invoice footer"],
                  ["auto_cut", "Auto-cut thermal paper"],
                ].map(([key, label]) => (
                  <Grid key={key} size={{ xs: 12, sm: 6 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(printSettings[key])}
                          onChange={(event) =>
                            updatePrintSetting(key, event.target.checked)
                          }
                        />
                      }
                      label={label}
                    />
                  </Grid>
                ))}
              </Grid>

              {printSettings.layout === "thermal" && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Receipt length is calculated automatically from the actual
                  invoice content, including product count, totals, QR and footer.
                  In Chrome/Edge Print → More settings, turn OFF
                  "Headers and footers" to prevent the browser date and website URL
                  from printing above or below the receipt.
                </Alert>
              )}

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Invoice Footer Message"
                value={printSettings.footer_message}
                onChange={(e) => updatePrintSetting("footer_message", e.target.value)}
                sx={{ mt: 2 }}
              />

              <Button
                variant="contained"
                startIcon={<SaveRoundedIcon />}
                onClick={savePrintSettings}
                sx={{ mt: 2.5 }}
              >
                Save Print Designer
              </Button>
            </CardContent>
          </Card>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card sx={{ position: { lg: "sticky" }, top: { lg: 90 } }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6">Live Invoice Preview</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
              This preview now uses the exact same invoice renderer as the final print.
            </Typography>
            <PrintDesignerPreview
              business={business}
              businessLogo={businessLogo}
              printSettings={printSettings}
              upiSettings={upiSettings}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const paymentPanel = (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
              <PaymentsRoundedIcon color="primary" />
              <Box>
                <Typography variant="h6">UPI Payment QR</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Generate an invoice QR using the final payable amount.
                </Typography>
              </Box>
            </Stack>

            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(upiSettings.enabled)}
                  onChange={(e) => updateUpiSetting("enabled", e.target.checked)}
                />
              }
              label="Enable UPI QR on invoices"
            />

            <Grid container spacing={2.25} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="UPI ID"
                  placeholder="business@bank"
                  value={upiSettings.upi_id}
                  onChange={(e) => updateUpiSetting("upi_id", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Payee / Business Name"
                  value={upiSettings.payee_name}
                  onChange={(e) => updateUpiSetting("payee_name", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Merchant City"
                  value={upiSettings.merchant_city}
                  onChange={(e) => updateUpiSetting("merchant_city", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Payment Note"
                  value={upiSettings.payment_note}
                  onChange={(e) => updateUpiSetting("payment_note", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="QR Position"
                  value={upiSettings.qr_position}
                  onChange={(e) => updateUpiSetting("qr_position", e.target.value)}
                >
                  <MenuItem value="below_total">Below Grand Total</MenuItem>
                  <MenuItem value="footer">Invoice Footer</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2">QR Size: {upiSettings.qr_size}px</Typography>
                <Slider
                  min={90}
                  max={220}
                  value={Number(upiSettings.qr_size)}
                  onChange={(_, value) => updateUpiSetting("qr_size", value)}
                />
              </Grid>
            </Grid>

            <Grid container sx={{ mt: 1 }}>
              {[
                ["include_amount", "Include exact invoice amount"],
                ["show_upi_id", "Show UPI ID below QR"],
                ["show_invoice_number", "Include invoice number in payment note"],
                ["show_customer_name", "Include customer name in payment note"],
                ["show_for_cash", "Show QR for cash invoices"],
              ].map(([key, label]) => (
                <Grid key={key} size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(upiSettings[key])}
                        onChange={(e) => updateUpiSetting(key, e.target.checked)}
                      />
                    }
                    label={label}
                  />
                </Grid>
              ))}
            </Grid>

            <Alert severity="info" sx={{ mt: 2 }}>
              The QR requests payment but does not automatically confirm that payment was received.
            </Alert>

            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={saveUpiSettings}
              sx={{ mt: 2.5 }}
            >
              Save Payment QR Settings
            </Button>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card sx={{ position: { lg: "sticky" }, top: { lg: 90 } }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <QrCode2RoundedIcon color="primary" />
              <Typography variant="h6">Payment Preview</Typography>
            </Stack>
            <PrintDesignerPreview
              business={business}
              businessLogo={businessLogo}
              printSettings={{
                ...printSettings,
                show_payment_qr: true,
              }}
              upiSettings={upiSettings}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const loyaltyPanel = (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              mb={3}
            >
              <WorkspacePremiumRoundedIcon color="primary" />
              <Box>
                <Typography variant="h6">
                  Customer Loyalty Program
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Configure how customers earn and redeem loyalty points.
                </Typography>
              </Box>
            </Stack>

            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(loyaltySettings.enabled)}
                  onChange={(event) =>
                    updateLoyaltySetting(
                      "enabled",
                      event.target.checked
                    )
                  }
                />
              }
              label="Enable customer loyalty program"
            />

            <Divider sx={{ my: 2.5 }} />

            <Typography fontWeight={800} mb={1.5}>
              Earning Rules
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  type="number"
                  label="Spend Amount (₹)"
                  value={loyaltySettings.earn_amount}
                  onChange={(event) =>
                    updateLoyaltySetting(
                      "earn_amount",
                      event.target.value
                    )
                  }
                  helperText="Example: ₹100 purchase"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  type="number"
                  label="Base Points Earned"
                  value={
                    loyaltySettings.points_per_earn_amount
                  }
                  onChange={(event) =>
                    updateLoyaltySetting(
                      "points_per_earn_amount",
                      event.target.value
                    )
                  }
                  helperText="Example: earn 1 point for every ₹100"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2.5 }} />

            <Typography fontWeight={800} mb={1.5}>
              Redemption Rules
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  type="number"
                  label="1 Point Value (₹)"
                  value={loyaltySettings.point_value}
                  onChange={(event) =>
                    updateLoyaltySetting(
                      "point_value",
                      event.target.value
                    )
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  type="number"
                  label="Minimum Redeem Points"
                  value={
                    loyaltySettings.minimum_redeem_points
                  }
                  onChange={(event) =>
                    updateLoyaltySetting(
                      "minimum_redeem_points",
                      event.target.value
                    )
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  type="number"
                  label="Max Bill Redemption %"
                  value={
                    loyaltySettings.max_redeem_percent
                  }
                  onChange={(event) =>
                    updateLoyaltySetting(
                      "max_redeem_percent",
                      event.target.value
                    )
                  }
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2.5 }} />

            <Typography fontWeight={800} mb={1.5}>
              Membership Tiers
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              Point earning multiplier: Regular 1×, Silver 1.25×,
              Gold 1.5× and Platinum 2×.
            </Alert>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  type="number"
                  label="Silver Spend (₹)"
                  value={
                    loyaltySettings.silver_threshold
                  }
                  onChange={(event) =>
                    updateLoyaltySetting(
                      "silver_threshold",
                      event.target.value
                    )
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  type="number"
                  label="Gold Spend (₹)"
                  value={
                    loyaltySettings.gold_threshold
                  }
                  onChange={(event) =>
                    updateLoyaltySetting(
                      "gold_threshold",
                      event.target.value
                    )
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  type="number"
                  label="Platinum Spend (₹)"
                  value={
                    loyaltySettings.platinum_threshold
                  }
                  onChange={(event) =>
                    updateLoyaltySetting(
                      "platinum_threshold",
                      event.target.value
                    )
                  }
                />
              </Grid>
            </Grid>

            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={saveLoyaltySettings}
              disabled={loyaltySaving}
              sx={{ mt: 3 }}
            >
              {loyaltySaving
                ? "Saving..."
                : "Save Loyalty Settings"}
            </Button>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6">
              Example
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, mb: 2.5 }}
            >
              Preview of the current loyalty rule.
            </Typography>

            <Stack spacing={1.5}>
              <Paper
                variant="outlined"
                sx={{ p: 2, borderRadius: 3 }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Spend
                </Typography>
                <Typography variant="h5" fontWeight={900}>
                  ₹1,000
                </Typography>
              </Paper>

              <Paper
                variant="outlined"
                sx={{ p: 2, borderRadius: 3 }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Regular Member Earns
                </Typography>
                <Typography variant="h5" fontWeight={900}>
                  {(
                    (1000 /
                      Math.max(
                        1,
                        Number(
                          loyaltySettings.earn_amount || 1
                        )
                      )) *
                    Number(
                      loyaltySettings.points_per_earn_amount ||
                        0
                    )
                  ).toFixed(2)}{" "}
                  Points
                </Typography>
              </Paper>

              <Paper
                variant="outlined"
                sx={{ p: 2, borderRadius: 3 }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  100 Points Worth
                </Typography>
                <Typography variant="h5" fontWeight={900}>
                  ₹
                  {(
                    100 *
                    Number(loyaltySettings.point_value || 0)
                  ).toFixed(2)}
                </Typography>
              </Paper>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const aiPanel = (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
              <AutoAwesomeRoundedIcon color="primary" />
              <Box>
                <Typography variant="h6">AI Configuration</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Connect your own AI provider. If AI is disabled or no provider is configured,
                  billing and manual purchase entry continue to work normally.
                </Typography>
              </Box>
            </Stack>

            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(aiSettings.enabled)}
                  onChange={(e) => updateAISetting("enabled", e.target.checked)}
                />
              }
              label="Enable AI features"
            />

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select fullWidth label="AI Provider"
                  value={aiSettings.provider}
                  onChange={(e) => {
                    const provider=e.target.value;
                    const defaults={
                      openai:"gpt-5-mini",
                      gemini:"gemini-2.5-flash",
                      claude:"claude-sonnet-4-5",
                      ollama:"gemma3",
                    };
                    setAISettings((current)=>({
                      ...current, provider, model:defaults[provider] || "", api_key:""
                    }));
                  }}
                >
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="gemini">Google Gemini</MenuItem>
                  <MenuItem value="claude">Anthropic Claude</MenuItem>
                  <MenuItem value="ollama">Ollama</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth label="Model"
                  value={aiSettings.model || ""}
                  onChange={(e)=>updateAISetting("model",e.target.value)}
                  helperText="You can change the model without changing application code."
                />
              </Grid>

              {aiSettings.provider === "ollama" && (
                <Grid size={{ xs: 12 }}>
                  <Alert
                    severity={
                      aiSettings.ollama_mode === "cloud"
                        ? "success"
                        : "info"
                    }
                  >
                    {aiSettings.ollama_mode === "cloud"
                      ? "Ollama Cloud works with the hosted Billing Software. Use https://ollama.com, enter your Ollama API key, and select a cloud-capable model."
                      : "Local Ollama needs no API key, but localhost works only when FastAPI can reach Ollama on the same computer/network. A Render-hosted backend cannot reach Ollama on your Windows localhost."}
                  </Alert>
                </Grid>
              )}

              {aiSettings.provider === "ollama" && (
                <>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      select fullWidth label="Ollama Mode"
                      value={aiSettings.ollama_mode || "local"}
                      onChange={(e) => {
                        const mode = e.target.value;
                        setAISettings((current) => ({
                          ...current,
                          ollama_mode: mode,
                          base_url:
                            mode === "cloud"
                              ? "https://ollama.com"
                              : "http://127.0.0.1:11434",
                          model:
                            mode === "cloud"
                              ? (String(current.model || "").includes(":cloud")
                                  ? current.model
                                  : "mistral-large-3")
                              : (String(current.model || "").includes(":cloud")
                                  ? "gemma3"
                                  : current.model),
                          api_key: "",
                        }));
                      }}
                    >
                      <MenuItem value="local">Local</MenuItem>
                      <MenuItem value="cloud">Ollama Cloud / Remote</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth label="Base URL"
                      value={aiSettings.base_url || ""}
                      onChange={(e)=>updateAISetting("base_url",e.target.value)}
                      helperText={
                        aiSettings.ollama_mode === "cloud"
                          ? "Ollama Cloud: https://ollama.com"
                          : "Local Ollama: http://127.0.0.1:11434"
                      }
                    />
                  </Grid>
                </>
              )}

              {(aiSettings.provider !== "ollama" || aiSettings.ollama_mode === "cloud") && (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    type="password"
                    label={
                      aiSettings.provider === "ollama"
                        ? "Ollama Cloud API Key"
                        : "API Key"
                    }
                    value={aiSettings.api_key || ""}
                    placeholder={
                      aiSettings.api_key_configured
                        ? aiSettings.api_key_masked || "Key already configured"
                        : "Paste API key"
                    }
                    onChange={(e)=>updateAISetting("api_key",e.target.value)}
                    helperText={
                      aiSettings.api_key_configured
                        ? `Stored securely on the backend (${aiSettings.api_key_masked}). Leave blank to keep the existing key.`
                        : "The key is sent to the backend and is not saved in browser localStorage."
                    }
                  />
                </Grid>
              )}
            </Grid>

            <Stack direction={{ xs:"column", sm:"row" }} spacing={1.5} sx={{ mt:3 }}>
              <Button variant="contained" startIcon={<SaveRoundedIcon />}
                onClick={saveAISettings} disabled={aiSaving}>
                {aiSaving ? "Saving..." : "Save AI Configuration"}
              </Button>
              <Button variant="outlined" startIcon={<AutoAwesomeRoundedIcon />}
                onClick={testConfiguredAI} disabled={aiTesting}>
                {aiTesting ? "Testing..." : "Test Connection"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6">AI Status</Typography>
            <Stack spacing={1.5} sx={{ mt:2 }}>
              <Paper variant="outlined" sx={{p:2,borderRadius:3}}>
                <Typography variant="caption" color="text.secondary">Provider</Typography>
                <Typography fontWeight={900}>{String(aiSettings.provider || "").toUpperCase()}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{p:2,borderRadius:3}}>
                <Typography variant="caption" color="text.secondary">AI Features</Typography>
                <Typography fontWeight={900} color={aiSettings.enabled ? "success.main" : "text.secondary"}>
                  {aiSettings.enabled ? "Enabled" : "Disabled"}
                </Typography>
              </Paper>
              <Alert severity="info">
                Purchase Bill AI always uses Review → Confirm. Extraction never updates stock automatically.
              </Alert>
            </Stack>
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
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3.5}>
              <PersonRoundedIcon color="primary" />
              <Box>
                <Typography variant="h6">Login Username</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Change the username used to sign in.
                </Typography>
              </Box>
            </Stack>

            <TextField
              fullWidth
              label="New Username"
              value={username.new_user_id}
              onChange={(event) =>
                setUsername({ new_user_id: event.target.value })
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
            <Stack direction="row" spacing={1.5} alignItems="center" mb={3.5}>
              <LockResetRoundedIcon color="warning" />
              <Box>
                <Typography variant="h6">Account security</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Use a strong, unique password.
                </Typography>
              </Box>
            </Stack>

            <Stack spacing={2}>
              {[
                ["Current Password", "old_password"],
                ["New Password", "new_password"],
                ["Confirm New Password", "confirm_password"],
              ].map(([label, key]) => (
                <TextField
                  key={key}
                  fullWidth
                  type="password"
                  label={label}
                  value={password[key]}
                  onChange={(event) =>
                    setPassword({
                      ...password,
                      [key]: event.target.value,
                    })
                  }
                />
              ))}

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

  const employeesPanel = (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" mb={3}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <PeopleAltRoundedIcon color="primary" />
                <Box>
                  <Typography variant="h6">Employees</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Create staff logins and choose exactly what each one can access. You'll always see the whole Sales Report -- an employee only ever sees invoices they personally created.
                  </Typography>
                </Box>
              </Stack>
              <ActionButton startIcon={<AddRoundedIcon />} onClick={openCreateEmployee}>
                Add Employee
              </ActionButton>
            </Stack>

            {revealedCredentials && (
              <Alert severity="info" sx={{ mb: 2.5 }} onClose={() => setRevealedCredentials(null)}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2">
                    Username: <strong>{revealedCredentials.user_id}</strong> &nbsp;·&nbsp; Password: <strong>{revealedCredentials.password}</strong>
                  </Typography>
                  <Tooltip title="Copy password">
                    <IconButton
                      size="small"
                      onClick={() => navigator.clipboard?.writeText(revealedCredentials.password)}
                    >
                      <ContentCopyRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  This won't be shown again -- share it with the employee now, or use Reset Password later if it's lost.
                </Typography>
              </Alert>
            )}

            <AppTable
              emptyText={employeesLoading ? "Loading..." : "No employees yet"}
              columns={[
                { key: "name", label: "Name", render: (e) => e.name || "—" },
                { key: "user_id", label: "Username" },
                {
                  key: "permissions",
                  label: "Access",
                  render: (e) => (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {PERMISSION_MODULES.filter((m) => e.permissions?.[m.key]).map((m) => (
                        <Chip key={m.key} label={m.label} size="small" />
                      ))}
                      {PERMISSION_MODULES.every((m) => !e.permissions?.[m.key]) && (
                        <Typography variant="caption" color="text.secondary">No access granted</Typography>
                      )}
                    </Stack>
                  ),
                },
                {
                  key: "is_active",
                  label: "Status",
                  render: (e) => (
                    <FormControlLabel
                      control={<Switch size="small" checked={e.is_active} onChange={() => handleToggleActive(e)} />}
                      label={e.is_active ? "Active" : "Disabled"}
                    />
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  render: (e) => (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => openEditEmployee(e)}>Edit</Button>
                      <Button size="small" color="warning" startIcon={<LockResetRoundedIcon />} onClick={() => handleResetPassword(e)}>
                        Reset Password
                      </Button>
                    </Stack>
                  ),
                },
              ]}
              rows={employees}
            />
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={Boolean(employeeDialog)} onClose={closeEmployeeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{employeeDialog === "create" ? "Add Employee" : "Edit Employee"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            <TextField
              label="Username"
              value={employeeForm.user_id}
              disabled={employeeDialog !== "create"}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, user_id: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Display Name"
              value={employeeForm.name}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
            />
            {employeeDialog === "create" && (
              <TextField
                label="Password (leave blank to auto-generate)"
                value={employeeForm.password}
                onChange={(e) => setEmployeeForm((f) => ({ ...f, password: e.target.value }))}
                fullWidth
              />
            )}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Access</Typography>
              <Grid container spacing={0.5}>
                {PERMISSION_MODULES.map((m) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={m.key}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(employeeForm.permissions[m.key])}
                          onChange={() => toggleEmployeePermission(m.key)}
                        />
                      }
                      label={m.label}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEmployeeDialog}>Cancel</Button>
          <Button variant="contained" disabled={employeeSaving} onClick={saveEmployee}>
            {employeeDialog === "create" ? "Create Employee" : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );

  // Only the tabs the logged-in account can actually use -- an admin sees
  // everything; an employee sees only Print/AI settings if granted, and
  // never sees Business Profile, Payment QR, Loyalty, Account & Security or
  // Employees regardless of any permission (those stay Admin-only, always).
  const visibleTabs = [
    { key: "business", label: "Business Profile", icon: <BusinessRoundedIcon />, visible: isAdmin, panel: businessPanel },
    { key: "print", label: "Print Designer", icon: <PrintRoundedIcon />, visible: isAdmin || myPermissions.settings_print, panel: designerPanel },
    { key: "payment", label: "Payment QR", icon: <PaymentsRoundedIcon />, visible: isAdmin, panel: paymentPanel },
    { key: "loyalty", label: "Loyalty", icon: <WorkspacePremiumRoundedIcon />, visible: isAdmin, panel: loyaltyPanel },
    { key: "ai", label: "AI", icon: <AutoAwesomeRoundedIcon />, visible: isAdmin || myPermissions.settings_ai, panel: aiPanel },
    { key: "account", label: "Account & Security", icon: <PersonRoundedIcon />, visible: isAdmin, panel: accountPanel },
    { key: "employees", label: "Employees", icon: <PeopleAltRoundedIcon />, visible: isAdmin, panel: employeesPanel },
  ].filter((t) => t.visible);

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        subtitle={isAdmin ? "Configure business identity, invoice designer, UPI payment QR and account security" : "Configure the settings you have access to"}
      />

      {message.text && (
        <Alert
          severity={message.type}
          sx={{ mb: 2.5 }}
          onClose={() => setMessage({ type: "", text: "" })}
        >
          {message.text}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <Tabs
          value={Math.min(tab, visibleTabs.length - 1)}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          {visibleTabs.map((t) => (
            <Tab key={t.key} icon={t.icon} iconPosition="start" label={t.label} />
          ))}
        </Tabs>
      </Card>

      {visibleTabs[Math.min(tab, visibleTabs.length - 1)]?.panel}
    </AppLayout>
  );
}
