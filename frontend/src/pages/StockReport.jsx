import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/CurrencyRupeeRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import HealthAndSafetyRoundedIcon from "@mui/icons-material/HealthAndSafetyRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import { getStockReport } from "../services/api";

const DAY = 86400000;

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN");
};

const todayStart = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const getStockStatus = (item) => {
  const stock = Number(item?.stock ?? 0);
  const minimum = Number(item?.minimum_stock ?? 5);

  if (stock <= 0) {
    return { key: "out", label: "Out of Stock", color: "error" };
  }

  if (stock <= minimum) {
    return { key: "low", label: "Low Stock", color: "warning" };
  }

  return { key: "healthy", label: "Healthy", color: "success" };
};

const getExpiryStatus = (item) => {
  if (!item?.expiry_date) {
    return {
      key: "none",
      label: "No Expiry",
      color: "default",
      daysRemaining: null,
    };
  }

  const expiry = new Date(
    `${String(item.expiry_date).slice(0, 10)}T00:00:00`
  );

  if (Number.isNaN(expiry.getTime())) {
    return {
      key: "invalid",
      label: "Invalid Date",
      color: "error",
      daysRemaining: null,
    };
  }

  const daysRemaining = Math.round(
    (expiry.getTime() - todayStart().getTime()) / DAY
  );

  if (daysRemaining < 0) {
    return {
      key: "expired",
      label: "Expired",
      color: "error",
      daysRemaining,
    };
  }

  if (daysRemaining === 0) {
    return {
      key: "today",
      label: "Expires Today",
      color: "error",
      daysRemaining,
    };
  }

  if (
    daysRemaining <= Number(item.expiry_alert_days ?? 30)
  ) {
    return {
      key: "expiring",
      label: "Expiring Soon",
      color: "warning",
      daysRemaining,
    };
  }

  return {
    key: "safe",
    label: "Safe",
    color: "success",
    daysRemaining,
  };
};

