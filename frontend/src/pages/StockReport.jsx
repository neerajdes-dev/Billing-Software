import { useEffect, useMemo, useRef, useState } from "react";
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  Menu,
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
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import AddBoxRoundedIcon from "@mui/icons-material/AddBoxRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import {
  addStockAdjustment,
  bulkUpdateItems,
  deleteItem,
  getSettings,
  getStockReport,
} from "../services/api";

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

  if (Number.isNaN(date.getTime())) return "—";

  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
};

const todayStart = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const getStockStatus = (item) => {
  const stock = Number(item?.stock ?? 0);
  const minimum = Number(item?.minimum_stock ?? 5);

  if (stock <= 0) return { key: "out", label: "Out of Stock", color: "error" };
  if (stock <= minimum) return { key: "low", label: "Low Stock", color: "warning" };
  return { key: "healthy", label: "Healthy", color: "success" };
};

const getExpiryStatus = (item) => {
  if (!item?.expiry_date) {
    return { key: "none", label: "No Expiry", color: "default", daysRemaining: null };
  }

  const expiry = new Date(`${String(item.expiry_date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) {
    return { key: "invalid", label: "Invalid Date", color: "error", daysRemaining: null };
  }

  const daysRemaining = Math.round((expiry.getTime() - todayStart().getTime()) / DAY);

  if (daysRemaining < 0) {
    return { key: "expired", label: "Expired", color: "error", daysRemaining };
  }
  if (daysRemaining === 0) {
    return { key: "today", label: "Expires Today", color: "error", daysRemaining };
  }
  if (daysRemaining <= Number(item.expiry_alert_days ?? 30)) {
    return {
      key: "expiring",
      label: `Expiring in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      color: "warning",
      daysRemaining,
    };
  }
  return { key: "safe", label: "Safe", color: "success", daysRemaining };
};

