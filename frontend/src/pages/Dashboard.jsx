import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/CurrencyRupeeRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import AddBoxRoundedIcon from "@mui/icons-material/AddBoxRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";

import AppLayout from "../components/AppLayout";
import { getDashboardReport } from "../services/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const dashboardActionSx = {
  height: 46,
  minWidth: 160,
  px: 2.5,
  borderRadius: "24px",
  borderColor: "#2563EB",
  color: "#2563EB",
  backgroundColor: "#FFFFFF",
  fontWeight: 700,
  fontSize: 14,
  textTransform: "none",
  justifyContent: "flex-start",
  whiteSpace: "nowrap",
  boxShadow: "none",

  "& .MuiButton-startIcon": {
    marginRight: 1,
  },

  "&:hover": {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
    boxShadow: "none",
  },
};

const emptyState = {
  total_sales: 0,
  cash_sales: 0,
  online_sales: 0,
  credit_sales: 0,
  customer_credit_outstanding: 0,
  dealer_pending: 0,
  total_bills: 0,
  total_customers: 0,
  total_items: 0,
  low_stock_count: 0,
  sales_trend: [],
  recent_sales: [],
  low_stock_items: [],
};

function MetricCard({ title, value, caption, icon, tone = "primary" }) {
  const tones = {
    primary: { bg: "#EFF6FF", fg: "#2563EB" },
    success: { bg: "#ECFDF5", fg: "#059669" },
    purple: { bg: "#F5F3FF", fg: "#7C3AED" },
    warning: { bg: "#FFF7ED", fg: "#EA580C" },
  };
  const color = tones[tone] || tones.primary;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        height: "100%",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        transition: "transform .2s ease, box-shadow .2s ease",
        "&:hover": { transform: "translateY(-3px)", boxShadow: "0 16px 36px rgba(15,23,42,.08)" },
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={650}>{title}</Typography>
          <Typography variant="h5" fontWeight={850} sx={{ mt: 0.8 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{caption}</Typography>
        </Box>
        <Avatar variant="rounded" sx={{ bgcolor: color.bg, color: color.fg, width: 48, height: 48 }}>{icon}</Avatar>
      </Stack>
    </Paper>
  );
}

function SalesChart({ data }) {
  const max = Math.max(...data.map((x) => Number(x.amount || 0)), 1);
  return (
    <Box sx={{ height: 250, display: "flex", alignItems: "flex-end", gap: { xs: 1, sm: 1.5 }, pt: 3 }}>
      {data.length === 0 ? (
        <Box sx={{ m: "auto", textAlign: "center", color: "text.secondary" }}>
          <TrendingUpRoundedIcon sx={{ fontSize: 42, opacity: .35 }} />
          <Typography>No sales data for selected period</Typography>
        </Box>
      ) : data.map((item) => {
        const height = Math.max((Number(item.amount || 0) / max) * 185, 8);
        return (
          <Stack key={item.date} alignItems="center" justifyContent="flex-end" sx={{ flex: 1, minWidth: 0, height: "100%" }}>
            <Typography variant="caption" fontWeight={700} noWrap>{money(item.amount)}</Typography>
            <Box sx={{ width: "100%", maxWidth: 42, height, mt: 1, borderRadius: "10px 10px 3px 3px", background: "linear-gradient(180deg,#2563EB,#60A5FA)" }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {dayjs(item.date).format("DD MMM")}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(dayjs().startOf("month"));
  const [toDate, setToDate] = useState(dayjs());
  const [data, setData] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const periodLabel = useMemo(() => `${fromDate.format("DD MMM YYYY")} – ${toDate.format("DD MMM YYYY")}`, [fromDate, toDate]);

  const loadDashboard = async () => {
    if (fromDate.isAfter(toDate)) {
      setError("From date cannot be after To date.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getDashboardReport(fromDate.format("YYYY-MM-DD"), toDate.format("YYYY-MM-DD"));
      setData({ ...emptyState, ...result });
    } catch (err) {
      setError(err.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  return (
    <AppLayout>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={900}>Business Overview</Typography>
          <Typography color="text.secondary" mt={0.5}>Track sales, payments, inventory and daily business activity.</Typography>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.2}
          sx={{ width: { xs: "100%", md: "auto" } }}
        >
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={loadDashboard}
            sx={{ ...dashboardActionSx, width: { xs: "100%", sm: "auto" } }}
          >
            Refresh
          </Button>

          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigate("/create-bill")}
            sx={{ ...dashboardActionSx, width: { xs: "100%", sm: "auto" } }}
          >
            Create Invoice
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2.5, borderRadius: 3 }} />}

      <Paper elevation={0} sx={{ p: 2.2, mb: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Stack direction={{ xs: "column", lg: "row" }} alignItems={{ xs: "stretch", lg: "center" }} spacing={2}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 210 }}>
            <Avatar sx={{ bgcolor: "#EFF6FF", color: "primary.main" }}><CalendarMonthRoundedIcon /></Avatar>
            <Box><Typography fontWeight={800}>Report period</Typography><Typography variant="caption" color="text.secondary">{periodLabel}</Typography></Box>
          </Stack>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker label="From date" value={fromDate} onChange={(v) => v && setFromDate(v)} format="DD-MM-YYYY" slotProps={{ textField: { size: "small", fullWidth: true } }} />
            <DatePicker label="To date" value={toDate} onChange={(v) => v && setToDate(v)} format="DD-MM-YYYY" slotProps={{ textField: { size: "small", fullWidth: true } }} />
          </LocalizationProvider>
          <Button
            variant="outlined"
            startIcon={<CalendarMonthRoundedIcon />}
            onClick={loadDashboard}
            sx={{
              ...dashboardActionSx,
              minWidth: 170,
              flexShrink: 0,
            }}
          >
            Apply Filter
          </Button>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><MetricCard title="Total Revenue" value={money(data.total_sales)} caption={`${data.total_bills} invoices generated`} icon={<CurrencyRupeeRoundedIcon />} /></Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><MetricCard title="Cash Collection" value={money(data.cash_sales)} caption="Cash sales received" icon={<ReceiptLongRoundedIcon />} tone="success" /></Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><MetricCard title="Digital Collection" value={money(data.online_sales)} caption="Online payments received" icon={<CreditCardRoundedIcon />} tone="purple" /></Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}><MetricCard title="Outstanding" value={money(data.customer_credit_outstanding + data.dealer_pending)} caption="Customer credit + dealer payable" icon={<WarningAmberRoundedIcon />} tone="warning" /></Grid>
      </Grid>

      <Paper
        elevation={0}
        sx={{
          mt: 2.5,
          p: 2.2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          alignItems={{ xs: "stretch", lg: "center" }}
          spacing={2}
        >
          <Box sx={{ minWidth: { lg: 190 } }}>
            <Typography fontWeight={850}>Quick Actions</Typography>
            <Typography variant="body2" color="text.secondary">Common daily operations</Typography>
          </Box>
          <Grid container spacing={1.4} sx={{ flex: 1 }}>
            {[
              ["New Invoice", <ReceiptLongRoundedIcon />, "/create-bill"],
              ["Add Customer", <PersonAddAltRoundedIcon />, "/customers"],
              ["Add Item", <AddBoxRoundedIcon />, "/items"],
              ["Add Expense", <AccountBalanceWalletRoundedIcon />, "/expense"],
              ["Sales Report", <AssessmentRoundedIcon />, "/sales-report"],
            ].map(([label, icon, path]) => (
              <Grid key={label} size={{ xs: 12, sm: 6, md: 4, xl: 2.4 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={icon}
                  onClick={() => navigate(path)}
                  sx={{ ...dashboardActionSx, width: "100%", minWidth: 0, px: 1.8 }}
                >
                  {label}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Paper>

      <Grid container spacing={2.5} sx={{ mt: .2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper elevation={0} sx={{ p: 2.5, minHeight: 365, height: "100%", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box><Typography variant="h6" fontWeight={850}>Sales Performance</Typography><Typography variant="body2" color="text.secondary">Daily revenue for the selected period</Typography></Box>
              <Chip icon={<TrendingUpRoundedIcon />} label={`${data.total_bills} bills`} variant="outlined" />
            </Stack>
            <SalesChart data={data.sales_trend || []} />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} sx={{ p: 2.5, minHeight: 365, height: "100%", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={850}>Quick Overview</Typography>
            <Typography variant="body2" color="text.secondary" mb={2.5}>Current business master data</Typography>
            {[
              ["Customers", data.total_customers, <PeopleAltRoundedIcon />, "/customers"],
              ["Inventory items", data.total_items, <Inventory2RoundedIcon />, "/items"],
              ["Low stock alerts", data.low_stock_count, <WarningAmberRoundedIcon />, "/stock-report"],
              ["Dealer pending", money(data.dealer_pending), <LocalShippingRoundedIcon />, "/dealers"],
            ].map(([label, value, icon, path]) => (
              <Stack key={label} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.35, borderBottom: "1px solid", borderColor: "divider" }}>
                <Avatar variant="rounded" sx={{ width: 38, height: 38, bgcolor: "#F1F5F9", color: "text.primary" }}>{icon}</Avatar>
                <Box sx={{ flex: 1 }}><Typography fontWeight={700}>{label}</Typography><Typography variant="caption" color="text.secondary">View details</Typography></Box>
                <Typography fontWeight={850}>{value}</Typography>
                <IconButton size="small" onClick={() => navigate(path)}><ArrowForwardRoundedIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: .2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper elevation={0} sx={{ minHeight: 365, border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.5 }}>
              <Box><Typography variant="h6" fontWeight={850}>Recent Invoices</Typography><Typography variant="body2" color="text.secondary">Latest billing activity</Typography></Box>
              <Button variant="outlined" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate("/sales-report")} sx={{ ...dashboardActionSx, height: 40, minWidth: 120, px: 2 }}>View all</Button>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow><TableCell>Invoice</TableCell><TableCell>Customer</TableCell><TableCell>Payment</TableCell><TableCell>Date</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                <TableBody>
                  {(data.recent_sales || []).length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: "text.secondary" }}>No invoices found</TableCell></TableRow>
                  ) : data.recent_sales.map((sale) => (
                    <TableRow key={sale.id} hover>
                      <TableCell><Typography fontWeight={750}>{sale.invoice_no}</Typography></TableCell>
                      <TableCell>{sale.customer_name}</TableCell>
                      <TableCell><Chip size="small" label={sale.payment_mode} color={sale.payment_mode === "Credit" ? "warning" : sale.payment_mode === "Online" ? "primary" : "success"} variant="outlined" /></TableCell>
                      <TableCell>{sale.created_at ? dayjs(sale.created_at).format("DD MMM, hh:mm A") : "-"}</TableCell>
                      <TableCell align="right"><Typography fontWeight={800}>{money(sale.final_amount)}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} sx={{ p: 2.5, minHeight: 365, height: "100%", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Box><Typography variant="h6" fontWeight={850}>Low Stock</Typography><Typography variant="body2" color="text.secondary">Items requiring attention</Typography></Box>
              <Chip size="small" color="warning" label={`${data.low_stock_count} alerts`} />
            </Stack>
            {(data.low_stock_items || []).length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center", color: "text.secondary" }}><Inventory2RoundedIcon sx={{ fontSize: 42, opacity: .3 }} /><Typography>Stock levels look healthy</Typography></Box>
            ) : data.low_stock_items.map((item) => (
              <Box key={item.id} sx={{ py: 1.3, borderBottom: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" justifyContent="space-between"><Typography fontWeight={750}>{item.item_name}</Typography><Typography fontWeight={850} color={item.stock <= 3 ? "error.main" : "warning.main"}>{item.stock} left</Typography></Stack>
                <Typography variant="caption" color="text.secondary">Barcode: {item.barcode}</Typography>
                <LinearProgress variant="determinate" value={Math.min(item.stock * 10, 100)} color={item.stock <= 3 ? "error" : "warning"} sx={{ mt: 1, height: 5, borderRadius: 5 }} />
              </Box>
            ))}
            <Button fullWidth variant="outlined" sx={{ ...dashboardActionSx, mt: 2 }} onClick={() => navigate("/stock-report")}>Open Stock Report</Button>
          </Paper>
        </Grid>
      </Grid>

      {loading && !data.total_bills && <Box sx={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}><CircularProgress /></Box>}
    </AppLayout>
  );
}
