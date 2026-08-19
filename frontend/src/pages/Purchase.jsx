import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import AddBusinessRoundedIcon from "@mui/icons-material/AddBusinessRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import {
  createPurchase,
  addItem,
  addDealer,
  createPurchaseReturn,
  getDealers,
  getItems,
  getProfitSummary,
  getPurchaseDashboard,
  getPurchaseDetail,
  getPurchaseReturns,
  getPurchases,
  extractPurchaseBill,
  getAISettings,
} from "../services/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const today = () => new Date().toISOString().slice(0, 10);

const emptyHeader = () => ({
  dealer_id: "",
  invoice_number: "",
  purchase_date: today(),
  discount_amount: "",
  freight_amount: "",
  round_off: "",
  paid_amount: "",
  payment_mode: "Credit",
  note: "",
});

const emptyLine = () => ({
  item: null,
  quantity: 1,
  purchase_price: "",
  mrp: "",
  sale_price: "",
  gst_percent: "",
  batch_number: "",
  manufacturing_date: "",
  expiry_date: "",
});


function PurchaseDateField({
  label,
  value,
  onChange,
  fullWidth = true,
}) {
  return (
    <TextField
      fullWidth={fullWidth}
      type="date"
      label={label}
      value={value || ""}
      onChange={onChange}
      slotProps={{
        inputLabel: {
          shrink: true,
        },
        htmlInput: {
          "aria-label": label,
        },
      }}
      sx={{
        "& .MuiInputLabel-root": {
          bgcolor: "background.paper",
          px: 0.5,
        },
      }}
    />
  );
}