const getPriority = (item) => {
  const stock = getStockStatus(item);
  const expiry = getExpiryStatus(item);

  if (stock.key === "out" || expiry.key === "expired" || expiry.key === "today") {
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

const buildExportRow = (item) => {
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
    "Stock Value": Number(item.purchase_price || 0) * Number(item.stock || 0),
    "Manufacturing Date": item.manufacturing_date || "",
    "Expiry Date": item.expiry_date || "",
    "Days Left": expiry.daysRemaining ?? "",
    "Stock Status": stock.label,
    "Expiry Status": expiry.label,
    Priority: priority.label,
  };
};

export default function StockReport() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user.user_id || "admin";

  const [items, setItems] = useState([]);
  const [business, setBusiness] = useState({
    business_name: "",
    gst_number: "",
    mobile: "",
    email: "",
    address: "",
  });
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [expiryPeriod, setExpiryPeriod] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [exportAnchor, setExportAnchor] = useState(null);
  const [bulkAnchor, setBulkAnchor] = useState(null);
  const [bulkDialog, setBulkDialog] = useState(null);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkReason, setBulkReason] = useState("Stock Correction");
  const [bulkSaving, setBulkSaving] = useState(false);
  const logoRef = useRef(localStorage.getItem("billing_business_logo") || "/resolvent-logo.jpg");

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setMessage({ type: "", text: "" });
      const [stockData, settingsData] = await Promise.all([
        getStockReport(),
        getSettings(userId).catch(() => null),
      ]);
      setItems(Array.isArray(stockData) ? stockData : []);
      if (settingsData) {
        setBusiness({
          business_name: settingsData.business_name || "",
          gst_number: settingsData.gst_number || "",
          mobile: settingsData.mobile || "",
          email: settingsData.email || "",
          address: settingsData.address || "",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Unable to load stock report." });
    } finally {
      if (!silent) setLoading(false);
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
      expiring7: 0,
    };

    items.forEach((item) => {
      const stockQty = Number(item.stock || 0);
      const purchase = Number(item.purchase_price || 0);
      const stock = getStockStatus(item);
      const expiry = getExpiryStatus(item);
      const priority = getPriority(item);

      result.totalStock += stockQty;
      result.inventoryValue += stockQty * purchase;
      if (stock.key === "healthy") result.healthy += 1;
      if (stock.key === "low") result.low += 1;
      if (stock.key === "out") result.out += 1;
      if (["expired", "today"].includes(expiry.key)) {
        result.expired += 1;
        result.expiredValue += stockQty * purchase;
      }
      if (expiry.key === "expiring") result.expiring += 1;
      if (expiry.daysRemaining !== null && expiry.daysRemaining >= 0 && expiry.daysRemaining <= 7) {
        result.expiring7 += 1;
      }
      if (priority.key === "critical") result.critical += 1;
    });

    return result;
  }, [items]);

  const inventoryHealth = useMemo(() => {
    if (!summary.products) return 100;
    const risk = summary.out * 3 + summary.expired * 3 + summary.low * 1.5 + summary.expiring * 1.5;
    return Math.max(0, Math.min(100, Math.round(100 - (risk / (summary.products * 6)) * 100)));
  }, [summary]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      const stock = getStockStatus(item);
      const expiry = getExpiryStatus(item);
      const priority = getPriority(item);

      const matchesSearch =
        !term ||
        `${item.item_name || ""} ${item.barcode || ""} ${item.batch_number || ""}`
          .toLowerCase()
          .includes(term);

      const matchesStock = stockFilter === "all" || stock.key === stockFilter;
      const matchesExpiry =
        expiryFilter === "all" ||
        expiry.key === expiryFilter ||
        (expiryFilter === "expired" && ["expired", "today"].includes(expiry.key));
      const matchesPriority = priorityFilter === "all" || priority.key === priorityFilter;

      let matchesPeriod = true;
      if (expiryPeriod !== "all") {
        if (expiry.daysRemaining === null) matchesPeriod = false;
        else if (expiryPeriod === "today") matchesPeriod = expiry.daysRemaining === 0;
        else if (expiryPeriod === "7") matchesPeriod = expiry.daysRemaining >= 0 && expiry.daysRemaining <= 7;
        else if (expiryPeriod === "30") matchesPeriod = expiry.daysRemaining >= 0 && expiry.daysRemaining <= 30;
      }

      return matchesSearch && matchesStock && matchesExpiry && matchesPriority && matchesPeriod;
    });
  }, [items, search, stockFilter, expiryFilter, expiryPeriod, priorityFilter]);

  const selectedRows = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  const filteredValue = useMemo(
    () =>
      filtered.reduce(
        (sum, item) => sum + Number(item.purchase_price || 0) * Number(item.stock || 0),
        0
      ),
    [filtered]
  );

  const healthLabel =
    inventoryHealth >= 85
      ? "Excellent"
      : inventoryHealth >= 70
      ? "Good"
      : inventoryHealth >= 50
      ? "Needs Attention"
      : "Critical";

  const clearFilters = () => {
    setSearch("");
    setStockFilter("all");
    setExpiryFilter("all");
    setExpiryPeriod("all");
    setPriorityFilter("all");
  };

  const applyCardFilter = (type) => {
    clearFilters();
    if (type === "healthy") setStockFilter("healthy");
    if (type === "low") setStockFilter("low");
    if (type === "out") setStockFilter("out");
    if (type === "expired") setExpiryFilter("expired");
    if (type === "expiring") setExpiryFilter("expiring");
    if (type === "critical") setPriorityFilter("critical");
  };

  const activeFilters = useMemo(() => {
    const chips = [];
    if (search.trim()) chips.push({ key: "search", label: `Search: ${search.trim()}` });
    if (stockFilter !== "all") {
      const labels = { healthy: "Healthy Stock", low: "Low Stock", out: "Out of Stock" };
      chips.push({ key: "stock", label: labels[stockFilter] || stockFilter });
    }
    if (expiryFilter !== "all") {
      const labels = {
        safe: "Safe Expiry",
        expiring: "Expiring Soon",
        today: "Expires Today",
        expired: "Expired",
        none: "No Expiry",
      };
      chips.push({ key: "expiry", label: labels[expiryFilter] || expiryFilter });
    }
    if (expiryPeriod !== "all") {
      const labels = { today: "Expiry Today", 7: "Next 7 Days", 30: "Next 30 Days" };
      chips.push({ key: "period", label: labels[expiryPeriod] || expiryPeriod });
    }
    if (priorityFilter !== "all") {
      chips.push({ key: "priority", label: `Priority: ${priorityFilter}` });
    }
    return chips;
  }, [search, stockFilter, expiryFilter, expiryPeriod, priorityFilter]);

  const removeFilterChip = (key) => {
    if (key === "search") setSearch("");
    if (key === "stock") setStockFilter("all");
    if (key === "expiry") setExpiryFilter("all");
    if (key === "period") setExpiryPeriod("all");
    if (key === "priority") setPriorityFilter("all");
  };

  const exportRows = (rows, fileName) => {
    const worksheet = XLSX.utils.json_to_sheet(rows.map(buildExportRow));
    worksheet["!cols"] = [
      { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 15 },
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 15 },
      { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock & Expiry");
    XLSX.writeFile(workbook, fileName);
    setExportAnchor(null);
  };

  const exportPreset = (preset) => {
    if (preset === "current") return exportRows(filtered, "Stock_Expiry_Current_View.xlsx");
    if (preset === "selected") return exportRows(selectedRows, "Stock_Expiry_Selected.xlsx");
    if (preset === "low") {
      return exportRows(items.filter((item) => getStockStatus(item).key === "low"), "Low_Stock_Report.xlsx");
    }
    if (preset === "expired") {
      return exportRows(
        items.filter((item) => ["expired", "today"].includes(getExpiryStatus(item).key)),
        "Expired_Stock_Report.xlsx"
      );
    }
    if (preset === "expiring") {
      return exportRows(
        items.filter((item) => getExpiryStatus(item).key === "expiring"),
        "Expiring_Soon_Report.xlsx"
      );
    }
    return exportRows(items, "Complete_Inventory_Report.xlsx");
  };

  const printRows = (rows, title = "Stock & Expiry Report") => {
    if (!rows.length) return;

    const logo = logoRef.current;
    const filtersText = activeFilters.length
      ? activeFilters.map((item) => item.label).join(" | ")
      : "All inventory records";
    const reportValue = rows.reduce(
      (sum, item) => sum + Number(item.purchase_price || 0) * Number(item.stock || 0),
      0
    );

    const rowsHtml = rows
      .map((item) => {
        const stock = getStockStatus(item);
        const expiry = getExpiryStatus(item);
        const priority = getPriority(item);
        return `
          <tr>
            <td>${escapeHtml(item.item_name)}</td>
            <td>${escapeHtml(item.barcode || "—")}</td>
            <td>${escapeHtml(item.batch_number || "—")}</td>
            <td class="num">${Number(item.stock || 0)}</td>
            <td class="num">${Number(item.minimum_stock || 0)}</td>
            <td class="num">${escapeHtml(money(Number(item.purchase_price || 0) * Number(item.stock || 0)))}</td>
            <td>${escapeHtml(formatDate(item.expiry_date))}</td>
            <td class="num">${expiry.daysRemaining ?? "—"}</td>
            <td>${escapeHtml(stock.label)}</td>
            <td>${escapeHtml(expiry.label)}</td>
            <td>${escapeHtml(priority.label)}</td>
          </tr>`;
      })
      .join("");

    const reportWindow = window.open("", "_blank", "width=1280,height=850");
    if (!reportWindow) {
      setMessage({ type: "warning", text: "Popup blocked. Please allow popups to print the report." });
      return;
    }

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body{font-family:Arial,sans-serif;margin:20px;color:#111827}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.brand{display:flex;gap:14px;align-items:center}.logo{width:90px;height:60px;object-fit:contain}.business h1{margin:0;font-size:20px}.business div,.meta{font-size:10px;color:#475569}.report{text-align:right}.report h2{margin:0;font-size:18px}.filters{margin:12px 0;padding:8px;border:1px solid #cbd5e1;background:#f8fafc;font-size:10px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.box{border:1px solid #cbd5e1;padding:9px}.label{font-size:9px;color:#64748b}.value{font-weight:700;margin-top:3px}table{width:100%;border-collapse:collapse;font-size:8px}th,td{border:1px solid #cbd5e1;padding:5px}th{background:#f1f5f9;text-align:left}.num{text-align:right}.footer{margin-top:22px;display:flex;justify-content:space-between;font-size:9px}@page{size:landscape;margin:8mm}
          </style>
        </head>
        <body>
          <div class="head">
            <div class="brand">
              <img class="logo" src="${escapeHtml(logo)}" />
              <div class="business">
                <h1>${escapeHtml(business.business_name || "Business Name")}</h1>
                <div>${escapeHtml(business.address || "")}</div>
                <div>GSTIN: ${escapeHtml(business.gst_number || "—")}</div>
                <div>${escapeHtml(business.mobile || "")} ${business.email ? `| ${escapeHtml(business.email)}` : ""}</div>
              </div>
            </div>
            <div class="report"><h2>${escapeHtml(title)}</h2><div class="meta">Generated ${escapeHtml(new Date().toLocaleString("en-IN"))}</div></div>
          </div>
          <div class="filters"><b>Applied Filters:</b> ${escapeHtml(filtersText)}</div>
          <div class="summary">
            <div class="box"><div class="label">Records</div><div class="value">${rows.length}</div></div>
            <div class="box"><div class="label">Inventory Value</div><div class="value">${escapeHtml(money(reportValue))}</div></div>
            <div class="box"><div class="label">Inventory Health</div><div class="value">${inventoryHealth}% (${escapeHtml(healthLabel)})</div></div>
            <div class="box"><div class="label">Critical Products</div><div class="value">${summary.critical}</div></div>
          </div>
          <table>
            <thead><tr><th>Item</th><th>Barcode</th><th>Batch</th><th>Stock</th><th>Min.</th><th>Stock Value</th><th>Expiry</th><th>Days Left</th><th>Stock Status</th><th>Expiry Status</th><th>Priority</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="footer"><span>Powered by Resolvent IT Services Pvt. Ltd.</span><span>Authorized Signature ____________________</span></div>
          <script>window.onload=()=>setTimeout(()=>window.print(),250);</script>
        </body>
      </html>`);
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

  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id));

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filtered.forEach((item) => next.delete(item.id));
      else filtered.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const openBulkDialog = (type) => {
    setBulkAnchor(null);
    setBulkValue("");
    setBulkReason("Stock Correction");
    setBulkDialog(type);
  };

  const performBulkAction = async () => {
    if (!selectedRows.length) return;

    try {
      setBulkSaving(true);

      if (bulkDialog === "stock") {
        const adjustment = Number(bulkValue);
        if (!Number.isInteger(adjustment) || adjustment === 0) {
          throw new Error("Enter a non-zero whole-number stock adjustment.");
        }
        for (const item of selectedRows) {
          if (Number(item.stock || 0) + adjustment < 0) {
            throw new Error(`${item.item_name} would have negative stock.`);
          }
          await addStockAdjustment(item.id, { adjustment, reason: bulkReason || "Stock Correction" });
        }
      }

      if (bulkDialog === "batch") {
        if (!bulkValue.trim()) throw new Error("Enter a batch number.");
        await bulkUpdateItems(
          selectedRows.map((item) => ({
            id: item.id,
            item_name: item.item_name,
            barcode: item.barcode,
            purchase_price: Number(item.purchase_price || 0),
            mrp: Number(item.mrp || 0),
            sale_price: Number(item.sale_price || 0),
            gst_percent: Number(item.gst_percent || 0),
            minimum_stock: Number(item.minimum_stock || 0),
            batch_number: bulkValue.trim(),
            manufacturing_date: item.manufacturing_date || null,
            expiry_date: item.expiry_date || null,
            expiry_alert_days: Number(item.expiry_alert_days || 30),
            stock_adjustment: 0,
            adjustment_reason: "Batch Update",
          }))
        );
      }

      if (bulkDialog === "expiry") {
        if (!bulkValue) throw new Error("Select an expiry date.");
        await bulkUpdateItems(
          selectedRows.map((item) => ({
            id: item.id,
            item_name: item.item_name,
            barcode: item.barcode,
            purchase_price: Number(item.purchase_price || 0),
            mrp: Number(item.mrp || 0),
            sale_price: Number(item.sale_price || 0),
            gst_percent: Number(item.gst_percent || 0),
            minimum_stock: Number(item.minimum_stock || 0),
            batch_number: item.batch_number || null,
            manufacturing_date: item.manufacturing_date || null,
            expiry_date: bulkValue,
            expiry_alert_days: Number(item.expiry_alert_days || 30),
            stock_adjustment: 0,
            adjustment_reason: "Expiry Update",
          }))
        );
      }

      if (bulkDialog === "delete") {
        for (const item of selectedRows) await deleteItem(item.id);
      }

      await load(true);
      setSelectedIds(new Set());
      setBulkDialog(null);
      setMessage({ type: "success", text: `${selectedRows.length} selected product(s) updated successfully.` });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBulkSaving(false);
    }
  };

  const cards = [
    { label: "Total Products", value: summary.products, helper: "Active inventory records", icon: <Inventory2RoundedIcon /> },
    { label: "Inventory Value", value: money(summary.inventoryValue), helper: "Based on purchase price", icon: <CurrencyRupeeRoundedIcon /> },
    { label: "Healthy Stock", value: summary.healthy, helper: "Above minimum stock", icon: <HealthAndSafetyRoundedIcon />, filter: "healthy" },
    { label: "Low Stock", value: summary.low, helper: "At or below minimum stock", icon: <WarningAmberRoundedIcon />, filter: "low" },
    { label: "Out of Stock", value: summary.out, helper: "Requires replenishment", icon: <ErrorOutlineRoundedIcon />, filter: "out" },
    { label: "Expiring Soon", value: summary.expiring, helper: "Inside expiry alert period", icon: <EventAvailableRoundedIcon />, filter: "expiring" },
    { label: "Expired", value: summary.expired, helper: "Expired or expires today", icon: <EventBusyRoundedIcon />, filter: "expired" },
    { label: "Critical", value: summary.critical, helper: "Immediate action required", icon: <WarningAmberRoundedIcon />, filter: "critical" },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Stock & Expiry Report"
        subtitle="Monitor inventory health, reorder risk, expiry dates and stock valuation from one place"
      />

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 2.5 }} onClose={() => setMessage({ type: "", text: "" })}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea
                disabled={!card.filter}
                onClick={() => card.filter && applyCardFilter(card.filter)}
                sx={{ height: "100%", textAlign: "left" }}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                      <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>{card.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{card.helper}</Typography>
                    </Box>
                    <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center" }}>
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
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Box>
                  <Typography variant="h6">Inventory Health</Typography>
                  <Typography variant="body2" color="text.secondary">Combined stock and expiry risk score.</Typography>
                </Box>
                <Typography variant="h4" fontWeight={900} color={inventoryHealth >= 70 ? "success.main" : inventoryHealth >= 50 ? "warning.main" : "error.main"}>
                  {inventoryHealth}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={inventoryHealth}
                color={inventoryHealth >= 70 ? "success" : inventoryHealth >= 50 ? "warning" : "error"}
                sx={{ mt: 2, height: 10, borderRadius: 10 }}
              />
              <Chip size="small" label={healthLabel} color={inventoryHealth >= 70 ? "success" : inventoryHealth >= 50 ? "warning" : "error"} sx={{ mt: 1.5 }} />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6">Smart Business Insights</Typography>
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                <Typography variant="body2">• {summary.low + summary.out} product(s) currently require replenishment.</Typography>
                <Typography variant="body2">• {summary.expiring7} product(s) expire today or within the next 7 days.</Typography>
                <Typography variant="body2">• {summary.expired} product(s) are expired or expire today.</Typography>
                <Typography variant="body2">• {money(summary.expiredValue)} inventory value is tied to expired stock.</Typography>
                <Typography variant="body2">• Inventory health is {healthLabel} at {inventoryHealth}%.</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2.5, borderBottom: 1, borderColor: "divider" }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", lg: "center" }} spacing={2}>
                <Box>
                  <Typography variant="h6">Inventory Position</Typography>
                  <Typography variant="body2" color="text.secondary">Stock, batch and expiry information with automatic priority classification.</Typography>
                </Box>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => load()} disabled={loading}>Refresh</Button>
                  <Button variant="outlined" startIcon={<FileDownloadRoundedIcon />} endIcon={<KeyboardArrowDownRoundedIcon />} onClick={(e) => setExportAnchor(e.currentTarget)} disabled={!items.length}>Export</Button>
                  <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
                    <MenuItem onClick={() => exportPreset("current")}>Export Current View</MenuItem>
                    <MenuItem onClick={() => exportPreset("low")}>Export Low Stock</MenuItem>
                    <MenuItem onClick={() => exportPreset("expired")}>Export Expired</MenuItem>
                    <MenuItem onClick={() => exportPreset("expiring")}>Export Expiring Soon</MenuItem>
                    <MenuItem onClick={() => exportPreset("all")}>Export Complete Inventory</MenuItem>
                    <MenuItem disabled={!selectedRows.length} onClick={() => exportPreset("selected")}>Export Selected ({selectedRows.length})</MenuItem>
                  </Menu>
                  <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={() => printRows(filtered)} disabled={!filtered.length}>Print Report</Button>

                  <Button variant="contained" startIcon={<TuneRoundedIcon />} endIcon={<KeyboardArrowDownRoundedIcon />} disabled={!selectedRows.length} onClick={(e) => setBulkAnchor(e.currentTarget)}>
                    Bulk Actions ({selectedRows.length})
                  </Button>
                  <Menu anchorEl={bulkAnchor} open={Boolean(bulkAnchor)} onClose={() => setBulkAnchor(null)}>
                    <MenuItem onClick={() => openBulkDialog("stock")}><AddBoxRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Stock Adjustment</MenuItem>
                    <MenuItem onClick={() => openBulkDialog("batch")}><LocalOfferRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Update Batch</MenuItem>
                    <MenuItem onClick={() => openBulkDialog("expiry")}><CalendarMonthRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Update Expiry</MenuItem>
                    <MenuItem onClick={() => printRows(selectedRows, "Selected Stock & Expiry Report")}><PrintRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Print Selected</MenuItem>
                    <MenuItem onClick={() => exportPreset("selected")}><FileDownloadRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Export Selected</MenuItem>
                    <MenuItem onClick={() => openBulkDialog("delete")} sx={{ color: "error.main" }}><DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Delete Selected</MenuItem>
                  </Menu>
                </Stack>
              </Stack>

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search item, barcode or batch"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Stock Status</InputLabel>
                    <Select label="Stock Status" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                      <MenuItem value="all">All</MenuItem><MenuItem value="healthy">Healthy</MenuItem><MenuItem value="low">Low Stock</MenuItem><MenuItem value="out">Out of Stock</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Expiry Status</InputLabel>
                    <Select label="Expiry Status" value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
                      <MenuItem value="all">All</MenuItem><MenuItem value="safe">Safe</MenuItem><MenuItem value="expiring">Expiring Soon</MenuItem><MenuItem value="today">Expires Today</MenuItem><MenuItem value="expired">Expired</MenuItem><MenuItem value="none">No Expiry</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Expiry Period</InputLabel>
                    <Select label="Expiry Period" value={expiryPeriod} onChange={(e) => setExpiryPeriod(e.target.value)}>
                      <MenuItem value="all">All Dates</MenuItem><MenuItem value="today">Today</MenuItem><MenuItem value="7">Next 7 Days</MenuItem><MenuItem value="30">Next 30 Days</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Priority</InputLabel>
                    <Select label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                      <MenuItem value="all">All</MenuItem><MenuItem value="critical">Critical</MenuItem><MenuItem value="high">High</MenuItem><MenuItem value="normal">Normal</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {activeFilters.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                  <Typography variant="caption" color="text.secondary">Active filters:</Typography>
                  {activeFilters.map((item) => (
                    <Chip key={item.key} size="small" label={item.label} onDelete={() => removeFilterChip(item.key)} />
                  ))}
                  <Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={clearFilters}>Clear All</Button>
                </Stack>
              )}

              <Typography variant="body2" color="text.secondary">
                Showing {filtered.length} of {items.length} records · Current view value <strong>{money(filteredValue)}</strong>
              </Typography>
            </Stack>
          </Box>

          <TableContainer sx={{ maxHeight: 650 }}>
            <Table
              stickyHeader
              size="small"
              sx={{
                minWidth: 1510,
                "& .MuiTableCell-root": {
                  verticalAlign: "middle",
                },
                "& .MuiTableCell-head": {
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allVisibleSelected}
                      indeterminate={selectedRows.length > 0 && !allVisibleSelected}
                      onChange={toggleAllVisible}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 310, width: 310 }}>Item Details</TableCell>
                  <TableCell align="right" sx={{ minWidth: 110 }}>Purchase</TableCell>
                  <TableCell align="right" sx={{ minWidth: 110 }}>Sale</TableCell>
                  <TableCell align="center" sx={{ minWidth: 80 }}>Stock</TableCell>
                  <TableCell align="center" sx={{ minWidth: 95 }}>Minimum</TableCell>
                  <TableCell align="right" sx={{ minWidth: 125 }}>Stock Value</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>MFG Date</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Expiry Date</TableCell>
                  <TableCell align="center" sx={{ minWidth: 90 }}>Days Left</TableCell>
                  <TableCell sx={{ minWidth: 135 }}>Stock Status</TableCell>
                  <TableCell sx={{ minWidth: 170 }}>Expiry Status</TableCell>
                  <TableCell sx={{ minWidth: 105 }}>Priority</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((item) => {
                  const stock = getStockStatus(item);
                  const expiry = getExpiryStatus(item);
                  const priority = getPriority(item);
                  const rowBg =
                    priority.key === "critical"
                      ? "rgba(211,47,47,.06)"
                      : priority.key === "high"
                      ? "rgba(237,108,2,.055)"
                      : "transparent";

                  return (
                    <TableRow key={item.id} hover selected={selectedIds.has(item.id)} sx={{ bgcolor: rowBg }}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleRow(item.id)}
                        />
                      </TableCell>

                      <TableCell sx={{ minWidth: 310, maxWidth: 310, py: 1.25 }}>
                        <Stack direction="row" spacing={1.25} alignItems="flex-start">
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: 2,
                              bgcolor: "action.hover",
                              color: "primary.main",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Inventory2RoundedIcon fontSize="small" />
                          </Box>

                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              fontWeight={800}
                              sx={{
                                lineHeight: 1.25,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {item.item_name || "Unnamed Item"}
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ mt: 0.35, lineHeight: 1.35 }}
                            >
                              Barcode: {item.barcode || "—"}
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ lineHeight: 1.35 }}
                            >
                              Batch: {item.batch_number || "—"} · GST {Number(item.gst_percent || 0)}%
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">{money(item.purchase_price)}</TableCell>
                      <TableCell align="right">{money(item.sale_price)}</TableCell>
                      <TableCell align="center"><Typography fontWeight={800}>{Number(item.stock || 0)}</Typography></TableCell>
                      <TableCell align="center">{Number(item.minimum_stock || 0)}</TableCell>
                      <TableCell align="right">{money(Number(item.purchase_price || 0) * Number(item.stock || 0))}</TableCell>
                      <TableCell>{formatDate(item.manufacturing_date)}</TableCell>
                      <TableCell>{formatDate(item.expiry_date)}</TableCell>
                      <TableCell align="center">{expiry.daysRemaining ?? "—"}</TableCell>
                      <TableCell>
                        <Tooltip
                          title={`Current: ${Number(item.stock || 0)} | Minimum: ${Number(item.minimum_stock || 0)}`}
                          arrow
                        >
                          <Chip
                            size="small"
                            label={stock.label}
                            color={stock.color}
                            variant="outlined"
                          />
                        </Tooltip>
                      </TableCell>

                      <TableCell>
                        <Tooltip
                          title={
                            expiry.daysRemaining === null
                              ? "No expiry date configured"
                              : expiry.daysRemaining < 0
                              ? `${Math.abs(expiry.daysRemaining)} day(s) past expiry`
                              : `${expiry.daysRemaining} day(s) remaining`
                          }
                          arrow
                        >
                          <Chip
                            size="small"
                            label={expiry.label}
                            color={expiry.color}
                            variant="outlined"
                            sx={{ maxWidth: 165 }}
                          />
                        </Tooltip>
                      </TableCell>

                      <TableCell>
                        <Chip
                          size="small"
                          label={priority.label}
                          color={priority.color}
                          variant={priority.key === "normal" ? "outlined" : "filled"}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!filtered.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={13}>
                      <Stack alignItems="center" spacing={1.25} sx={{ py: 9 }}>
                        <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "action.hover", display: "grid", placeItems: "center" }}><Inventory2RoundedIcon color="disabled" sx={{ fontSize: 34 }} /></Box>
                        <Typography variant="h6">No products match your filters</Typography>
                        <Typography variant="body2" color="text.secondary">Try changing Stock Status, Expiry Status, Priority or the search term.</Typography>
                        <Button variant="outlined" startIcon={<RestartAltRoundedIcon />} onClick={clearFilters}>Clear Filters</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow><TableCell colSpan={13}><Stack alignItems="center" spacing={1.5} sx={{ py: 8 }}><CircularProgress size={30} /><Typography variant="body2" color="text.secondary">Loading stock and expiry data...</Typography></Stack></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={Boolean(bulkDialog)} onClose={() => !bulkSaving && setBulkDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {bulkDialog === "stock" && "Bulk Stock Adjustment"}
          {bulkDialog === "batch" && "Update Batch Number"}
          {bulkDialog === "expiry" && "Update Expiry Date"}
          {bulkDialog === "delete" && "Delete Selected Products"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.25}>
            <Alert severity={bulkDialog === "delete" ? "error" : "info"}>{selectedRows.length} selected product(s) will be affected.</Alert>
            {bulkDialog === "stock" && (
              <>
                <TextField fullWidth type="number" label="Stock +/-" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} helperText="Positive adds stock; negative reduces stock. Applied equally to selected products." />
                <TextField fullWidth label="Reason" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
              </>
            )}
            {bulkDialog === "batch" && <TextField fullWidth label="New Batch Number" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />}
            {bulkDialog === "expiry" && <TextField fullWidth type="date" label="New Expiry Date" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />}
            {bulkDialog === "delete" && <Typography color="error.main">This action cannot be undone. Products already used in sales may be protected by the backend and will not be deleted.</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setBulkDialog(null)} disabled={bulkSaving}>Cancel</Button>
          <Button variant="contained" color={bulkDialog === "delete" ? "error" : "primary"} onClick={performBulkAction} disabled={bulkSaving}>
            {bulkSaving ? "Processing..." : bulkDialog === "delete" ? "Delete Selected" : "Apply Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