const getPriority = (item) => {
  const stock = getStockStatus(item);
  const expiry = getExpiryStatus(item);

  if (
    stock.key === "out" ||
    expiry.key === "expired" ||
    expiry.key === "today"
  ) {
    return { key: "critical", label: "Critical", color: "error" };
  }

  if (stock.key === "low" || expiry.key === "expiring") {
    return { key: "high", label: "High", color: "warning" };
  }

  return { key: "normal", label: "Normal", color: "success" };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export default function StockReport() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [expiryPeriod, setExpiryPeriod] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getStockReport();
      setItems(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load stock report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const result = {
      products: items.length,
      totalStock: 0,
      inventoryValue: 0,
      healthy: 0,
      low: 0,
      out: 0,
      expired: 0,
      expiring: 0,
      critical: 0,
      expiredValue: 0,
    };

    items.forEach((item) => {
      const stock = Number(item.stock || 0);
      const purchase = Number(item.purchase_price || 0);
      const stockState = getStockStatus(item);
      const expiryState = getExpiryStatus(item);
      const priority = getPriority(item);

      result.totalStock += stock;
      result.inventoryValue += stock * purchase;

      if (stockState.key === "healthy") result.healthy += 1;
      if (stockState.key === "low") result.low += 1;
      if (stockState.key === "out") result.out += 1;

      if (
        expiryState.key === "expired" ||
        expiryState.key === "today"
      ) {
        result.expired += 1;
        result.expiredValue += stock * purchase;
      }

      if (expiryState.key === "expiring") {
        result.expiring += 1;
      }

      if (priority.key === "critical") {
        result.critical += 1;
      }
    });

    return result;
  }, [items]);

  const inventoryHealth = useMemo(() => {
    if (!summary.products) return 100;

    const risk =
      summary.out * 3 +
      summary.expired * 3 +
      summary.low * 1.5 +
      summary.expiring * 1.5;

    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 - (risk / (summary.products * 6)) * 100
        )
      )
    );
  }, [summary]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      const stock = getStockStatus(item);
      const expiry = getExpiryStatus(item);
      const priority = getPriority(item);

      const matchesSearch =
        !term ||
        `${item.item_name || ""} ${item.barcode || ""} ${
          item.batch_number || ""
        }`
          .toLowerCase()
          .includes(term);

      const matchesStock =
        stockFilter === "all" || stock.key === stockFilter;

      const matchesExpiry =
        expiryFilter === "all" ||
        expiry.key === expiryFilter ||
        (expiryFilter === "expired" &&
          ["expired", "today"].includes(expiry.key));

      const matchesPriority =
        priorityFilter === "all" ||
        priority.key === priorityFilter;

      let matchesPeriod = true;

      if (expiryPeriod !== "all") {
        if (expiry.daysRemaining === null) {
          matchesPeriod = false;
        } else if (expiryPeriod === "today") {
          matchesPeriod = expiry.daysRemaining === 0;
        } else if (expiryPeriod === "7") {
          matchesPeriod =
            expiry.daysRemaining >= 0 &&
            expiry.daysRemaining <= 7;
        } else if (expiryPeriod === "30") {
          matchesPeriod =
            expiry.daysRemaining >= 0 &&
            expiry.daysRemaining <= 30;
        }
      }

      return (
        matchesSearch &&
        matchesStock &&
        matchesExpiry &&
        matchesPriority &&
        matchesPeriod
      );
    });
  }, [
    items,
    search,
    stockFilter,
    expiryFilter,
    expiryPeriod,
    priorityFilter,
  ]);

  const filteredValue = useMemo(
    () =>
      filtered.reduce(
        (sum, item) =>
          sum +
          Number(item.purchase_price || 0) *
            Number(item.stock || 0),
        0
      ),
    [filtered]
  );

  const selectedRows = useMemo(
    () => filtered.filter((item) => selectedIds.has(item.id)),
    [filtered, selectedIds]
  );

  const healthLabel =
    inventoryHealth >= 85
      ? "Excellent"
      : inventoryHealth >= 70
      ? "Good"
      : inventoryHealth >= 50
      ? "Needs Attention"
      : "Critical";

  const applyCardFilter = (type) => {
    setStockFilter("all");
    setExpiryFilter("all");
    setExpiryPeriod("all");
    setPriorityFilter("all");

    if (type === "healthy") setStockFilter("healthy");
    if (type === "low") setStockFilter("low");
    if (type === "out") setStockFilter("out");
    if (type === "expired") setExpiryFilter("expired");
    if (type === "expiring") setExpiryFilter("expiring");
    if (type === "critical") setPriorityFilter("critical");
  };

  const clearFilters = () => {
    setSearch("");
    setStockFilter("all");
    setExpiryFilter("all");
    setExpiryPeriod("all");
    setPriorityFilter("all");
    setSelectedIds(new Set());
  };

  const exportRows = (rows, fileName) => {
    const exportData = rows.map((item) => {
      const stock = getStockStatus(item);
      const expiry = getExpiryStatus(item);
      const priority = getPriority(item);

      return {
        "Item Name": item.item_name || "",
        Barcode: item.barcode || "",
        "Batch No.": item.batch_number || "",
        "Purchase Price": Number(item.purchase_price || 0),
        MRP: Number(item.mrp || 0),
        "Sale Price": Number(item.sale_price || 0),
        "GST %": Number(item.gst_percent || 0),
        "Current Stock": Number(item.stock || 0),
        "Minimum Stock": Number(item.minimum_stock || 0),
        "Stock Value":
          Number(item.purchase_price || 0) *
          Number(item.stock || 0),
        "Manufacturing Date": item.manufacturing_date || "",
        "Expiry Date": item.expiry_date || "",
        "Days Remaining": expiry.daysRemaining ?? "",
        "Stock Status": stock.label,
        "Expiry Status": expiry.label,
        Priority: priority.label,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Stock & Expiry"
    );

    XLSX.writeFile(workbook, fileName);
  };

  const printReport = () => {
    const rows = filtered
      .map((item) => {
        const stock = getStockStatus(item);
        const expiry = getExpiryStatus(item);
        const priority = getPriority(item);

        return `
          <tr>
            <td>${escapeHtml(item.item_name)}</td>
            <td>${escapeHtml(item.barcode)}</td>
            <td>${escapeHtml(item.batch_number || "—")}</td>
            <td>${Number(item.stock || 0)}</td>
            <td>${Number(item.minimum_stock || 0)}</td>
            <td>${escapeHtml(
              money(
                Number(item.purchase_price || 0) *
                  Number(item.stock || 0)
              )
            )}</td>
            <td>${escapeHtml(formatDate(item.expiry_date))}</td>
            <td>${
              expiry.daysRemaining === null
                ? "—"
                : expiry.daysRemaining
            }</td>
            <td>${escapeHtml(stock.label)}</td>
            <td>${escapeHtml(expiry.label)}</td>
            <td>${escapeHtml(priority.label)}</td>
          </tr>
        `;
      })
      .join("");

    const reportWindow = window.open(
      "",
      "_blank",
      "width=1200,height=800"
    );

    if (!reportWindow) {
      setError(
        "Popup blocked. Please allow popups to print the report."
      );
      return;
    }

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Stock & Expiry Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
            h1 { margin-bottom: 2px; }
            .meta { color: #64748b; margin-bottom: 16px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0; }
            .summary div { border: 1px solid #cbd5e1; padding: 10px; }
            .label { color: #64748b; font-size: 11px; }
            .value { font-weight: 700; margin-top: 3px; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px; }
            th { background: #f1f5f9; text-align: left; }
            .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 10px; }
            @page { size: landscape; margin: 8mm; }
          </style>
        </head>
        <body>
          <h1>Stock & Expiry Report</h1>
          <div class="meta">
            Generated ${escapeHtml(
              new Date().toLocaleString("en-IN")
            )} · ${filtered.length} record(s)
          </div>

          <div class="summary">
            <div>
              <div class="label">Inventory Value</div>
              <div class="value">${escapeHtml(
                money(filteredValue)
              )}</div>
            </div>
            <div>
              <div class="label">Low Stock</div>
              <div class="value">${summary.low}</div>
            </div>
            <div>
              <div class="label">Expired</div>
              <div class="value">${summary.expired}</div>
            </div>
            <div>
              <div class="label">Inventory Health</div>
              <div class="value">${inventoryHealth}%</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Barcode</th>
                <th>Batch</th>
                <th>Stock</th>
                <th>Minimum</th>
                <th>Stock Value</th>
                <th>Expiry</th>
                <th>Days</th>
                <th>Stock Status</th>
                <th>Expiry Status</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="footer">
            <span>Powered by Resolvent IT Services Pvt. Ltd.</span>
            <span>Authorized Signature ____________________</span>
          </div>

          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `);

    reportWindow.document.close();
  };

  const toggleRow = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    filtered.length > 0 &&
    filtered.every((item) => selectedIds.has(item.id));

  const toggleAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allSelected) {
        filtered.forEach((item) => next.delete(item.id));
      } else {
        filtered.forEach((item) => next.add(item.id));
      }

      return next;
    });
  };

  const cards = [
    {
      label: "Total Products",
      value: summary.products,
      helper: "Active inventory records",
      icon: <Inventory2RoundedIcon />,
    },
    {
      label: "Inventory Value",
      value: money(summary.inventoryValue),
      helper: "Based on purchase price",
      icon: <CurrencyRupeeRoundedIcon />,
    },
    {
      label: "Healthy Stock",
      value: summary.healthy,
      helper: "Above minimum stock",
      icon: <HealthAndSafetyRoundedIcon />,
      filter: "healthy",
    },
    {
      label: "Low Stock",
      value: summary.low,
      helper: "At or below minimum stock",
      icon: <WarningAmberRoundedIcon />,
      filter: "low",
    },
    {
      label: "Out of Stock",
      value: summary.out,
      helper: "Requires replenishment",
      icon: <ErrorOutlineRoundedIcon />,
      filter: "out",
    },
    {
      label: "Expiring Soon",
      value: summary.expiring,
      helper: "Inside expiry alert period",
      icon: <EventAvailableRoundedIcon />,
      filter: "expiring",
    },
    {
      label: "Expired",
      value: summary.expired,
      helper: "Expired or expires today",
      icon: <EventBusyRoundedIcon />,
      filter: "expired",
    },
    {
      label: "Critical",
      value: summary.critical,
      helper: "Immediate action required",
      icon: <WarningAmberRoundedIcon />,
      filter: "critical",
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Stock & Expiry Report"
        subtitle="Monitor inventory health, reorder risk, expiry dates and stock valuation from one place"
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2.5 }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((card) => (
          <Grid
            key={card.label}
            size={{ xs: 12, sm: 6, md: 4, xl: 3 }}
          >
            <Card sx={{ height: "100%" }}>
              <CardActionArea
                disabled={!card.filter}
                onClick={() =>
                  card.filter &&
                  applyCardFilter(card.filter)
                }
                sx={{
                  height: "100%",
                  textAlign: "left",
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        {card.label}
                      </Typography>

                      <Typography
                        variant="h5"
                        fontWeight={800}
                        sx={{ mt: 0.5 }}
                      >
                        {card.value}
                      </Typography>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {card.helper}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 2.5,
                        bgcolor: "primary.light",
                        color: "primary.main",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {card.icon}
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={2}
              >
                <Box>
                  <Typography variant="h6">
                    Inventory Health
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Combined stock and expiry risk score.
                  </Typography>
                </Box>

                <Typography
                  variant="h4"
                  fontWeight={900}
                  color={
                    inventoryHealth >= 70
                      ? "success.main"
                      : inventoryHealth >= 50
                      ? "warning.main"
                      : "error.main"
                  }
                >
                  {inventoryHealth}%
                </Typography>
              </Stack>

              <LinearProgress
                variant="determinate"
                value={inventoryHealth}
                color={
                  inventoryHealth >= 70
                    ? "success"
                    : inventoryHealth >= 50
                    ? "warning"
                    : "error"
                }
                sx={{
                  mt: 2,
                  height: 10,
                  borderRadius: 10,
                }}
              />

              <Chip
                size="small"
                label={healthLabel}
                color={
                  inventoryHealth >= 70
                    ? "success"
                    : inventoryHealth >= 50
                    ? "warning"
                    : "error"
                }
                sx={{ mt: 1.5 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6">
                Quick Insights
              </Typography>

              <Stack spacing={1} sx={{ mt: 1.5 }}>
                <Typography variant="body2">
                  • {summary.low + summary.out} product(s)
                  need replenishment.
                </Typography>
                <Typography variant="body2">
                  • {summary.expiring} product(s) are inside
                  their expiry alert period.
                </Typography>
                <Typography variant="body2">
                  • {summary.expired} product(s) are expired
                  or expire today.
                </Typography>
                <Typography variant="body2">
                  • {money(summary.expiredValue)} inventory
                  value is tied to expired stock.
                </Typography>
                <Typography variant="body2">
                  • Inventory health is {healthLabel} at{" "}
                  {inventoryHealth}%.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box
            sx={{
              p: 2.5,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                justifyContent="space-between"
                alignItems={{
                  xs: "stretch",
                  lg: "center",
                }}
                spacing={2}
              >
                <Box>
                  <Typography variant="h6">
                    Inventory Position
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Stock, batch and expiry information with
                    automatic priority classification.
                  </Typography>
                </Box>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                >
                  <Button
                    variant="outlined"
                    startIcon={<RefreshRoundedIcon />}
                    onClick={load}
                    disabled={loading}
                  >
                    Refresh
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadRoundedIcon />}
                    onClick={() =>
                      exportRows(
                        filtered,
                        "Stock_Expiry_Report.xlsx"
                      )
                    }
                    disabled={!filtered.length}
                  >
                    Export Excel
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<PrintRoundedIcon />}
                    onClick={printReport}
                    disabled={!filtered.length}
                  >
                    Print Report
                  </Button>
                </Stack>
              </Stack>

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search item, barcode or batch"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRoundedIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Stock Status</InputLabel>
                    <Select
                      label="Stock Status"
                      value={stockFilter}
                      onChange={(event) =>
                        setStockFilter(event.target.value)
                      }
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="healthy">
                        Healthy
                      </MenuItem>
                      <MenuItem value="low">
                        Low Stock
                      </MenuItem>
                      <MenuItem value="out">
                        Out of Stock
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Expiry Status</InputLabel>
                    <Select
                      label="Expiry Status"
                      value={expiryFilter}
                      onChange={(event) =>
                        setExpiryFilter(event.target.value)
                      }
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="safe">Safe</MenuItem>
                      <MenuItem value="expiring">
                        Expiring Soon
                      </MenuItem>
                      <MenuItem value="today">
                        Expires Today
                      </MenuItem>
                      <MenuItem value="expired">
                        Expired
                      </MenuItem>
                      <MenuItem value="none">
                        No Expiry
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Expiry Period</InputLabel>
                    <Select
                      label="Expiry Period"
                      value={expiryPeriod}
                      onChange={(event) =>
                        setExpiryPeriod(event.target.value)
                      }
                    >
                      <MenuItem value="all">
                        All Dates
                      </MenuItem>
                      <MenuItem value="today">
                        Today
                      </MenuItem>
                      <MenuItem value="7">
                        Next 7 Days
                      </MenuItem>
                      <MenuItem value="30">
                        Next 30 Days
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Priority</InputLabel>
                    <Select
                      label="Priority"
                      value={priorityFilter}
                      onChange={(event) =>
                        setPriorityFilter(event.target.value)
                      }
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="critical">
                        Critical
                      </MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="normal">
                        Normal
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{
                  xs: "flex-start",
                  sm: "center",
                }}
                spacing={1}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Showing {filtered.length} of {items.length}{" "}
                  records · Current view value{" "}
                  <strong>{money(filteredValue)}</strong>
                </Typography>

                <Stack direction="row" spacing={1}>
                  {selectedRows.length > 0 && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<FileDownloadRoundedIcon />}
                      onClick={() =>
                        exportRows(
                          selectedRows,
                          "Selected_Stock_Expiry_Report.xlsx"
                        )
                      }
                    >
                      Export Selected ({selectedRows.length})
                    </Button>
                  )}

                  <Button size="small" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </Box>

          <TableContainer sx={{ maxHeight: 650 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={
                        selectedRows.length > 0 &&
                        !allSelected
                      }
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell>Barcode</TableCell>
                  <TableCell>Batch No.</TableCell>
                  <TableCell align="right">
                    Purchase
                  </TableCell>
                  <TableCell align="right">Sale</TableCell>
                  <TableCell align="center">Stock</TableCell>
                  <TableCell align="center">
                    Minimum
                  </TableCell>
                  <TableCell align="right">
                    Stock Value
                  </TableCell>
                  <TableCell>MFG Date</TableCell>
                  <TableCell>Expiry Date</TableCell>
                  <TableCell align="center">Days</TableCell>
                  <TableCell>Stock Status</TableCell>
                  <TableCell>Expiry Status</TableCell>
                  <TableCell>Priority</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filtered.map((item) => {
                  const stock = getStockStatus(item);
                  const expiry = getExpiryStatus(item);
                  const priority = getPriority(item);

                  return (
                    <TableRow
                      key={item.id}
                      hover
                      selected={selectedIds.has(item.id)}
                      sx={{
                        bgcolor:
                          priority.key === "critical"
                            ? "rgba(211,47,47,.045)"
                            : priority.key === "high"
                            ? "rgba(237,108,2,.045)"
                            : "transparent",
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onChange={() =>
                            toggleRow(item.id)
                          }
                        />
                      </TableCell>

                      <TableCell>
                        <Typography fontWeight={700}>
                          {item.item_name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          GST {Number(item.gst_percent || 0)}%
                        </Typography>
                      </TableCell>

                      <TableCell>
                        {item.barcode || "—"}
                      </TableCell>

                      <TableCell>
                        {item.batch_number || "—"}
                      </TableCell>

                      <TableCell align="right">
                        {money(item.purchase_price)}
                      </TableCell>

                      <TableCell align="right">
                        {money(item.sale_price)}
                      </TableCell>

                      <TableCell align="center">
                        <Typography fontWeight={800}>
                          {Number(item.stock || 0)}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        {Number(item.minimum_stock || 0)}
                      </TableCell>

                      <TableCell align="right">
                        {money(
                          Number(item.purchase_price || 0) *
                            Number(item.stock || 0)
                        )}
                      </TableCell>

                      <TableCell>
                        {formatDate(item.manufacturing_date)}
                      </TableCell>

                      <TableCell>
                        {formatDate(item.expiry_date)}
                      </TableCell>

                      <TableCell align="center">
                        {expiry.daysRemaining === null
                          ? "—"
                          : expiry.daysRemaining}
                      </TableCell>

                      <TableCell>
                        <Chip
                          size="small"
                          label={stock.label}
                          color={stock.color}
                          variant="outlined"
                        />
                      </TableCell>

                      <TableCell>
                        <Tooltip
                          title={
                            expiry.daysRemaining === null
                              ? ""
                              : `${expiry.daysRemaining} day(s) remaining`
                          }
                        >
                          <Chip
                            size="small"
                            label={expiry.label}
                            color={expiry.color}
                            variant="outlined"
                          />
                        </Tooltip>
                      </TableCell>

                      <TableCell>
                        <Chip
                          size="small"
                          label={priority.label}
                          color={priority.color}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!filtered.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={15}>
                      <Box
                        sx={{
                          py: 8,
                          textAlign: "center",
                        }}
                      >
                        <Typography fontWeight={700}>
                          No stock records found
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Change the search or filters.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell colSpan={15}>
                      <Stack
                        alignItems="center"
                        spacing={1.5}
                        sx={{ py: 8 }}
                      >
                        <CircularProgress size={30} />
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Loading stock and expiry data...
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