export default function Purchase() {
  const [dealers, setDealers] = useState([]);
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [returns, setReturns] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [profit, setProfit] = useState({});

  const [header, setHeader] = useState(emptyHeader);
  const [line, setLine] = useState(emptyLine);
  const [cart, setCart] = useState([]);

  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiExtracting, setAIExtracting] = useState(false);
  const [aiConfigured, setAIConfigured] = useState(false);
  const [aiReview, setAIReview] = useState(null);
  const [newItem, setNewItem] = useState({
    item_name: "", barcode: "", purchase_price: "", mrp: "", sale_price: "",
    gst_percent: "", minimum_stock: 5, batch_number: "",
    manufacturing_date: "", expiry_date: "",
  });
  const [newSupplier, setNewSupplier] = useState({
    dealer_name: "", mobile: "", email: "", gst_number: "", address: "",
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnItem, setReturnItem] = useState(null);
  const [returnForm, setReturnForm] = useState({
    quantity: 1,
    reason: "",
    return_date: today(),
  });

  const load = async () => {
    try {
      const [
        dealerRows,
        itemRows,
        purchaseRows,
        dashboardData,
        returnRows,
        profitData,
      ] = await Promise.all([
        getDealers(),
        getItems(),
        getPurchases().catch(() => []),
        getPurchaseDashboard().catch(() => ({})),
        getPurchaseReturns().catch(() => []),
        getProfitSummary().catch(() => ({})),
      ]);

      setDealers(Array.isArray(dealerRows) ? dealerRows : []);
      setItems(Array.isArray(itemRows) ? itemRows : []);
      setPurchases(Array.isArray(purchaseRows) ? purchaseRows : []);
      setDashboard(dashboardData || {});
      setReturns(Array.isArray(returnRows) ? returnRows : []);
      setProfit(profitData || {});
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to load purchase data.",
      });
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    getAISettings()
      .then((data) =>
        setAIConfigured(
          Boolean(data?.enabled) &&
            (data?.provider === "ollama" ||
              Boolean(data?.api_key_configured))
        )
      )
      .catch(() => setAIConfigured(false));
  }, []);


  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, row) =>
          sum +
          Number(row.purchase_price || 0) *
            Number(row.quantity || 0),
        0
      ),
    [cart]
  );

  const gstAmount = useMemo(
    () =>
      cart.reduce((sum, row) => {
        const taxable =
          Number(row.purchase_price || 0) *
          Number(row.quantity || 0);
        return (
          sum +
          (taxable *
            Number(row.gst_percent || 0)) /
            100
        );
      }, 0),
    [cart]
  );

  const total = Math.max(
    subtotal +
      gstAmount -
      Number(header.discount_amount || 0) +
      Number(header.freight_amount || 0) +
      Number(header.round_off || 0),
    0
  );

  const outstanding = Math.max(
    total - Number(header.paid_amount || 0),
    0
  );

  const updateHeader = (key, value) =>
    setHeader((current) => ({
      ...current,
      [key]: value,
    }));

  const selectItem = (_, item) => {
    if (!item) {
      setLine(emptyLine());
      return;
    }

    setLine({
      item,
      quantity: 1,
      purchase_price: item.purchase_price || "",
      mrp: item.mrp || "",
      sale_price: item.sale_price || "",
      gst_percent: item.gst_percent || 0,
      batch_number: item.batch_number || "",
      manufacturing_date:
        item.manufacturing_date?.slice?.(0, 10) || "",
      expiry_date:
        item.expiry_date?.slice?.(0, 10) || "",
    });
  };

  const updateLine = (key, value) =>
    setLine((current) => ({
      ...current,
      [key]: value,
    }));

  const normalizeName = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const matchSupplierFromAI = (data) => {
    const gst = String(data?.supplier_gstin || "")
      .replace(/\s/g, "")
      .toUpperCase();

    if (gst) {
      const byGst = dealers.find(
        (row) =>
          String(row.gst_number || "")
            .replace(/\s/g, "")
            .toUpperCase() === gst
      );
      if (byGst) return byGst;
    }

    const name = normalizeName(data?.supplier_name);
    return (
      dealers.find(
        (row) =>
          normalizeName(row.dealer_name) === name
      ) || null
    );
  };

  const matchItemFromAI = (row) => {
    const barcode = String(row?.barcode || "").trim();

    if (barcode) {
      const byBarcode = items.find(
        (item) =>
          String(item.barcode || "").trim() ===
          barcode
      );
      if (byBarcode) return byBarcode;
    }

    const name = normalizeName(row?.item_name);

    return (
      items.find(
        (item) =>
          normalizeName(item.item_name) === name
      ) ||
      items.find((item) => {
        const existing = normalizeName(
          item.item_name
        );

        return (
          name.length >= 6 &&
          (existing.includes(name) ||
            name.includes(existing))
        );
      }) ||
      null
    );
  };

  const extractUploadedBill = async (file) => {
    if (!file) return;

    try {
      setAIExtracting(true);

      const response =
        await extractPurchaseBill(file);

      const extracted =
        response?.extracted || {};

      const matchedSupplier =
        matchSupplierFromAI(extracted);

      const reviewItems = (
        Array.isArray(extracted.items)
          ? extracted.items
          : []
      ).map((row, index) => ({
        ...row,
        _key: `${index}-${row.item_name || "item"}`,
        matchedItem: matchItemFromAI(row),
      }));

      setAIReview({
        ...extracted,
        matchedSupplier,
        items: reviewItems,
        provider: response?.provider,
        model: response?.model,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.message ||
          "Unable to extract purchase bill.",
      });
    } finally {
      setAIExtracting(false);
    }
  };

  const updateAIReviewItemMatch = (
    key,
    matchedItem
  ) => {
    setAIReview((current) => ({
      ...current,
      items: (current?.items || []).map(
        (row) =>
          row._key === key
            ? { ...row, matchedItem }
            : row
      ),
    }));
  };

  const preloadNewItemFromAI = (row) => {
    setNewItem({
      item_name: row.item_name || "",
      barcode: row.barcode || "",
      purchase_price:
        row.purchase_price ?? "",
      mrp: row.mrp ?? "",
      sale_price: row.sale_price ?? "",
      gst_percent:
        row.gst_percent ?? "",
      minimum_stock: 5,
      batch_number:
        row.batch_number || "",
      manufacturing_date:
        row.manufacturing_date || "",
      expiry_date:
        row.expiry_date || "",
    });
    setNewItemOpen(true);
  };

  const preloadSupplierFromAI = () => {
    setNewSupplier({
      dealer_name:
        aiReview?.supplier_name || "",
      mobile:
        aiReview?.supplier_mobile || "",
      email: "",
      gst_number:
        aiReview?.supplier_gstin || "",
      address: "",
    });
    setNewSupplierOpen(true);
  };

  const applyAIReviewToPurchase = () => {
    if (!aiReview?.matchedSupplier) {
      setMessage({
        type: "warning",
        text:
          "Match or create the supplier before applying the AI bill.",
      });
      return;
    }

    const unmatched = (
      aiReview.items || []
    ).filter((row) => !row.matchedItem);

    if (unmatched.length) {
      setMessage({
        type: "warning",
        text: `${unmatched.length} extracted item(s) still need to be matched or created.`,
      });
      return;
    }

    setHeader((current) => ({
      ...current,
      dealer_id:
        aiReview.matchedSupplier.id,
      invoice_number:
        aiReview.invoice_number || "",
      purchase_date:
        aiReview.invoice_date || today(),
      discount_amount:
        aiReview.discount_amount ?? "",
      freight_amount:
        aiReview.freight_amount ?? "",
      round_off:
        aiReview.round_off ?? "",
    }));

    setCart(
      (aiReview.items || []).map(
        (row, index) => {
          const item = row.matchedItem;

          return {
            key: `AI-${index}-${item.id}-${
              row.batch_number ||
              "NO-BATCH"
            }`,
            item_id: item.id,
            item_name: item.item_name,
            barcode:
              item.barcode ||
              row.barcode ||
              "",
            quantity: Number(
              row.quantity || 1
            ),
            purchase_price: Number(
              row.purchase_price ??
                item.purchase_price ??
                0
            ),
            mrp: Number(
              row.mrp ?? item.mrp ?? 0
            ),
            sale_price: Number(
              row.sale_price ??
                item.sale_price ??
                0
            ),
            gst_percent: Number(
              row.gst_percent ??
                item.gst_percent ??
                0
            ),
            batch_number:
              row.batch_number || "",
            manufacturing_date:
              row.manufacturing_date || "",
            expiry_date:
              row.expiry_date || "",
          };
        }
      )
    );

    setAiOpen(false);
    setMessage({
      type: "success",
      text:
        "AI bill applied to Purchase. Review every field and click Save Purchase only when correct.",
    });
  };

  const generateLocalBarcode = () => {
    const seed = `${Date.now()}`.slice(-10);
    setNewItem((current) => ({ ...current, barcode: `29${seed}` }));
  };

  const createItemInsidePurchase = async () => {
    if (!newItem.item_name.trim() || !newItem.barcode.trim()) {
      setMessage({ type: "warning", text: "Product name and barcode are required." });
      return;
    }
    try {
      setSaving(true);
      const created = await addItem({
        item_name: newItem.item_name.trim(),
        barcode: newItem.barcode.trim(),
        purchase_price: Number(newItem.purchase_price || 0),
        mrp: Number(newItem.mrp || 0),
        sale_price: Number(newItem.sale_price || 0),
        gst_percent: Number(newItem.gst_percent || 0),
        stock: 0,
        minimum_stock: Number(newItem.minimum_stock || 5),
        batch_number: newItem.batch_number || null,
        manufacturing_date: newItem.manufacturing_date || null,
        expiry_date: newItem.expiry_date || null,
        expiry_alert_days: 30,
      });
      setItems(await getItems());
      selectItem(null, created);
      setNewItemOpen(false);
      setNewItem({ item_name:"", barcode:"", purchase_price:"", mrp:"", sale_price:"",
        gst_percent:"", minimum_stock:5, batch_number:"", manufacturing_date:"", expiry_date:"" });
      setMessage({ type:"success", text:"Product created and selected. Stock stays 0 until this purchase is saved." });
    } catch (error) {
      setMessage({ type:"error", text:error.message || "Unable to create product." });
    } finally { setSaving(false); }
  };

  const createSupplierInsidePurchase = async () => {
    if (!newSupplier.dealer_name.trim()) {
      setMessage({ type:"warning", text:"Supplier name is required." });
      return;
    }
    try {
      setSaving(true);
      const created = await addDealer({
        dealer_name:newSupplier.dealer_name.trim(), mobile:newSupplier.mobile.trim(),
        email:newSupplier.email.trim() || null, gst_number:newSupplier.gst_number.trim() || null,
        address:newSupplier.address.trim() || null,
      });
      setDealers(await getDealers());
      updateHeader("dealer_id", created.id);
      setNewSupplierOpen(false);
      setNewSupplier({ dealer_name:"", mobile:"", email:"", gst_number:"", address:"" });
      setMessage({ type:"success", text:"Supplier created and selected." });
    } catch (error) {
      setMessage({ type:"error", text:error.message || "Unable to create supplier." });
    } finally { setSaving(false); }
  };

  const addLine = () => {
    if (!line.item) {
      setMessage({
        type: "warning",
        text: "Select a product first.",
      });
      return;
    }

    if (Number(line.quantity || 0) <= 0) {
      setMessage({
        type: "warning",
        text: "Purchase quantity must be greater than zero.",
      });
      return;
    }

    if (Number(line.purchase_price || 0) <= 0) {
      setMessage({
        type: "warning",
        text: "Purchase price must be greater than zero.",
      });
      return;
    }

    const key = `${line.item.id}-${line.batch_number || "NO-BATCH"}-${
      line.expiry_date || "NO-EXP"
    }`;

    setCart((current) => {
      const existing = current.find(
        (row) => row.key === key
      );

      if (existing) {
        return current.map((row) =>
          row.key === key
            ? {
                ...row,
                quantity:
                  Number(row.quantity || 0) +
                  Number(line.quantity || 0),
                purchase_price: Number(line.purchase_price || 0),
                mrp: Number(line.mrp || 0),
                sale_price: Number(line.sale_price || 0),
                gst_percent: Number(line.gst_percent || 0),
              }
            : row
        );
      }

      return [
        ...current,
        {
          key,
          item_id: line.item.id,
          item_name: line.item.item_name,
          barcode: line.item.barcode,
          quantity: Number(line.quantity || 0),
          purchase_price: Number(line.purchase_price || 0),
          mrp: Number(line.mrp || 0),
          sale_price: Number(line.sale_price || 0),
          gst_percent: Number(line.gst_percent || 0),
          batch_number: line.batch_number || "",
          manufacturing_date: line.manufacturing_date || "",
          expiry_date: line.expiry_date || "",
        },
      ];
    });

    setLine(emptyLine());
    setMessage({
      type: "success",
      text: "Product added to purchase.",
    });
  };

  const removeLine = (key) =>
    setCart((current) =>
      current.filter((row) => row.key !== key)
    );

  const savePurchase = async () => {
    if (!header.dealer_id) {
      setMessage({
        type: "warning",
        text: "Select a supplier / dealer.",
      });
      return;
    }

    if (!header.invoice_number.trim()) {
      setMessage({
        type: "warning",
        text: "Enter the supplier invoice number.",
      });
      return;
    }

    if (!cart.length) {
      setMessage({
        type: "warning",
        text: "Add at least one product.",
      });
      return;
    }

    if (Number(header.paid_amount || 0) > total) {
      setMessage({
        type: "warning",
        text: "Paid amount cannot exceed the purchase total.",
      });
      return;
    }

    try {
      setSaving(true);

      const result = await createPurchase({
        dealer_id: Number(header.dealer_id),
        invoice_number: header.invoice_number.trim(),
        purchase_date: header.purchase_date,
        discount_amount: Number(header.discount_amount || 0),
        freight_amount: Number(header.freight_amount || 0),
        round_off: Number(header.round_off || 0),
        paid_amount: Number(header.paid_amount || 0),
        payment_mode: header.payment_mode,
        note: header.note.trim() || null,
        items: cart.map((row) => ({
          item_id: row.item_id,
          quantity: Number(row.quantity),
          purchase_price: Number(row.purchase_price),
          mrp: Number(row.mrp || 0),
          sale_price: Number(row.sale_price || 0),
          gst_percent: Number(row.gst_percent || 0),
          batch_number: row.batch_number || null,
          manufacturing_date:
            row.manufacturing_date || null,
          expiry_date: row.expiry_date || null,
        })),
      });

      setHeader(emptyHeader());
      setCart([]);
      setLine(emptyLine());
      await load();

      setMessage({
        type: "success",
        text:
          result.message ||
          "Purchase saved and inventory updated.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to save purchase.",
      });
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (purchase) => {
    try {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetail(null);
      const data = await getPurchaseDetail(purchase.id);
      setDetail(data);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const openReturn = (purchaseItem) => {
    setReturnItem(purchaseItem);
    setReturnForm({
      quantity: 1,
      reason: "",
      return_date: today(),
    });
    setReturnOpen(true);
  };

  const saveReturn = async () => {
    if (!returnItem) return;

    const qty = Number(returnForm.quantity || 0);

    if (qty <= 0) {
      setMessage({
        type: "warning",
        text: "Return quantity must be greater than zero.",
      });
      return;
    }

    if (qty > Number(returnItem.available_to_return || 0)) {
      setMessage({
        type: "warning",
        text: `Only ${returnItem.available_to_return} unit(s) can be returned.`,
      });
      return;
    }

    try {
      setSaving(true);

      await createPurchaseReturn({
        purchase_item_id: returnItem.id,
        quantity: qty,
        reason: returnForm.reason.trim() || null,
        return_date: returnForm.return_date,
      });

      setReturnOpen(false);

      if (detail?.id) {
        setDetail(await getPurchaseDetail(detail.id));
      }

      await load();

      setMessage({
        type: "success",
        text: "Purchase return saved and stock reduced.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Purchase Management"
        subtitle="Record supplier purchases, update stock automatically, manage batches, returns and profit"
      />

      {message.text && (
        <Alert
          severity={message.type}
          sx={{ mb: 2.5 }}
          onClose={() =>
            setMessage({ type: "", text: "" })
          }
        >
          {message.text}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          [
            "Net Purchases",
            money(dashboard.net_purchase),
            <ReceiptLongRoundedIcon />,
          ],
          [
            "Outstanding",
            money(dashboard.outstanding_total),
            <PaymentsRoundedIcon />,
          ],
          [
            "Purchase Returns",
            money(dashboard.return_total),
            <ReplayRoundedIcon />,
          ],
          [
            "Gross Profit",
            money(profit.gross_profit),
            <TrendingUpRoundedIcon />,
          ],
        ].map(([label, value, icon]) => (
          <Grid
            key={label}
            size={{ xs: 12, sm: 6, lg: 3 }}
          >
            <Card>
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      {label}
                    </Typography>
                    <Typography
                      variant="h5"
                      fontWeight={900}
                      sx={{ mt: 0.7 }}
                    >
                      {value}
                    </Typography>
                  </Box>
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
                    {icon}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: 2.5 }}
          >
            <Box>
              <Typography variant="h6">
                New Purchase
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Saving a purchase automatically increases inventory stock and updates the supplier ledger.
              </Typography>
            </Box>
            <Chip
              icon={<LocalShippingRoundedIcon />}
              label="Supplier → Purchase → Stock"
              variant="outlined"
              color="primary"
            />
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                fullWidth
                label="Supplier / Dealer"
                value={header.dealer_id}
                onChange={(e) =>
                  updateHeader("dealer_id", e.target.value)
                }
              >
                {dealers.map((dealer) => (
                  <MenuItem
                    key={dealer.id}
                    value={dealer.id}
                  >
                    {dealer.dealer_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Supplier Invoice Number"
                value={header.invoice_number}
                onChange={(e) =>
                  updateHeader(
                    "invoice_number",
                    e.target.value
                  )
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <PurchaseDateField
                label="Purchase Date"
                value={header.purchase_date}
                onChange={(e) =>
                  updateHeader(
                    "purchase_date",
                    e.target.value
                  )
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                fullWidth
                label="Payment Mode"
                value={header.payment_mode}
                onChange={(e) =>
                  updateHeader(
                    "payment_mode",
                    e.target.value
                  )
                }
              >
                {[
                  "Credit",
                  "Cash",
                  "Online",
                  "Bank Transfer",
                  "Cheque",
                ].map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {mode}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Stack direction={{ xs:"column", sm:"row" }} justifyContent="space-between"
            alignItems={{ xs:"flex-start", sm:"center" }} spacing={1} sx={{ mb:1.5 }}>
            <Typography fontWeight={850}>Add Products</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" startIcon={<AddBusinessRoundedIcon />}
                onClick={() => setNewSupplierOpen(true)}>New Supplier</Button>
              <Button size="small" variant="outlined" startIcon={<AddRoundedIcon />}
                onClick={() => setNewItemOpen(true)}>Create New Item</Button>
              <Button size="small" variant="contained" startIcon={<AutoAwesomeRoundedIcon />}
                onClick={() => setAiOpen(true)}>AI Import Bill</Button>
            </Stack>
          </Stack>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Autocomplete
                options={items}
                value={line.item}
                onChange={selectItem}
                getOptionLabel={(option) =>
                  option?.item_name || ""
                }
                renderOption={(props, option) => (
                  <Box
                    component="li"
                    {...props}
                    key={option.id}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={800}>
                        {option.item_name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        Barcode {option.barcode || "—"} · Stock{" "}
                        {Number(option.stock || 0)} · Purchase{" "}
                        {money(option.purchase_price)}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Product"
                    placeholder="Product name or barcode"
                    slotProps={{
                      ...params.slotProps,
                      input: {
                        ...(params.slotProps?.input || {}),
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <SearchRoundedIcon />
                            </InputAdornment>
                            {params.slotProps?.input?.startAdornment || null}
                          </>
                        ),
                      },
                    }}
                  />
                )}
              />
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 1 }}>
              <TextField
                fullWidth
                type="number"
                label="Qty"
                value={line.quantity}
                onChange={(e) =>
                  updateLine("quantity", e.target.value)
                }
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 1.5 }}>
              <TextField
                fullWidth
                type="number"
                label="Purchase Price"
                value={line.purchase_price}
                onChange={(e) =>
                  updateLine(
                    "purchase_price",
                    e.target.value
                  )
                }
              />
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 1.2 }}>
              <TextField
                fullWidth
                type="number"
                label="MRP"
                value={line.mrp}
                onChange={(e) =>
                  updateLine("mrp", e.target.value)
                }
              />
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 1.4 }}>
              <TextField
                fullWidth
                type="number"
                label="Sale Price"
                value={line.sale_price}
                onChange={(e) =>
                  updateLine(
                    "sale_price",
                    e.target.value
                  )
                }
              />
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 1.2 }}>
              <TextField
                fullWidth
                type="number"
                label="GST %"
                value={line.gst_percent}
                onChange={(e) =>
                  updateLine(
                    "gst_percent",
                    e.target.value
                  )
                }
              />
            </Grid>

            <Grid size={{ xs: 6, sm: 3, lg: 1.7 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={addLine}
                sx={{ height: 42 }}
              >
                Add
              </Button>
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Batch Number"
                value={line.batch_number}
                onChange={(e) =>
                  updateLine(
                    "batch_number",
                    e.target.value
                  )
                }
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <PurchaseDateField
                label="Manufacturing Date"
                value={line.manufacturing_date}
                onChange={(e) =>
                  updateLine(
                    "manufacturing_date",
                    e.target.value
                  )
                }
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <PurchaseDateField
                label="Expiry Date"
                value={line.expiry_date}
                onChange={(e) =>
                  updateLine(
                    "expiry_date",
                    e.target.value
                  )
                }
              />
            </Grid>
          </Grid>

          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ mt: 2.5, borderRadius: 3 }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Batch / Expiry</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">
                    Purchase
                  </TableCell>
                  <TableCell align="right">MRP</TableCell>
                  <TableCell align="right">Sale</TableCell>
                  <TableCell align="right">GST</TableCell>
                  <TableCell align="right">
                    Line Total
                  </TableCell>
                  <TableCell align="center" width={70}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {cart.map((row) => {
                  const taxable =
                    Number(row.purchase_price || 0) *
                    Number(row.quantity || 0);
                  const rowGst =
                    (taxable *
                      Number(row.gst_percent || 0)) /
                    100;

                  return (
                    <TableRow key={row.key}>
                      <TableCell>
                        <Typography fontWeight={800}>
                          {row.item_name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {row.barcode || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {row.batch_number || "—"}
                        <Typography
                          variant="caption"
                          display="block"
                          color="text.secondary"
                        >
                          Exp {row.expiry_date || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {row.quantity}
                      </TableCell>
                      <TableCell align="right">
                        {money(row.purchase_price)}
                      </TableCell>
                      <TableCell align="right">
                        {money(row.mrp)}
                      </TableCell>
                      <TableCell align="right">
                        {money(row.sale_price)}
                      </TableCell>
                      <TableCell align="right">
                        {Number(row.gst_percent || 0).toFixed(
                          2
                        )}
                        %
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={800}>
                          {money(taxable + rowGst)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Remove">
                          <IconButton
                            color="error"
                            onClick={() =>
                              removeLine(row.key)
                            }
                          >
                            <DeleteOutlineRoundedIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!cart.length && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      align="center"
                      sx={{
                        py: 5,
                        color: "text.secondary",
                      }}
                    >
                      No products added to this purchase.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Grid
            container
            spacing={2}
            sx={{ mt: 2.5 }}
          >
            <Grid size={{ xs: 12, lg: 7 }}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Discount"
                    value={header.discount_amount}
                    onChange={(e) =>
                      updateHeader(
                        "discount_amount",
                        e.target.value
                      )
                    }
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Freight"
                    value={header.freight_amount}
                    onChange={(e) =>
                      updateHeader(
                        "freight_amount",
                        e.target.value
                      )
                    }
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Round Off"
                    value={header.round_off}
                    onChange={(e) =>
                      updateHeader(
                        "round_off",
                        e.target.value
                      )
                    }
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Paid Amount"
                    value={header.paid_amount}
                    onChange={(e) =>
                      updateHeader(
                        "paid_amount",
                        e.target.value
                      )
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Purchase Note"
                    value={header.note}
                    onChange={(e) =>
                      updateHeader("note", e.target.value)
                    }
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid size={{ xs: 12, lg: 5 }}>
              <Paper
                variant="outlined"
                sx={{ p: 2.5, borderRadius: 3 }}
              >
                {[
                  ["Subtotal", subtotal],
                  ["GST", gstAmount],
                  ["Discount", -Number(header.discount_amount || 0)],
                  ["Freight", Number(header.freight_amount || 0)],
                  ["Round Off", Number(header.round_off || 0)],
                ].map(([label, value]) => (
                  <Stack
                    key={label}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mb: 0.7 }}
                  >
                    <Typography color="text.secondary">
                      {label}
                    </Typography>
                    <Typography>
                      {money(value)}
                    </Typography>
                  </Stack>
                ))}

                <Divider sx={{ my: 1.5 }} />

                <Stack
                  direction="row"
                  justifyContent="space-between"
                >
                  <Typography
                    variant="h6"
                    fontWeight={900}
                  >
                    Purchase Total
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={900}
                  >
                    {money(total)}
                  </Typography>
                </Stack>

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ mt: 1 }}
                >
                  <Typography fontWeight={700}>
                    Outstanding
                  </Typography>
                  <Typography
                    fontWeight={900}
                    color={
                      outstanding > 0
                        ? "error.main"
                        : "success.main"
                    }
                  >
                    {money(outstanding)}
                  </Typography>
                </Stack>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<Inventory2RoundedIcon />}
                  onClick={savePurchase}
                  disabled={saving || !cart.length}
                  sx={{ mt: 2.5 }}
                >
                  {saving
                    ? "Saving Purchase..."
                    : "Save Purchase & Update Stock"}
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 3 }}>
                <Typography variant="h6">
                  Purchase Register
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Supplier-wise purchase history with payment and return access.
                </Typography>
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Invoice</TableCell>
                      <TableCell align="right">
                        Items
                      </TableCell>
                      <TableCell align="right">
                        Total
                      </TableCell>
                      <TableCell align="right">
                        Paid
                      </TableCell>
                      <TableCell align="right">
                        Outstanding
                      </TableCell>
                      <TableCell align="center">
                        Action
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchases.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          {row.purchase_date || "—"}
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={800}>
                            {row.dealer_name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {row.invoice_number}
                        </TableCell>
                        <TableCell align="right">
                          {row.item_count}
                        </TableCell>
                        <TableCell align="right">
                          {money(row.total_amount)}
                        </TableCell>
                        <TableCell align="right">
                          {money(row.paid_amount)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={800}
                            color={
                              Number(
                                row.outstanding_amount
                              ) > 0
                                ? "error.main"
                                : "success.main"
                            }
                          >
                            {money(
                              row.outstanding_amount
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="View / Return">
                            <IconButton
                              color="primary"
                              onClick={() =>
                                openDetail(row)
                              }
                            >
                              <VisibilityRoundedIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!purchases.length && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          align="center"
                          sx={{ py: 5 }}
                        >
                          No purchase records found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6">
                Purchase Returns
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, mb: 2 }}
              >
                Latest supplier return entries.
              </Typography>

              <Stack spacing={1.25}>
                {returns.slice(0, 8).map((row) => (
                  <Paper
                    key={row.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={800}>
                          {row.invoice_number}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {row.dealer_name} · Qty{" "}
                          {row.quantity}
                        </Typography>
                      </Box>
                      <Typography
                        fontWeight={900}
                        color="warning.main"
                      >
                        {money(row.return_amount)}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}

                {!returns.length && (
                  <Alert severity="info">
                    No purchase returns yet.
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Purchase Details
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Typography color="text.secondary">
              Loading purchase...
            </Typography>
          ) : detail ? (
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                {[
                  ["Supplier", detail.dealer_name],
                  ["Invoice", detail.invoice_number],
                  ["Date", detail.purchase_date],
                  ["Total", money(detail.total_amount)],
                ].map(([label, value]) => (
                  <Grid
                    key={label}
                    size={{ xs: 12, sm: 6, md: 3 }}
                  >
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 3 }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {label}
                      </Typography>
                      <Typography
                        fontWeight={900}
                        sx={{ mt: 0.5 }}
                      >
                        {value}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ borderRadius: 3 }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Batch</TableCell>
                      <TableCell>Expiry</TableCell>
                      <TableCell align="right">
                        Qty
                      </TableCell>
                      <TableCell align="right">
                        Returned
                      </TableCell>
                      <TableCell align="right">
                        Purchase
                      </TableCell>
                      <TableCell align="right">
                        Sale
                      </TableCell>
                      <TableCell align="right">
                        Margin
                      </TableCell>
                      <TableCell align="center">
                        Return
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detail.items || []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Typography fontWeight={800}>
                            {row.item_name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {row.batch_number || "—"}
                        </TableCell>
                        <TableCell>
                          {row.expiry_date || "—"}
                        </TableCell>
                        <TableCell align="right">
                          {row.quantity}
                        </TableCell>
                        <TableCell align="right">
                          {row.returned_quantity || 0}
                        </TableCell>
                        <TableCell align="right">
                          {money(row.purchase_price)}
                        </TableCell>
                        <TableCell align="right">
                          {money(row.sale_price)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={800}
                            color="success.main"
                          >
                            {money(row.margin_amount)}{" "}
                            ({Number(
                              row.margin_percent || 0
                            ).toFixed(1)}
                            %)
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ReplayRoundedIcon />}
                            disabled={
                              Number(
                                row.available_to_return || 0
                              ) <= 0
                            }
                            onClick={() =>
                              openReturn(row)
                            }
                          >
                            Return
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDetailOpen(false)}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Purchase Return
        </DialogTitle>
        <DialogContent dividers>
          <Typography
            fontWeight={850}
            sx={{ mb: 0.5 }}
          >
            {returnItem?.item_name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2.5 }}
          >
            Available to return:{" "}
            {returnItem?.available_to_return || 0}
          </Typography>

          <Stack spacing={2}>
            <TextField
              type="number"
              label="Return Quantity"
              value={returnForm.quantity}
              onChange={(e) =>
                setReturnForm({
                  ...returnForm,
                  quantity: e.target.value,
                })
              }
            />
            <PurchaseDateField
              label="Return Date"
              value={returnForm.return_date}
              onChange={(e) =>
                setReturnForm({
                  ...returnForm,
                  return_date: e.target.value,
                })
              }
            />
            <TextField
              multiline
              rows={3}
              label="Reason"
              value={returnForm.reason}
              onChange={(e) =>
                setReturnForm({
                  ...returnForm,
                  reason: e.target.value,
                })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setReturnOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={saveReturn}
            disabled={saving}
          >
            Save Return
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={newSupplierOpen} onClose={() => setNewSupplierOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Supplier in Purchase</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb:2 }}>Create and select a supplier without leaving this purchase.</Alert>
          <Stack spacing={2}>
            <TextField label="Supplier Name *" value={newSupplier.dealer_name}
              onChange={(e)=>setNewSupplier({...newSupplier,dealer_name:e.target.value})}/>
            <TextField label="Mobile" value={newSupplier.mobile}
              onChange={(e)=>setNewSupplier({...newSupplier,mobile:e.target.value})}/>
            <TextField label="GSTIN" value={newSupplier.gst_number}
              onChange={(e)=>setNewSupplier({...newSupplier,gst_number:e.target.value})}/>
            <TextField label="Email" value={newSupplier.email}
              onChange={(e)=>setNewSupplier({...newSupplier,email:e.target.value})}/>
            <TextField multiline rows={2} label="Address" value={newSupplier.address}
              onChange={(e)=>setNewSupplier({...newSupplier,address:e.target.value})}/>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setNewSupplierOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createSupplierInsidePurchase} disabled={saving}>Create & Select</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={newItemOpen} onClose={() => setNewItemOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create New Item & Add to Purchase</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb:2 }}>
            Opening stock is 0 here. The purchase quantity increases stock only after the purchase is reviewed and saved.
          </Alert>
          <Grid container spacing={2}>
            <Grid size={{xs:12,md:6}}><TextField fullWidth label="Product Name *" value={newItem.item_name}
              onChange={(e)=>setNewItem({...newItem,item_name:e.target.value})}/></Grid>
            <Grid size={{xs:12,md:6}}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth label="Barcode *" value={newItem.barcode}
                  onChange={(e)=>setNewItem({...newItem,barcode:e.target.value})}/>
                <Button variant="outlined" startIcon={<QrCode2RoundedIcon />} onClick={generateLocalBarcode}>Generate</Button>
              </Stack>
            </Grid>
            {[["Purchase Price","purchase_price"],["MRP","mrp"],["Sale Price","sale_price"],
              ["GST %","gst_percent"],["Minimum Stock","minimum_stock"],["Batch Number","batch_number"]].map(([label,key])=>(
              <Grid key={key} size={{xs:12,sm:6,md:4}}>
                <TextField fullWidth type={key==="batch_number"?"text":"number"} label={label} value={newItem[key]}
                  onChange={(e)=>setNewItem({...newItem,[key]:e.target.value})}/>
              </Grid>
            ))}
            <Grid size={{xs:12,sm:6}}><PurchaseDateField label="Manufacturing Date" value={newItem.manufacturing_date}
              onChange={(e)=>setNewItem({...newItem,manufacturing_date:e.target.value})}/></Grid>
            <Grid size={{xs:12,sm:6}}><PurchaseDateField label="Expiry Date" value={newItem.expiry_date}
              onChange={(e)=>setNewItem({...newItem,expiry_date:e.target.value})}/></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setNewItemOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createItemInsidePurchase} disabled={saving}>Create & Select Product</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={aiOpen}
        onClose={() =>
          !aiExtracting &&
          setAiOpen(false)
        }
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          AI Purchase Bill Import
        </DialogTitle>

        <DialogContent dividers>
          {!aiConfigured && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              AI is not configured. Open Settings → AI,
              select OpenAI, Gemini, Claude or Ollama,
              save the configuration and test the connection.
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            AI extraction is review-first. Nothing in this
            screen changes inventory or supplier balances
            until you apply the review and then save the
            Purchase.
          </Alert>

          {!aiReview ? (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                textAlign: "center",
                borderStyle: "dashed",
                borderRadius: 3,
              }}
            >
              <UploadFileRoundedIcon
                color="primary"
                sx={{ fontSize: 44, mb: 1 }}
              />

              <Typography variant="h6">
                Upload Purchase Bill
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ my: 1.5 }}
              >
                JPG, PNG or PDF · Maximum 20 MB
              </Typography>

              <Button
                component="label"
                variant="contained"
                disabled={
                  !aiConfigured ||
                  aiExtracting
                }
                startIcon={
                  <AutoAwesomeRoundedIcon />
                }
              >
                {aiExtracting
                  ? "Extracting Bill..."
                  : "Choose Bill & Extract"}

                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(event) => {
                    const file =
                      event.target.files?.[0];

                    extractUploadedBill(file);
                    event.target.value = "";
                  }}
                />
              </Button>
            </Paper>
          ) : (
            <Stack spacing={2.5}>
              <Stack
                direction={{
                  xs: "column",
                  md: "row",
                }}
                justifyContent="space-between"
                spacing={1}
              >
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={900}
                  >
                    AI Extraction Review
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    {aiReview.provider} ·{" "}
                    {aiReview.model || "Configured model"}
                  </Typography>
                </Box>

                <Button
                  variant="outlined"
                  onClick={() =>
                    setAIReview(null)
                  }
                >
                  Upload Different Bill
                </Button>
              </Stack>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 3 }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      Supplier
                    </Typography>

                    <Typography
                      fontWeight={900}
                      sx={{ mt: 0.5 }}
                    >
                      {aiReview.supplier_name ||
                        "Not detected"}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      GSTIN{" "}
                      {aiReview.supplier_gstin ||
                        "—"}
                    </Typography>

                    {aiReview.matchedSupplier ? (
                      <Chip
                        sx={{ mt: 1 }}
                        color="success"
                        label={`Matched: ${aiReview.matchedSupplier.dealer_name}`}
                      />
                    ) : (
                      <Button
                        sx={{ mt: 1 }}
                        size="small"
                        variant="outlined"
                        onClick={
                          preloadSupplierFromAI
                        }
                      >
                        Create Supplier
                      </Button>
                    )}
                  </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 3 }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      Invoice
                    </Typography>

                    <Typography fontWeight={900}>
                      {aiReview.invoice_number ||
                        "Not detected"}
                    </Typography>

                    <Typography variant="body2">
                      Date:{" "}
                      {aiReview.invoice_date || "—"}
                    </Typography>

                    <Typography variant="body2">
                      Extracted Total:{" "}
                      {money(
                        aiReview.total_amount || 0
                      )}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ borderRadius: 3 }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        Extracted Product
                      </TableCell>
                      <TableCell>
                        Inventory Match
                      </TableCell>
                      <TableCell align="right">
                        Qty
                      </TableCell>
                      <TableCell align="right">
                        Purchase
                      </TableCell>
                      <TableCell align="right">
                        MRP
                      </TableCell>
                      <TableCell align="right">
                        GST
                      </TableCell>
                      <TableCell>
                        Confidence
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {(aiReview.items || []).map(
                      (row) => (
                        <TableRow key={row._key}>
                          <TableCell>
                            <Typography
                              fontWeight={850}
                            >
                              {row.item_name ||
                                "Unnamed item"}
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {[
                                row.barcode
                                  ? `Barcode ${row.barcode}`
                                  : "",
                                row.batch_number
                                  ? `Batch ${row.batch_number}`
                                  : "",
                                row.expiry_date
                                  ? `Exp ${row.expiry_date}`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </Typography>
                          </TableCell>

                          <TableCell
                            sx={{ minWidth: 270 }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Autocomplete
                                size="small"
                                fullWidth
                                options={items}
                                value={
                                  row.matchedItem ||
                                  null
                                }
                                onChange={(
                                  _,
                                  value
                                ) =>
                                  updateAIReviewItemMatch(
                                    row._key,
                                    value
                                  )
                                }
                                getOptionLabel={(
                                  option
                                ) =>
                                  option?.item_name ||
                                  ""
                                }
                                renderInput={(
                                  params
                                ) => (
                                  <TextField
                                    {...params}
                                    label="Match Item"
                                  />
                                )}
                              />

                              {!row.matchedItem && (
                                <Button
                                  size="small"
                                  onClick={() =>
                                    preloadNewItemFromAI(
                                      row
                                    )
                                  }
                                >
                                  New
                                </Button>
                              )}
                            </Stack>
                          </TableCell>

                          <TableCell align="right">
                            {Number(
                              row.quantity || 0
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {money(
                              row.purchase_price
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {money(row.mrp)}
                          </TableCell>
                          <TableCell align="right">
                            {Number(
                              row.gst_percent || 0
                            ).toFixed(2)}
                            %
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={
                                Number(
                                  row.confidence || 0
                                ) >= 0.9
                                  ? "success"
                                  : Number(
                                      row.confidence ||
                                        0
                                    ) >= 0.7
                                  ? "warning"
                                  : "error"
                              }
                              label={`${Math.round(
                                Number(
                                  row.confidence || 0
                                ) * 100
                              )}%`}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Alert severity="warning">
                Check supplier, product matches,
                quantities, prices, GST, batch and
                expiry before applying this extraction.
              </Alert>
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setAiOpen(false)}
            disabled={aiExtracting}
          >
            Close
          </Button>

          {aiReview && (
            <Button
              variant="contained"
              startIcon={
                <AutoAwesomeRoundedIcon />
              }
              onClick={
                applyAIReviewToPurchase
              }
            >
              Apply to Purchase for Final Review
            </Button>
          )}
        </DialogActions>
      </Dialog>

    </AppLayout>
  );
}
