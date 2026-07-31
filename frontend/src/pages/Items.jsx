import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, Grid, InputAdornment, InputLabel,
  Menu, MenuItem, Select, Stack, TextField, Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import TableViewRoundedIcon from "@mui/icons-material/TableViewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import AddBoxRoundedIcon from "@mui/icons-material/AddBoxRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import EventBusyRoundedIcon from "@mui/icons-material/EventBusyRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import {
  addItem,
  addStockAdjustment,
  bulkUpdateItems,
  deleteItem,
  getItems,
  getStockAdjustmentHistory,
  importItems,
  updateItem,
} from "../services/api";

const money = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(Number(value || 0));

const EMPTY_FORM = {
  item_name: "",
  barcode: "",
  purchase_price: "",
  mrp: "",
  sale_price: "",
 gst_percent: 0,
  stock: 0,

  minimum_stock: 5,
  expiry_alert_days: 30,
  batch_number: "",
  manufacturing_date: "",
  expiry_date: "",
};

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeHeader = (value) =>
  String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[%()₹$]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeImportRow = (row) => {
  const normalizedRow = Object.entries(row || {}).reduce((result, [key, value]) => {
    result[normalizeHeader(key)] = value;
    return result;
  }, {});

  const pick = (...keys) => {
    for (const key of keys) {
      const value = normalizedRow[normalizeHeader(key)];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
    return "";
  };

  const itemName = pick(
    "item_name",
    "item",
    "product",
    "product_name",
    "item_description",
    "description",
    "name"
  );

  const barcode = pick(
    "barcode",
    "bar_code",
    "item_code",
    "product_code",
    "sku",
    "code"
  );

  const purchasePrice = pick(
    "purchase_price",
    "purchase_prise",
    "purchase_rate",
    "cost_price",
    "cost",
    "buy_price",
    "buying_price"
  );

  const salePrice = pick(
    "sale_price",
    "sales_price",
    "selling_price",
    "selling_rate",
    "sale_rate",
    "rate"
  );

  const mrp = pick(
    "mrp",
    "mrp_price",
    "maximum_retail_price",
    "retail_price"
  );

  const gst = pick(
    "gst_percent",
    "gst",
    "gst_percentage",
    "tax_percent",
    "tax"
  );

  const stock = pick(
    "stock",
    "opening_stock",
    "quantity",
    "qty",
    "available_stock"
  );

  const minimumStock = pick("minimum_stock", "min_stock", "reorder_level", "reorder_qty");
  const batchNumber = pick("batch_number", "batch_no", "batch", "lot_number");
  const manufacturingDate = pick("manufacturing_date", "mfg_date", "manufacture_date");
  const expiryDate = pick("expiry_date", "expiry", "expiration_date", "best_before");
  const expiryAlertDays = pick("expiry_alert_days", "alert_days", "expiry_warning_days");

  const cleanNumber = (value) =>
    numberValue(
      String(value ?? "")
        .replace(/,/g, "")
        .replace(/[₹$%]/g, "")
        .trim()
    );

  const parsedSalePrice = cleanNumber(salePrice);

  return {
    item_name: String(itemName ?? "").trim(),
    barcode: String(barcode ?? "")
      .replace(/\.0$/, "")
      .trim(),
    purchase_price: cleanNumber(purchasePrice),
    mrp: mrp === "" ? parsedSalePrice : cleanNumber(mrp),
    sale_price: parsedSalePrice,
    gst_percent: cleanNumber(gst),
    stock: cleanNumber(stock),
    minimum_stock: minimumStock === "" ? 5 : cleanNumber(minimumStock),
    batch_number: String(batchNumber || "").trim(),
    manufacturing_date: String(manufacturingDate || "").trim() || null,
    expiry_date: String(expiryDate || "").trim() || null,
    expiry_alert_days: expiryAlertDays === "" ? 30 : cleanNumber(expiryAlertDays),
  };
};

const SAMPLE_HEADERS = [
  "item_name",
  "barcode",
  "purchase_price",
  "mrp",
  "sale_price",
  "gst_percent", "stock", "minimum_stock", "batch_number",
  "manufacturing_date", "expiry_date", "expiry_alert_days",
];

const SAMPLE_ROW = {
  item_name: "Sample Product",
  barcode: "8901234567890",
  purchase_price: 100,
  mrp: 150,
  sale_price: 140,
  gst_percent: 18, stock: 50, minimum_stock: 10,
  batch_number: "BATCH-001", manufacturing_date: "2026-01-01",
  expiry_date: "2027-01-01", expiry_alert_days: 30,
};


const ADJUSTMENT_REASONS = [
  "New Purchase",
  "Damaged",
  "Expired",
  "Returned by Customer",
  "Supplier Return",
  "Stock Correction",
  "Opening Stock",
  "MRP Update",
  "Sale Price Update",
  "GST % Update",
  "Purchase Price Update",
  "Physical Verification",
  "Free Sample",
  "Other",
];

const hasPriceOrTaxChange = (row) =>
  Number(row.purchase_price || 0) !== Number(row.original_purchase_price || 0) ||
  Number(row.mrp || 0) !== Number(row.original_mrp || 0) ||
  Number(row.sale_price || 0) !== Number(row.original_sale_price || 0) ||
  Number(row.gst_percent || 0) !== Number(row.original_gst_percent || 0);

const resolveAutomaticReason = (row) => {
  const changedFields = [];

  if (Number(row.purchase_price || 0) !== Number(row.original_purchase_price || 0)) {
    changedFields.push("Purchase Price Update");
  }

  if (Number(row.mrp || 0) !== Number(row.original_mrp || 0)) {
    changedFields.push("MRP Update");
  }

  if (Number(row.sale_price || 0) !== Number(row.original_sale_price || 0)) {
    changedFields.push("Sale Price Update");
  }

  if (Number(row.gst_percent || 0) !== Number(row.original_gst_percent || 0)) {
    changedFields.push("GST % Update");
  }

  return changedFields.length === 1 ? changedFields[0] : "";
};

const stockStatus = (item) => {
  const stock = Number(item?.stock || 0);
  const minimumStock = Number(item?.minimum_stock || 0);
  if (stock <= 0) return { label: "Out of Stock", color: "error" };
  if (stock <= minimumStock) return { label: "Low Stock", color: "warning" };
  return { label: "Healthy", color: "success" };
};

const expiryStatus = (item) => {
  if (!item?.expiry_date) return { label: "Not Applicable", color: "default", daysRemaining: null };
  const expiry = new Date(`${item.expiry_date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((expiry - today) / 86400000);
  if (daysRemaining < 0) return { label: "Expired", color: "error", daysRemaining };
  if (daysRemaining <= Number(item.expiry_alert_days || 30)) {
    return { label: "Expiring Soon", color: "warning", daysRemaining };
  }
  return { label: "Safe", color: "success", daysRemaining };
};

export default function Items() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState([]);
  const [modifiedRowIds, setModifiedRowIds] = useState(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustment: "",
    reason: "",
    custom_reason: "",
  });
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReasonFilter, setHistoryReasonFilter] = useState("all");
  const [importMenuAnchor, setImportMenuAnchor] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const fileRef = useRef(null);

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getItems();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const term = search.trim().toLowerCase();
    const stock = Number(item.stock || 0);
    const minimumStock = Number(item.minimum_stock || 0);
    const expiry = expiryStatus(item);
    const matchesSearch = !term || `${item.item_name} ${item.barcode} ${item.batch_number || ""}`.toLowerCase().includes(term);
    const matchesFilter =
      filter === "all" ||
      (filter === "healthy" && stock > minimumStock) ||
      (filter === "low" && stock > 0 && stock <= minimumStock) ||
      (filter === "out" && stock <= 0) ||
      (filter === "expired" && expiry.label === "Expired") ||
      (filter === "expiring" && expiry.label === "Expiring Soon") ||
      (filter === "safe" && expiry.label === "Safe");
    return matchesSearch && matchesFilter;
  }), [items, search, filter]);

  const summary = useMemo(() => ({
    products: items.length,
    totalStock: items.reduce((sum, item) => sum + Number(item.stock || 0), 0),
    inventoryValue: items.reduce((sum, item) => sum + Number(item.purchase_price || 0) * Number(item.stock || 0), 0),
    lowStock: items.filter((item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= Number(item.minimum_stock || 0)).length,
    outOfStock: items.filter((item) => Number(item.stock || 0) <= 0).length,
    expired: items.filter((item) => expiryStatus(item).label === "Expired").length,
    expiringSoon: items.filter((item) => expiryStatus(item).label === "Expiring Soon").length,
  }), [items]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      item_name: item.item_name ?? "",
      barcode: item.barcode ?? "",
      purchase_price: item.purchase_price ?? "",
      mrp: item.mrp ?? "",
      sale_price: item.sale_price ?? "",
      gst_percent: item.gst_percent ?? "0",
      stock: item.stock ?? "0",
      minimum_stock: item.minimum_stock ?? "5",
      batch_number: item.batch_number ?? "",
      manufacturing_date: item.manufacturing_date ?? "",
      expiry_date: item.expiry_date ?? "",
      expiry_alert_days: item.expiry_alert_days ?? "30",
    });
    setDialogOpen(true);
  };

  const validate = () => {
    const purchase = numberValue(form.purchase_price);
    const mrp = numberValue(form.mrp);
    const sale = numberValue(form.sale_price);
    const gst = numberValue(form.gst_percent);
    const stock = numberValue(form.stock);
    const minimumStock = numberValue(form.minimum_stock);
    const expiryAlertDays = numberValue(form.expiry_alert_days);
    if (!form.item_name.trim()) return "Item name is required.";
    if (!form.barcode.trim()) return "Barcode is required.";
    if ([purchase, mrp, sale, gst, stock, minimumStock, expiryAlertDays].some((value) => value < 0)) return "Negative values are not allowed.";
    if (sale > mrp) return "Sale price cannot exceed MRP.";
    if (purchase > sale) return "Purchase price cannot exceed sale price.";
    if (!Number.isInteger(stock)) return "Stock must be a whole number.";
    if (!Number.isInteger(minimumStock)) return "Minimum stock must be a whole number.";
    if (!Number.isInteger(expiryAlertDays)) return "Expiry alert days must be a whole number.";
    if (form.manufacturing_date && form.expiry_date && new Date(form.expiry_date) < new Date(form.manufacturing_date)) {
      return "Expiry date cannot be before manufacturing date.";
    }
    return "";
  };

  const payload = () => ({
    item_name: form.item_name.trim(), barcode: form.barcode.trim(),
    purchase_price: numberValue(form.purchase_price), mrp: numberValue(form.mrp),
    sale_price: numberValue(form.sale_price), gst_percent: numberValue(form.gst_percent),
    stock: numberValue(form.stock),
    minimum_stock: numberValue(form.minimum_stock),
    batch_number: form.batch_number.trim() || null,
    manufacturing_date: form.manufacturing_date || null,
    expiry_date: form.expiry_date || null,
    expiry_alert_days: numberValue(form.expiry_alert_days),
  });

  const save = async () => {
    const error = validate();
    if (error) return setMessage({ type: "warning", text: error });
    try {
      setSaving(true);
      if (editing) await updateItem(editing.id, payload());
      else await addItem(payload());
      await load(true);
      setDialogOpen(false);
      setMessage({ type: "success", text: editing ? "Item updated successfully." : "Item added successfully." });
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.item_name}"?`)) return;
    try {
      await deleteItem(item.id);
      await load(true);
      setMessage({ type: "success", text: "Item deleted successfully." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };


  const closeImportMenu = () => setImportMenuAnchor(null);

  const openFilePicker = () => {
    closeImportMenu();
    fileRef.current?.click();
  };

  const downloadSampleExcel = () => {
    const itemsSheet = XLSX.utils.json_to_sheet([SAMPLE_ROW], {
      header: SAMPLE_HEADERS,
    });

    const instructionSheet = XLSX.utils.aoa_to_sheet([
      ["Inventory Import Instructions"],
      [""],
      ["1", "Do not rename or remove any header column."],
      ["2", "item_name and barcode are mandatory."],
      ["3", "Barcode must be unique."],
      ["4", "purchase_price cannot exceed sale_price."],
      ["5", "sale_price cannot exceed mrp."],
      ["6", "gst_percent and stock cannot be negative."],
      ["7", "Stock must be entered as a whole number."],
      ["8", "Delete the sample row before entering actual inventory, if required."],
    ]);

    itemsSheet["!cols"] = [
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 15 },
      { wch: 12 },
    ];
    instructionSheet["!cols"] = [{ wch: 6 }, { wch: 70 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, itemsSheet, "Items");
    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instructions");
    XLSX.writeFile(workbook, "Inventory_Import_Template.xlsx");

    closeImportMenu();
  };

  const downloadSampleCsv = () => {
    const worksheet = XLSX.utils.json_to_sheet([SAMPLE_ROW], {
      header: SAMPLE_HEADERS,
    });
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Inventory_Import_Template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    closeImportMenu();
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
      });

      if (!rows.length) {
        throw new Error("The selected file is empty or does not contain a data table.");
      }

      const normalized = rows
        .map(normalizeImportRow)
        .filter((row) => row.item_name && row.barcode);

      if (!normalized.length) {
        const detectedHeaders = Object.keys(rows[0] || {}).join(", ");

        throw new Error(
          `No valid rows found. Item Name and Barcode are required. ` +
          `Detected columns: ${detectedHeaders || "none"}. ` +
          `Supported examples: Item Name, Barcode, Purchase Price, MRP, Sale Price, GST %, Stock, Minimum Stock, Batch No, Mfg Date, Expiry Date.`
        );
      }
      const invalid = normalized.find((row) =>
        row.purchase_price < 0 || row.mrp < 0 || row.sale_price < 0 ||
        row.gst_percent < 0 || row.stock < 0 || row.minimum_stock < 0 ||
        row.expiry_alert_days < 0 || row.sale_price > row.mrp ||
        row.purchase_price > row.sale_price || !Number.isInteger(row.stock) ||
        !Number.isInteger(row.minimum_stock) || !Number.isInteger(row.expiry_alert_days) ||
        (row.manufacturing_date && row.expiry_date &&
          new Date(row.expiry_date) < new Date(row.manufacturing_date))
      );
      if (invalid) throw new Error(`Invalid pricing or stock for ${invalid.item_name}.`);
      const result = await importItems(normalized);
      await load(true);
      setMessage({ type: "success", text: `${result.created || 0} items imported. ${result.skipped?.length || 0} duplicate barcodes skipped.` });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };


  const openBulkUpdate = () => {
    setBulkRows(
      items.map((item) => ({
        id: item.id,
        item_name: item.item_name ?? "",
        barcode: item.barcode ?? "",
        purchase_price: Number(item.purchase_price || 0),
        mrp: Number(item.mrp || 0),
        sale_price: Number(item.sale_price || 0),
        gst_percent: Number(item.gst_percent || 0),
        original_purchase_price: Number(item.purchase_price || 0),
        original_mrp: Number(item.mrp || 0),
        original_sale_price: Number(item.sale_price || 0),
        original_gst_percent: Number(item.gst_percent || 0),
        minimum_stock: Number(item.minimum_stock ?? 5),
        batch_number: item.batch_number ?? "",
        manufacturing_date: item.manufacturing_date ?? "",
        expiry_date: item.expiry_date ?? "",
        expiry_alert_days: Number(item.expiry_alert_days ?? 30),
        current_stock: Number(item.stock || 0),
        stock_adjustment: 0,
        adjustment_reason: "",
        custom_reason: "",
      }))
    );
    setModifiedRowIds(new Set());
    setBulkDialogOpen(true);
  };

  const processBulkRowUpdate = (newRow, oldRow) => {
    const numericFields = [
      "purchase_price",
      "mrp",
      "sale_price",
      "gst_percent", "minimum_stock", "expiry_alert_days",
      "stock_adjustment",
    ];

    const normalizedRow = {
      ...newRow,
      item_name: String(newRow.item_name || "").trimStart(),
      barcode: String(newRow.barcode || "").trim(),
      adjustment_reason: String(newRow.adjustment_reason || ""),
      custom_reason: String(newRow.custom_reason || ""),
      batch_number: String(newRow.batch_number || ""),
      manufacturing_date: String(newRow.manufacturing_date || ""),
      expiry_date: String(newRow.expiry_date || ""),
    };

    numericFields.forEach((field) => {
      normalizedRow[field] = numberValue(newRow[field]);
    });

    const priceReason = resolveAutomaticReason(normalizedRow);
    const reasonWasManuallyChanged =
      normalizedRow.adjustment_reason !== oldRow.adjustment_reason;

    if (
      !reasonWasManuallyChanged &&
      Number(normalizedRow.stock_adjustment || 0) === 0 &&
      priceReason
    ) {
      normalizedRow.adjustment_reason = priceReason;
    }

    if (
      normalizedRow.adjustment_reason !== "Other" &&
      normalizedRow.custom_reason
    ) {
      normalizedRow.custom_reason = "";
    }

    const changed = Object.keys(normalizedRow).some(
      (key) => normalizedRow[key] !== oldRow[key]
    );

    if (changed) {
      setModifiedRowIds((current) => {
        const next = new Set(current);
        next.add(newRow.id);
        return next;
      });
    }

    setBulkRows((current) =>
      current.map((row) => (row.id === newRow.id ? normalizedRow : row))
    );

    return normalizedRow;
  };

  const validateBulkRows = (rows) => {
    const barcodes = new Set();

    for (const row of rows) {
      if (!String(row.item_name || "").trim()) {
        return `Item name is required for row ${row.id}.`;
      }

      if (!String(row.barcode || "").trim()) {
        return `Barcode is required for ${row.item_name || `row ${row.id}`}.`;
      }

      const barcode = String(row.barcode).trim().toLowerCase();

      if (barcodes.has(barcode)) {
        return `Duplicate barcode found in bulk grid: ${row.barcode}.`;
      }

      barcodes.add(barcode);

      const purchase = numberValue(row.purchase_price);
      const mrp = numberValue(row.mrp);
      const sale = numberValue(row.sale_price);
      const gst = numberValue(row.gst_percent);
      const minimumStock = numberValue(row.minimum_stock);
      const expiryAlertDays = numberValue(row.expiry_alert_days);
      const adjustment = numberValue(row.stock_adjustment);
      const resultingStock = Number(row.current_stock || 0) + adjustment;

      if ([purchase, mrp, sale, gst, minimumStock, expiryAlertDays].some((value) => value < 0)) {
        return `Negative pricing or GST is not allowed for ${row.item_name}.`;
      }

      if (purchase > sale) {
        return `Purchase price cannot exceed sale price for ${row.item_name}.`;
      }

      if (sale > mrp) {
        return `Sale price cannot exceed MRP for ${row.item_name}.`;
      }

      if (!Number.isInteger(minimumStock)) {
        return `Minimum stock must be a whole number for ${row.item_name}.`;
      }
      if (!Number.isInteger(expiryAlertDays)) {
        return `Expiry alert days must be a whole number for ${row.item_name}.`;
      }
      if (row.manufacturing_date && row.expiry_date && new Date(row.expiry_date) < new Date(row.manufacturing_date)) {
        return `Expiry date cannot be before manufacturing date for ${row.item_name}.`;
      }
      if (!Number.isInteger(adjustment)) {
        return `Stock adjustment must be a whole number for ${row.item_name}.`;
      }

      if (resultingStock < 0) {
        return `Stock cannot become negative for ${row.item_name}.`;
      }

      const rowWasModified = modifiedRowIds.has(row.id);
      const priceOrTaxChanged = hasPriceOrTaxChange(row);

      if (
        rowWasModified &&
        (adjustment !== 0 || priceOrTaxChanged) &&
        !String(row.adjustment_reason || "").trim()
      ) {
        return `Reason is required for ${row.item_name}.`;
      }

      if (
        row.adjustment_reason === "Other" &&
        !String(row.custom_reason || "").trim()
      ) {
        return `Custom reason is required for ${row.item_name}.`;
      }
    }

    return "";
  };

  const saveBulkChanges = async () => {
    const rowsToSave = bulkRows.filter((row) => modifiedRowIds.has(row.id));

    if (!rowsToSave.length) {
      setMessage({ type: "info", text: "No bulk changes to save." });
      return;
    }

    const validationError = validateBulkRows(bulkRows);

    if (validationError) {
      setMessage({ type: "warning", text: validationError });
      return;
    }

    try {
      setBulkSaving(true);

      const payloadRows = rowsToSave.map((row) => ({
        id: row.id,
        item_name: String(row.item_name).trim(),
        barcode: String(row.barcode).trim(),
        purchase_price: numberValue(row.purchase_price),
        mrp: numberValue(row.mrp),
        sale_price: numberValue(row.sale_price),
        gst_percent: numberValue(row.gst_percent),
        minimum_stock: numberValue(row.minimum_stock),
        batch_number: String(row.batch_number || "").trim() || null,
        manufacturing_date: row.manufacturing_date || null,
        expiry_date: row.expiry_date || null,
        expiry_alert_days: numberValue(row.expiry_alert_days),
        stock_adjustment: numberValue(row.stock_adjustment),
        adjustment_reason:
          row.adjustment_reason === "Other"
            ? `Other - ${String(row.custom_reason || "").trim()}`
            : String(row.adjustment_reason || "").trim(),
      }));

      const result = await bulkUpdateItems(payloadRows);
      await load(true);

      setBulkDialogOpen(false);
      setModifiedRowIds(new Set());
      setMessage({
        type: "success",
        text: result.message || `${payloadRows.length} products updated successfully.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBulkSaving(false);
    }
  };

  const exportInventory = () => {
    const exportRows = filtered.map((item) => ({
      item_name: item.item_name,
      barcode: item.barcode,
      purchase_price: Number(item.purchase_price || 0),
      mrp: Number(item.mrp || 0),
      sale_price: Number(item.sale_price || 0),
      gst_percent: Number(item.gst_percent || 0),
      stock: Number(item.stock || 0),
      minimum_stock: Number(item.minimum_stock || 0),
      stock_status: stockStatus(item).label,
      batch_number: item.batch_number || "",
      manufacturing_date: item.manufacturing_date || "",
      expiry_date: item.expiry_date || "",
      expiry_alert_days: Number(item.expiry_alert_days || 30),
      days_remaining: expiryStatus(item).daysRemaining ?? "",
      expiry_status: expiryStatus(item).label,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 26 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, "Inventory_Export.xlsx");
  };

  const bulkColumns = [
    { field: "item_name", headerName: "Item Name", minWidth: 220, flex: 1.2, editable: true },
    { field: "barcode", headerName: "Barcode", minWidth: 150, editable: true },
    {
      field: "purchase_price",
      headerName: "Purchase",
      type: "number",
      minWidth: 120,
      editable: true,
    },
    {
      field: "mrp",
      headerName: "MRP",
      type: "number",
      minWidth: 110,
      editable: true,
    },
    {
      field: "sale_price",
      headerName: "Sale",
      type: "number",
      minWidth: 110,
      editable: true,
    },
    {
      field: "gst_percent",
      headerName: "GST %",
      type: "number",
      minWidth: 90,
      editable: true,
    },
    { field: "minimum_stock", headerName: "Minimum Stock", type: "number", minWidth: 130, editable: true },
    { field: "batch_number", headerName: "Batch No.", minWidth: 130, editable: true },
    { field: "manufacturing_date", headerName: "Mfg Date", minWidth: 135, editable: true },
    { field: "expiry_date", headerName: "Expiry Date", minWidth: 135, editable: true },
    { field: "expiry_alert_days", headerName: "Alert Days", type: "number", minWidth: 110, editable: true },
    {
      field: "current_stock",
      headerName: "Current Stock",
      type: "number",
      minWidth: 120,
      editable: false,
    },
    {
      field: "stock_adjustment",
      headerName: "Stock +/-",
      type: "number",
      minWidth: 120,
      editable: true,
      description: "Use positive values to add stock and negative values to reduce stock.",
    },
    {
      field: "new_stock",
      headerName: "Updated Stock",
      type: "number",
      minWidth: 110,
      valueGetter: (_value, row) =>
        Number(row.current_stock || 0) + Number(row.stock_adjustment || 0),
    },
    {
      field: "adjustment_reason",
      headerName: "Reason",
      type: "singleSelect",
      valueOptions: ADJUSTMENT_REASONS,
      minWidth: 210,
      flex: 1,
      editable: true,
      renderCell: ({ value, row }) => {
        const hasRelevantChange =
          Number(row.stock_adjustment || 0) !== 0 || hasPriceOrTaxChange(row);

        if (!hasRelevantChange && !value) {
          return (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          );
        }

        return value || "Select reason";
      },
    },
    {
      field: "custom_reason",
      headerName: "Custom Reason",
      minWidth: 220,
      flex: 1,
      editable: true,
      renderCell: ({ value, row }) =>
        row.adjustment_reason === "Other" ? (
          value || "Enter custom reason"
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
  ];


  const openStockAdjustment = (item) => {
    setAdjustingItem(item);
    setAdjustmentForm({
      adjustment: "",
      reason: "",
      custom_reason: "",
    });
    setAdjustDialogOpen(true);
  };

  const saveStockAdjustment = async () => {
    const adjustment = Number(adjustmentForm.adjustment || 0);

    if (!Number.isInteger(adjustment) || adjustment === 0) {
      setMessage({
        type: "warning",
        text: "Enter a non-zero whole-number stock adjustment.",
      });
      return;
    }

    if (Number(adjustingItem?.stock || 0) + adjustment < 0) {
      setMessage({
        type: "warning",
        text: "The updated stock cannot be negative.",
      });
      return;
    }

    if (!adjustmentForm.reason) {
      setMessage({
        type: "warning",
        text: "Select an adjustment reason.",
      });
      return;
    }

    if (
      adjustmentForm.reason === "Other" &&
      !adjustmentForm.custom_reason.trim()
    ) {
      setMessage({
        type: "warning",
        text: "Enter a custom reason.",
      });
      return;
    }

    const reason =
      adjustmentForm.reason === "Other"
        ? `Other - ${adjustmentForm.custom_reason.trim()}`
        : adjustmentForm.reason;

    try {
      setAdjustmentSaving(true);

      await addStockAdjustment(adjustingItem.id, {
        adjustment,
        reason,
      });

      await load(true);
      setAdjustDialogOpen(false);
      setAdjustingItem(null);
      setMessage({
        type: "success",
        text: "Stock adjusted successfully.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setAdjustmentSaving(false);
    }
  };

  const openStockHistory = async (item) => {
    setHistoryDialogOpen(true);
    setHistoryItem(item);
    setHistoryRows([]);
    setHistoryReasonFilter("all");
    setHistoryLoading(true);

    try {
      const result = await getStockAdjustmentHistory(item.id);
      setHistoryItem(result.item || item);
      setHistoryRows(Array.isArray(result.history) ? result.history : []);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredHistoryRows = useMemo(() => {
    if (historyReasonFilter === "all") return historyRows;

    return historyRows.filter(
      (row) => row.reason === historyReasonFilter
    );
  }, [historyRows, historyReasonFilter]);

  const historyReasonOptions = useMemo(
    () => [...new Set(historyRows.map((row) => row.reason).filter(Boolean))],
    [historyRows]
  );

  const exportStockHistory = () => {
    const exportRows = filteredHistoryRows.map((row) => ({
      date_time: row.created_at
        ? new Date(row.created_at).toLocaleString("en-IN")
        : "",
      previous_stock: row.previous_stock,
      adjustment: row.adjustment,
      updated_stock: row.new_stock,
      reason: row.reason,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 28 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock History");

    const safeName = String(historyItem?.item_name || "Item")
      .replace(/[\\/:*?"<>|]/g, "_");

    XLSX.writeFile(workbook, `${safeName}_Stock_History.xlsx`);
  };

  const historyColumns = [
    {
      field: "created_at",
      headerName: "Date & Time",
      minWidth: 190,
      flex: 1,
      valueFormatter: (value) =>
        value ? new Date(value).toLocaleString("en-IN") : "—",
    },
    {
      field: "previous_stock",
      headerName: "Previous",
      type: "number",
      minWidth: 110,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "adjustment",
      headerName: "Change",
      type: "number",
      minWidth: 110,
      align: "center",
      headerAlign: "center",
      renderCell: ({ value }) => (
        <Chip
          size="small"
          icon={
            Number(value) > 0 ? (
              <TrendingUpRoundedIcon />
            ) : (
              <TrendingDownRoundedIcon />
            )
          }
          color={Number(value) > 0 ? "success" : "error"}
          label={`${Number(value) > 0 ? "+" : ""}${value}`}
          variant="outlined"
        />
      ),
    },
    {
      field: "new_stock",
      headerName: "Updated",
      type: "number",
      minWidth: 110,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "reason",
      headerName: "Reason",
      minWidth: 220,
      flex: 1.4,
    },
  ];

  const columns = [
    { field: "item_name", headerName: "Product", minWidth: 220, flex: 1.2,
      renderCell: ({ row }) => <Box sx={{ py: 1 }}><Typography fontWeight={700}>{row.item_name}</Typography><Typography variant="caption" color="text.secondary">Purchase {money(row.purchase_price)}</Typography></Box> },
    { field: "barcode", headerName: "Barcode", minWidth: 150, flex: 0.8 },
    { field: "mrp", headerName: "MRP", minWidth: 120, align: "right", headerAlign: "right", valueFormatter: (value) => money(value) },
    { field: "sale_price", headerName: "Sale Price", minWidth: 130, align: "right", headerAlign: "right", valueFormatter: (value) => money(value) },
    { field: "gst_percent", headerName: "GST", minWidth: 85, align: "center", headerAlign: "center", valueFormatter: (value) => `${Number(value || 0)}%` },
    { field: "stock", headerName: "Stock", minWidth: 85, align: "center", headerAlign: "center" },
    { field: "status", headerName: "Status", minWidth: 125, sortable: false, renderCell: ({ row }) => { const status = stockStatus(row.stock); return <Chip size="small" label={status.label} color={status.color} variant="outlined" />; } },
    {
      field: "actions",
      headerName: "Actions",
      minWidth: 330,
      sortable: false,
      filterable: false,
      align: "center",
      headerAlign: "center",
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.25}>
          <Button
            size="small"
            startIcon={<EditRoundedIcon />}
            onClick={(event) => {
              event.stopPropagation();
              openEdit(row);
            }}
          >
            Edit
          </Button>

          <Button
            size="small"
            color="primary"
            startIcon={<AddBoxRoundedIcon />}
            onClick={(event) => {
              event.stopPropagation();
              openStockAdjustment(row);
            }}
          >
            Adjust
          </Button>

          <Button
            size="small"
            color="inherit"
            startIcon={<HistoryRoundedIcon />}
            onClick={(event) => {
              event.stopPropagation();
              openStockHistory(row);
            }}
          >
            History
          </Button>

          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={(event) => {
              event.stopPropagation();
              remove(row);
            }}
          >
            Delete
          </Button>
        </Stack>
      ),
    },
  ];

  const cards = [
    ["Total products", summary.products, "Active inventory records"],
    ["Total stock", summary.totalStock, "Units currently available"],
    ["Inventory value", money(summary.inventoryValue), "Based on purchase price"],
    ["Low stock", summary.lowStock, "Between 1 and 5 units"],
    ["Out of stock", summary.outOfStock, "Requires replenishment"],
  ];

  return <AppLayout>
    <PageHeader title="Items & Inventory" subtitle="Manage products, pricing, GST and stock from one place" />
    {message.text && <Alert severity={message.type} sx={{ mb: 2.5 }} onClose={() => setMessage({ type: "", text: "" })}>{message.text}</Alert>}

    <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} justifyContent="flex-end" sx={{ mb: 2.5 }}>
      <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openAdd}>Add Item</Button>

      <Button
        variant="outlined"
        startIcon={<EditNoteRoundedIcon />}
        onClick={openBulkUpdate}
        disabled={!items.length}
      >
        Bulk Update
      </Button>

      <Button
        id="inventory-import-button"
        variant="outlined"
        startIcon={<UploadFileRoundedIcon />}
        endIcon={<KeyboardArrowDownRoundedIcon />}
        onClick={(event) => setImportMenuAnchor(event.currentTarget)}
        disabled={importing}
        aria-controls={importMenuAnchor ? "inventory-import-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={importMenuAnchor ? "true" : undefined}
      >
        {importing ? "Importing..." : "Import / Template"}
      </Button>

      <Menu
        id="inventory-import-menu"
        anchorEl={importMenuAnchor}
        open={Boolean(importMenuAnchor)}
        onClose={closeImportMenu}
        MenuListProps={{ "aria-labelledby": "inventory-import-button" }}
        PaperProps={{ sx: { mt: 1, minWidth: 260, borderRadius: 2 } }}
      >
        <MenuItem onClick={openFilePicker}>
          <UploadFileRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />
          Import Excel / CSV
        </MenuItem>
        <MenuItem onClick={downloadSampleExcel}>
          <TableViewRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />
          Download Sample Excel
        </MenuItem>
        <MenuItem onClick={downloadSampleCsv}>
          <DownloadRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />
          Download Sample CSV
        </MenuItem>
      </Menu>

      <Button variant="outlined" startIcon={<FileDownloadRoundedIcon />} onClick={exportInventory} disabled={!filtered.length}>Export Excel</Button>
      <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => load()} disabled={loading}>Refresh</Button>
      <input hidden ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={importFile} />
    </Stack>

    <Grid container spacing={2.25} sx={{ mb: 3 }}>
      {cards.map(([label, value, helper]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 2.4 }}><Card sx={{ height: "100%" }}><CardContent><Stack direction="row" spacing={1.25} alignItems="center"><Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center" }}><Inventory2RoundedIcon fontSize="small" /></Box><Box minWidth={0}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h6" fontWeight={800} noWrap>{value}</Typography></Box></Stack><Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>{helper}</Typography></CardContent></Card></Grid>)}
    </Grid>

    <Card><CardContent sx={{ p: 0 }}><Box sx={{ p: 2.5, display: "flex", gap: 1.5, justifyContent: "space-between", flexDirection: { xs: "column", md: "row" }, borderBottom: 1, borderColor: "divider" }}><Box><Typography variant="h6">Inventory catalogue</Typography><Typography variant="body2" color="text.secondary">Search, filter, edit and maintain inventory records.</Typography></Box><Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}><TextField size="small" placeholder="Search item or barcode" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: { sm: 280 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} /><FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Stock Status</InputLabel><Select label="Stock Status" value={filter} onChange={(e) => setFilter(e.target.value)}><MenuItem value="all">All Items</MenuItem><MenuItem value="healthy">Healthy Stock</MenuItem><MenuItem value="low">Low Stock</MenuItem><MenuItem value="out">Out of Stock</MenuItem><MenuItem value="expired">Expired</MenuItem><MenuItem value="expiring">Expiring Soon</MenuItem><MenuItem value="safe">Safe Expiry</MenuItem></Select></FormControl></Stack></Box><DataGrid autoHeight rows={filtered} columns={columns} loading={loading} disableRowSelectionOnClick pageSizeOptions={[10, 25, 50, 100]} initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }} getRowHeight={() => "auto"} sx={{ border: 0, "& .MuiDataGrid-columnHeaders": { bgcolor: "background.default" }, "& .MuiDataGrid-cell": { py: 1 } }} /></CardContent></Card>



    <Dialog
      open={adjustDialogOpen}
      onClose={() => !adjustmentSaving && setAdjustDialogOpen(false)}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Stock Adjustment</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.25}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>
              {adjustingItem?.item_name || "Inventory item"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Barcode: {adjustingItem?.barcode || "—"}
            </Typography>
          </Box>

          <Card variant="outlined">
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current Stock
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {Number(adjustingItem?.stock || 0)}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Updated Stock
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    color={
                      Number(adjustmentForm.adjustment || 0) < 0
                        ? "error.main"
                        : "success.main"
                    }
                  >
                    {Number(adjustingItem?.stock || 0) +
                      Number(adjustmentForm.adjustment || 0)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <TextField
            fullWidth
            type="number"
            label="Stock +/-"
            value={adjustmentForm.adjustment}
            onChange={(event) =>
              setAdjustmentForm((current) => ({
                ...current,
                adjustment: event.target.value,
              }))
            }
            helperText="Use a positive number to add stock or a negative number to reduce it."
            inputProps={{ step: 1 }}
          />

          <FormControl fullWidth>
            <InputLabel>Reason</InputLabel>
            <Select
              label="Reason"
              value={adjustmentForm.reason}
              onChange={(event) =>
                setAdjustmentForm((current) => ({
                  ...current,
                  reason: event.target.value,
                  custom_reason:
                    event.target.value === "Other"
                      ? current.custom_reason
                      : "",
                }))
              }
            >
              {ADJUSTMENT_REASONS.map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {reason}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {adjustmentForm.reason === "Other" && (
            <TextField
              fullWidth
              label="Custom Reason"
              value={adjustmentForm.custom_reason}
              onChange={(event) =>
                setAdjustmentForm((current) => ({
                  ...current,
                  custom_reason: event.target.value,
                }))
              }
              multiline
              minRows={2}
            />
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={() => setAdjustDialogOpen(false)}
          disabled={adjustmentSaving}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          startIcon={<SaveRoundedIcon />}
          onClick={saveStockAdjustment}
          disabled={adjustmentSaving}
        >
          {adjustmentSaving ? "Saving..." : "Save Adjustment"}
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      open={historyDialogOpen}
      onClose={() => setHistoryDialogOpen(false)}
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          spacing={1.5}
        >
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Stock Adjustment History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {historyItem?.item_name || "Inventory item"} · Current stock{" "}
              {Number(historyItem?.current_stock ?? historyItem?.stock ?? 0)}
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <FormControl size="small" sx={{ minWidth: 210 }}>
              <InputLabel>Reason Filter</InputLabel>
              <Select
                label="Reason Filter"
                value={historyReasonFilter}
                onChange={(event) =>
                  setHistoryReasonFilter(event.target.value)
                }
              >
                <MenuItem value="all">All Reasons</MenuItem>
                {historyReasonOptions.map((reason) => (
                  <MenuItem key={reason} value={reason}>
                    {reason}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={exportStockHistory}
              disabled={!filteredHistoryRows.length}
            >
              Export Excel
            </Button>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ height: 500, width: "100%" }}>
          <DataGrid
            rows={filteredHistoryRows}
            columns={historyColumns}
            loading={historyLoading}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10, page: 0 },
              },
            }}
            sx={{
              border: 0,
              "& .MuiDataGrid-columnHeaders": {
                bgcolor: "background.default",
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={() => setHistoryDialogOpen(false)}>
          Close
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog
      open={bulkDialogOpen}
      onClose={() => !bulkSaving && setBulkDialogOpen(false)}
      fullWidth
      maxWidth="xl"
    >
      <DialogTitle>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Bulk Inventory Update
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Edit product details directly. Use stock adjustment for additions,
              damages, corrections or returns.
            </Typography>
          </Box>

          <Chip
            color={modifiedRowIds.size ? "primary" : "default"}
            label={`${modifiedRowIds.size} modified row${modifiedRowIds.size === 1 ? "" : "s"}`}
          />
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          Double-click a cell to edit it. Positive stock values add inventory and
          negative values reduce it. Select a reason for stock, price or GST changes.
          Choose Other to enter a custom reason.
        </Alert>

        <Box sx={{ height: 560, width: "100%" }}>
          <DataGrid
            rows={bulkRows}
            columns={bulkColumns}
            processRowUpdate={processBulkRowUpdate}
            isCellEditable={(params) => {
              if (params.field === "custom_reason") {
                return params.row.adjustment_reason === "Other";
              }

              if (params.field === "adjustment_reason") {
                return (
                  Number(params.row.stock_adjustment || 0) !== 0 ||
                  hasPriceOrTaxChange(params.row)
                );
              }

              return params.colDef.editable === true;
            }}
            onProcessRowUpdateError={(error) =>
              setMessage({ type: "error", text: error.message })
            }
            disableRowSelectionOnClick
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25, page: 0 },
              },
            }}
            sx={{
              border: 0,
              "& .MuiDataGrid-columnHeaders": {
                bgcolor: "background.default",
              },
              "& .MuiDataGrid-cell--editing": {
                bgcolor: "action.hover",
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={() => setBulkDialogOpen(false)}
          disabled={bulkSaving}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveRoundedIcon />}
          onClick={saveBulkChanges}
          disabled={bulkSaving || !modifiedRowIds.size}
        >
          {bulkSaving ? "Saving..." : "Save All Changes"}
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="md"><DialogTitle>{editing ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle><DialogContent dividers><Grid container spacing={2} sx={{ pt: 0.5 }}>
      <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth required label="Item Name" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} autoFocus /></Grid>
      <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth required label="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Grid>
      {[['Purchase Price','purchase_price'],['MRP','mrp'],['Sale Price','sale_price'],['GST %','gst_percent'],[editing ? 'Current Stock' : 'Opening Stock','stock'],['Minimum Stock','minimum_stock'],['Expiry Alert Days','expiry_alert_days']].map(([label, key]) => <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}><TextField fullWidth type="number" label={label} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} inputProps={{ min: 0, step: ['stock','minimum_stock','expiry_alert_days'].includes(key) ? 1 : '0.01' }} /></Grid>)}
      <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Batch Number" value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></Grid>
      <Grid size={{ xs: 12, md: 4 }}><TextField
  fullWidth
  label="Manufacturing Date"
  type="date"
  name="manufacturing_date"
  value={form.manufacturing_date || ""}
  onChange={setForm}
  slotProps={{
    inputLabel: {
      shrink: true,
    },
  }}
/></Grid>
      <Grid size={{ xs: 12, md: 4 }}><TextField
  fullWidth
  label="Expiry Date"
  type="date"
  name="expiry_date"
  value={form.expiry_date || ""}
  onChange={setForm}
  slotProps={{
    inputLabel: {
      shrink: true,
    },
  }}
/></Grid>
    </Grid></DialogContent><DialogActions sx={{ px: 3, py: 2 }}><Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving}>{saving ? "Saving..." : editing ? "Update Item" : "Save Item"}</Button></DialogActions></Dialog>
  </AppLayout>;
}
