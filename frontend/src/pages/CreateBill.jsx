import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import InvoicePrint from "../components/InvoicePrint";
import {
  createSale,
  getCustomers,
  getItemByBarcode,
  getItems,
  getSettings,
} from "../services/api";

const HOLD_BILLS_KEY = "billing_held_bills";
const PRODUCT_USAGE_KEY = "billing_product_usage";
const RECENT_PRODUCTS_KEY = "billing_recent_products";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const todayValue = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 10);
};

const isExpired = (item) => {
  if (!item?.expiry_date) return false;

  const expiry = new Date(
    `${String(item.expiry_date).slice(0, 10)}T00:00:00`
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    !Number.isNaN(expiry.getTime()) &&
    expiry < today
  );
};

const stockLabel = (item) => {
  const stock = Number(item?.stock || 0);
  const minimum = Number(item?.minimum_stock || 0);

  if (stock <= 0) return "Out of Stock";
  if (stock <= minimum) return "Low Stock";
  return "In Stock";
};

const stockColor = (item) => {
  const label = stockLabel(item);
  if (label === "Out of Stock") return "error";
  if (label === "Low Stock") return "warning";
  return "success";
};

const safeParse = (key, fallback) => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(key) || ""
    );
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const makeHeldBillId = () =>
  `HOLD-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;

export default function CreateBill() {
  const scannerRef = useRef(null);
  const productSearchRef = useRef(null);

  const savedUser =
    JSON.parse(localStorage.getItem("user")) || {};
  const userId = savedUser.user_id || "admin";

  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const [selectedCustomer, setSelectedCustomer] =
    useState(null);

  const [customer, setCustomer] = useState({
    customer_name: "",
    customer_mobile: "",
  });

  const [paymentMode, setPaymentMode] =
    useState("Cash");

  const [billDate, setBillDate] = useState(
    todayValue()
  );

  const [discountType, setDiscountType] =
    useState("amount");
  const [discountValue, setDiscountValue] =
    useState("");

  const [amountReceived, setAmountReceived] =
    useState("");

  const [splitPayment, setSplitPayment] = useState({
    cash: "",
    online: "",
    credit: "",
  });

  const [generatedInvoice, setGeneratedInvoice] =
    useState(null);

  const [businessDetails, setBusinessDetails] =
    useState({
      business_name: "",
      address: "",
      gst_number: "",
      mobile: "",
      email: "",
    });

  const [printSettings, setPrintSettings] =
    useState(() => {
      try {
        return (
          JSON.parse(
            localStorage.getItem(
              "billing_print_settings"
            )
          ) || {
            layout: "a4",
            thermal_size: "80mm",
            show_logo: true,
            show_barcode: true,
            show_batch_expiry: true,
            show_savings: true,
            show_payment_qr: true,
            show_footer: true,
            header_alignment: "left",
            logo_position: "left",
            logo_width: 90,
            logo_height: 60,
            footer_message:
              "Thank you for your business. Visit again.",
          }
        );
      } catch {
        return {
          layout: "a4",
          thermal_size: "80mm",
          show_logo: true,
          show_barcode: true,
          show_batch_expiry: true,
          show_savings: true,
          show_payment_qr: true,
          show_footer: true,
          header_alignment: "left",
          logo_position: "left",
          logo_width: 90,
          logo_height: 60,
          footer_message:
            "Thank you for your business. Visit again.",
        };
      }
    });

  const [heldBills, setHeldBills] = useState(() =>
    safeParse(HOLD_BILLS_KEY, [])
  );
  const [holdDialogOpen, setHoldDialogOpen] =
    useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] =
    useState(false);
  const [holdNote, setHoldNote] = useState("");

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });
  const [saving, setSaving] = useState(false);
  const [loadingProducts, setLoadingProducts] =
    useState(false);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        setLoadingProducts(true);

        const [settingsResult, itemsResult, customerResult] =
          await Promise.all([
            getSettings(userId).catch(() => null),
            getItems(),
            getCustomers().catch(() => []),
          ]);

        if (settingsResult && !settingsResult.detail) {
          setBusinessDetails({
            business_name:
              settingsResult.business_name || "",
            address: settingsResult.address || "",
            gst_number:
              settingsResult.gst_number || "",
            mobile: settingsResult.mobile || "",
            email: settingsResult.email || "",
          });
        }

        setItems(
          Array.isArray(itemsResult) ? itemsResult : []
        );
        setCustomers(
          Array.isArray(customerResult)
            ? customerResult
            : []
        );
      } catch (error) {
        setMessage({
          type: "error",
          text:
            error.message ||
            "Unable to load billing reference data.",
        });
      } finally {
        setLoadingProducts(false);
      }
    };

    loadReferenceData();
  }, [userId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "F2") {
        event.preventDefault();
        productSearchRef.current?.focus?.();
      }

      if (event.key === "F4") {
        event.preventDefault();
        setPaymentMode("Cash");
      }

      if (event.key === "F5") {
        event.preventDefault();
        generateBill();
      }

      if (event.key === "Escape") {
        setSelectedProduct(null);
        setBarcode("");
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
    // generateBill intentionally uses current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cart,
    customer,
    paymentMode,
    billDate,
    discountValue,
    discountType,
    amountReceived,
    splitPayment,
  ]);

  const saveHeldBills = (next) => {
    setHeldBills(next);
    localStorage.setItem(
      HOLD_BILLS_KEY,
      JSON.stringify(next)
    );
  };

  const updateProductUsage = (item) => {
    const usage = safeParse(PRODUCT_USAGE_KEY, {});
    const itemId = String(item.id);

    usage[itemId] = {
      count:
        Number(usage[itemId]?.count || 0) + 1,
      last_used: Date.now(),
    };

    localStorage.setItem(
      PRODUCT_USAGE_KEY,
      JSON.stringify(usage)
    );

    const recent = safeParse(
      RECENT_PRODUCTS_KEY,
      []
    ).filter((id) => id !== item.id);

    recent.unshift(item.id);

    localStorage.setItem(
      RECENT_PRODUCTS_KEY,
      JSON.stringify(recent.slice(0, 8))
    );
  };

  const recentProducts = useMemo(() => {
    const ids = safeParse(RECENT_PRODUCTS_KEY, []);

    return ids
      .map((id) =>
        items.find((item) => item.id === id)
      )
      .filter(Boolean)
      .slice(0, 5);
  }, [items, cart]);

  const frequentProducts = useMemo(() => {
    const usage = safeParse(PRODUCT_USAGE_KEY, {});

    return [...items]
      .sort(
        (a, b) =>
          Number(usage[String(b.id)]?.count || 0) -
          Number(usage[String(a.id)]?.count || 0)
      )
      .filter(
        (item) =>
          Number(
            usage[String(item.id)]?.count || 0
          ) > 0
      )
      .slice(0, 5);
  }, [items, cart]);

  const addProductToCart = (
    item,
    quantityToAdd = 1
  ) => {
    if (!item) return;

    if (Number(item.stock || 0) <= 0) {
      setMessage({
        type: "warning",
        text: `${item.item_name} is out of stock.`,
      });
      return;
    }

    if (isExpired(item)) {
      setMessage({
        type: "error",
        text: `${item.item_name} is expired and cannot be billed.`,
      });
      return;
    }

    let added = false;

    setCart((current) => {
      const existing = current.find(
        (row) => row.id === item.id
      );

      const requestedQuantity =
        Number(existing?.quantity || 0) +
        Number(quantityToAdd || 1);

      if (
        requestedQuantity >
        Number(item.stock || 0)
      ) {
        setMessage({
          type: "warning",
          text: `Only ${item.stock} unit(s) of ${item.item_name} are available.`,
        });
        return current;
      }

      added = true;

      if (existing) {
        return current.map((row) =>
          row.id === item.id
            ? {
                ...row,
                quantity: requestedQuantity,
              }
            : row
        );
      }

      return [
        ...current,
        {
          ...item,
          quantity: Number(quantityToAdd || 1),
        },
      ];
    });

    if (added) {
      updateProductUsage(item);
      setMessage({
        type: "success",
        text: `${item.item_name} added to bill.`,
      });
    }

    setSelectedProduct(null);
    setBarcode("");
  };

  const addByBarcode = async () => {
    const value = barcode.trim();

    if (!value) {
      setMessage({
        type: "warning",
        text: "Scan or enter a barcode first.",
      });
      return;
    }

    try {
      const localMatch = items.find(
        (item) =>
          String(item.barcode || "") === value
      );

      const item =
        localMatch ||
        (await getItemByBarcode(value));

      addProductToCart(item);
      scannerRef.current?.focus();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.message ||
          "Unable to find the product.",
      });
    }
  };

  const updateQty = (id, quantity) => {
    setCart((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        const requested = Math.max(
          1,
          Math.floor(Number(quantity) || 1)
        );

        const available = Math.max(
          1,
          Number(item.stock || 1)
        );

        if (requested > available) {
          setMessage({
            type: "warning",
            text: `Only ${available} unit(s) of ${item.item_name} are available.`,
          });
        }

        return {
          ...item,
          quantity: Math.min(
            requested,
            available
          ),
        };
      })
    );
  };

  const removeItem = (id) => {
    setCart((current) =>
      current.filter((item) => item.id !== id)
    );
  };

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          toNumber(item.sale_price) *
            toNumber(item.quantity),
        0
      ),
    [cart]
  );

  const totalMrp = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          toNumber(
            item.mrp || item.sale_price
          ) *
            toNumber(item.quantity),
        0
      ),
    [cart]
  );

  const productSaving = Math.max(
    totalMrp - subtotal,
    0
  );

  const gst = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const base =
          toNumber(item.sale_price) *
          toNumber(item.quantity);

        return (
          sum +
          (base *
            toNumber(item.gst_percent)) /
            100
        );
      }, 0),
    [cart]
  );

  const grossTotal = subtotal + gst;

  const discountAmount = useMemo(() => {
    const value = Math.max(
      0,
      toNumber(discountValue)
    );

    if (discountType === "percent") {
      return Math.min(
        grossTotal,
        (grossTotal * Math.min(value, 100)) /
          100
      );
    }

    return Math.min(grossTotal, value);
  }, [
    discountType,
    discountValue,
    grossTotal,
  ]);

  const finalTotal = Math.max(
    grossTotal - discountAmount,
    0
  );

  const splitTotal =
    toNumber(splitPayment.cash) +
    toNumber(splitPayment.online) +
    toNumber(splitPayment.credit);

  const splitDifference =
    finalTotal - splitTotal;

  const changeReturn =
    paymentMode === "Cash"
      ? Math.max(
          toNumber(amountReceived) -
            finalTotal,
          0
        )
      : 0;

  const paymentValidation = () => {
    if (
      paymentMode === "Credit" &&
      !customer.customer_name.trim()
    ) {
      return "Customer name is required for a credit bill.";
    }

    if (
      paymentMode === "Split" &&
      Math.abs(splitDifference) > 0.01
    ) {
      return `Split payment must total ${money(
        finalTotal
      )}. Difference: ${money(
        splitDifference
      )}.`;
    }

    if (
      paymentMode === "Split" &&
      toNumber(splitPayment.credit) > 0 &&
      !customer.customer_name.trim()
    ) {
      return "Customer name is required when split payment contains credit.";
    }

    return "";
  };

  const generateBill = async () => {
    if (!cart.length) {
      setMessage({
        type: "warning",
        text: "Add at least one item to generate an invoice.",
      });
      return;
    }

    const paymentError =
      paymentValidation();

    if (paymentError) {
      setMessage({
        type: "warning",
        text: paymentError,
      });
      return;
    }

    try {
      setSaving(true);
      setMessage({
        type: "",
        text: "",
      });

      const cartSnapshot = cart.map(
        (item) => {
          const base =
            toNumber(item.sale_price) *
            toNumber(item.quantity);

          const itemGst =
            (base *
              toNumber(item.gst_percent)) /
            100;

          return {
            ...item,
            rate: toNumber(
              item.sale_price
            ),
            amount: base + itemGst,
          };
        }
      );

      const result = await createSale({
        customer_name:
          customer.customer_name.trim() ||
          null,
        customer_mobile:
          customer.customer_mobile.trim() ||
          null,
        payment_mode: paymentMode,
        bill_date: billDate,
        discount_amount: discountAmount,
        cash_amount:
          paymentMode === "Split"
            ? toNumber(splitPayment.cash)
            : paymentMode === "Cash"
            ? finalTotal
            : 0,
        online_amount:
          paymentMode === "Split"
            ? toNumber(
                splitPayment.online
              )
            : paymentMode === "Online"
            ? finalTotal
            : 0,
        credit_amount:
          paymentMode === "Split"
            ? toNumber(
                splitPayment.credit
              )
            : paymentMode === "Credit"
            ? finalTotal
            : 0,
        amount_received:
          paymentMode === "Cash"
            ? toNumber(amountReceived)
            : 0,
        products: cart.map((item) => ({
          item_id: item.id,
          quantity: item.quantity,
        })),
      });

      const finalAmount =
        toNumber(result.final_amount) ||
        finalTotal;

      const invoiceSnapshot = {
        response: result,
        invoice_number:
          result.invoice_no ||
          result.invoice_number ||
          `INV-${Date.now()}`,
        bill_date:
          result.bill_date || billDate,
        payment_mode: paymentMode,
        subtotal:
          toNumber(result.subtotal) ||
          subtotal,
        gst_amount:
          toNumber(result.gst_amount) ||
          gst,
        discount:
          toNumber(
            result.discount_amount
          ) || discountAmount,
        total_mrp:
          toNumber(result.total_mrp) ||
          totalMrp,
        total_saving:
          toNumber(result.total_saving) +
          discountAmount ||
          productSaving + discountAmount,
        total_amount: finalAmount,
        paid_amount:
          paymentMode === "Credit"
            ? 0
            : paymentMode === "Split"
            ? toNumber(
                result.cash_amount
              ) +
              toNumber(
                result.online_amount
              )
            : finalAmount,
        balance:
          paymentMode === "Credit"
            ? finalAmount
            : paymentMode === "Split"
            ? toNumber(
                result.credit_amount
              )
            : 0,
        cash_amount:
          toNumber(result.cash_amount),
        online_amount:
          toNumber(
            result.online_amount
          ),
        credit_amount:
          toNumber(
            result.credit_amount
          ),
        amount_received:
          toNumber(
            result.amount_received
          ),
        change_return:
          toNumber(
            result.change_return
          ),
        customer: {
          customer_name:
            customer.customer_name ||
            "Walk-in Customer",
          mobile:
            customer.customer_mobile,
        },
        items: cartSnapshot,
      };

      setGeneratedInvoice(
        invoiceSnapshot
      );

      setItems((current) =>
        current.map((item) => {
          const sold = cart.find(
            (row) => row.id === item.id
          );

          if (!sold) return item;

          return {
            ...item,
            stock: Math.max(
              0,
              Number(item.stock || 0) -
                Number(
                  sold.quantity || 0
                )
            ),
          };
        })
      );

      setCart([]);
      setBarcode("");
      setSelectedProduct(null);
      setDiscountValue("");
      setAmountReceived("");
      setSplitPayment({
        cash: "",
        online: "",
        credit: "",
      });

      setMessage({
        type: "success",
        text: `Invoice ${invoiceSnapshot.invoice_number} generated successfully.`,
      });

      scannerRef.current?.focus();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.message ||
          "Unable to generate the invoice.",
      });
    } finally {
      setSaving(false);
    }
  };

  const holdCurrentBill = () => {
    if (!cart.length) {
      setMessage({
        type: "warning",
        text: "There is no active bill to hold.",
      });
      return;
    }

    const held = {
      id: makeHeldBillId(),
      note:
        holdNote.trim() ||
        customer.customer_name ||
        "Held Bill",
      held_at: new Date().toISOString(),
      customer,
      paymentMode,
      billDate,
      cart,
      discountType,
      discountValue,
      amountReceived,
      splitPayment,
    };

    saveHeldBills([
      held,
      ...heldBills,
    ]);

    setCart([]);
    setCustomer({
      customer_name: "",
      customer_mobile: "",
    });
    setSelectedCustomer(null);
    setDiscountValue("");
    setAmountReceived("");
    setSplitPayment({
      cash: "",
      online: "",
      credit: "",
    });
    setHoldNote("");
    setHoldDialogOpen(false);

    setMessage({
      type: "success",
      text: `${held.note} placed on hold.`,
    });
  };

  const resumeHeldBill = (held) => {
    setCart(
      Array.isArray(held.cart)
        ? held.cart
        : []
    );
    setCustomer(
      held.customer || {
        customer_name: "",
        customer_mobile: "",
      }
    );
    setPaymentMode(
      held.paymentMode || "Cash"
    );
    setBillDate(
      held.billDate || todayValue()
    );
    setDiscountType(
      held.discountType || "amount"
    );
    setDiscountValue(
      held.discountValue || ""
    );
    setAmountReceived(
      held.amountReceived || ""
    );
    setSplitPayment(
      held.splitPayment || {
        cash: "",
        online: "",
        credit: "",
      }
    );

    saveHeldBills(
      heldBills.filter(
        (bill) => bill.id !== held.id
      )
    );

    setResumeDialogOpen(false);

    setMessage({
      type: "success",
      text: `${held.note || "Held bill"} resumed.`,
    });
  };

  const deleteHeldBill = (heldId) => {
    if (
      !window.confirm(
        "Delete this held bill?"
      )
    ) {
      return;
    }

    saveHeldBills(
      heldBills.filter(
        (bill) => bill.id !== heldId
      )
    );
  };

  const clearCurrentBill = () => {
    if (
      cart.length &&
      !window.confirm(
        "Clear the current bill?"
      )
    ) {
      return;
    }

    setCart([]);
    setCustomer({
      customer_name: "",
      customer_mobile: "",
    });
    setSelectedCustomer(null);
    setSelectedProduct(null);
    setBarcode("");
    setDiscountValue("");
    setAmountReceived("");
    setSplitPayment({
      cash: "",
      online: "",
      credit: "",
    });
    setMessage({
      type: "",
      text: "",
    });
  };

  const handlePrintInvoice = () => {
    if (!generatedInvoice) {
      setMessage({
        type: "warning",
        text: "Generate an invoice before printing.",
      });
      return;
    }

    setTimeout(
      () => window.print(),
      250
    );
  };

  const availableProducts = useMemo(
    () =>
      items.filter(
        (item) =>
          Number(item.stock || 0) > 0 &&
          !isExpired(item)
      ),
    [items]
  );

  return (
    <AppLayout>
      <Box className="no-print">
        <PageHeader
          title="Create Invoice"
          subtitle="Barcode scanning, smart product search, hold/resume billing and flexible payments"
        />

        {message.text && (
          <Alert
            severity={message.type}
            sx={{ mb: 2.5 }}
            onClose={() =>
              setMessage({
                type: "",
                text: "",
              })
            }
          >
            {message.text}
          </Alert>
        )}

        <Stack
          direction={{
            xs: "column",
            md: "row",
          }}
          spacing={1}
          justifyContent="flex-end"
          sx={{ mb: 2 }}
        >
          <Tooltip title="F2 Product Search · F4 Cash · F5 Generate Bill">
            <Chip
              icon={<KeyboardRoundedIcon />}
              label="Keyboard Shortcuts"
              variant="outlined"
            />
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={
              <PauseCircleOutlineRoundedIcon />
            }
            onClick={() =>
              setHoldDialogOpen(true)
            }
            disabled={!cart.length}
          >
            Hold Bill
          </Button>

          <Button
            variant="outlined"
            startIcon={
              <PlayCircleOutlineRoundedIcon />
            }
            onClick={() =>
              setResumeDialogOpen(true)
            }
          >
            Resume ({heldBills.length})
          </Button>

          <Button
            color="error"
            variant="text"
            onClick={clearCurrentBill}
          >
            Clear
          </Button>
        </Stack>

        <Grid container spacing={3}>
          <Grid
            size={{
              xs: 12,
              xl: 8.4,
            }}
          >
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack
                  direction={{
                    xs: "column",
                    md: "row",
                  }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Box>
                    <Typography variant="h6">
                      Customer & Product Entry
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      Scan a barcode or search the
                      catalogue by product name.
                    </Typography>
                  </Box>

                  <Chip
                    icon={
                      <QrCodeScannerRoundedIcon />
                    }
                    label="Scanner Ready"
                    color="success"
                    variant="outlined"
                  />
                </Stack>

                <Divider sx={{ my: 2.5 }} />

                <Grid
                  container
                  spacing={2}
                  alignItems="center"
                >
                  <Grid
                    size={{
                      xs: 12,
                      md: 4,
                    }}
                  >
                    <Autocomplete
                      options={customers}
                      value={selectedCustomer}
                      getOptionLabel={(option) =>
                        option?.customer_name ||
                        ""
                      }
                      isOptionEqualToValue={(
                        option,
                        value
                      ) =>
                        option?.id === value?.id
                      }
                      onChange={(_, value) => {
                        setSelectedCustomer(
                          value
                        );

                        if (value) {
                          setCustomer({
                            customer_name:
                              value.customer_name ||
                              "",
                            customer_mobile:
                              value.mobile ||
                              value.customer_mobile ||
                              "",
                          });
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Search Customer"
                          placeholder="Name or mobile"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                <InputAdornment position="start">
                                  <PersonSearchRoundedIcon fontSize="small" />
                                </InputAdornment>
                                {
                                  params.InputProps
                                    .startAdornment
                                }
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>

                  <Grid
                    size={{
                      xs: 12,
                      md: 4,
                    }}
                  >
                    <TextField
                      fullWidth
                      label="Customer Name"
                      value={
                        customer.customer_name
                      }
                      onChange={(event) =>
                        setCustomer({
                          ...customer,
                          customer_name:
                            event.target.value,
                        })
                      }
                    />
                  </Grid>

                  <Grid
                    size={{
                      xs: 12,
                      md: 4,
                    }}
                  >
                    <TextField
                      fullWidth
                      label="Mobile Number"
                      value={
                        customer.customer_mobile
                      }
                      onChange={(event) =>
                        setCustomer({
                          ...customer,
                          customer_mobile:
                            event.target.value,
                        })
                      }
                    />
                  </Grid>

                  <Grid
                    size={{
                      xs: 12,
                      md: 5,
                    }}
                  >
                    <TextField
                      fullWidth
                      inputRef={scannerRef}
                      label="Scan / Enter Barcode"
                      value={barcode}
                      onChange={(event) =>
                        setBarcode(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter"
                        ) {
                          event.preventDefault();
                          addByBarcode();
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <QrCodeScannerRoundedIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid
                    size={{
                      xs: 12,
                      md: 2,
                    }}
                  >
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={
                        <AddRoundedIcon />
                      }
                      onClick={addByBarcode}
                      sx={{ minHeight: 56 }}
                    >
                      Add
                    </Button>
                  </Grid>

                  <Grid
                    size={{
                      xs: 12,
                      md: 5,
                    }}
                  >
                    <Autocomplete
                      options={availableProducts}
                      value={selectedProduct}
                      loading={loadingProducts}
                      getOptionLabel={(option) =>
                        option?.item_name || ""
                      }
                      filterOptions={(
                        options,
                        state
                      ) => {
                        const term =
                          state.inputValue
                            .trim()
                            .toLowerCase();

                        if (!term) {
                          return options.slice(
                            0,
                            20
                          );
                        }

                        return options
                          .filter((item) =>
                            `${
                              item.item_name || ""
                            } ${
                              item.barcode || ""
                            } ${
                              item.batch_number ||
                              ""
                            }`
                              .toLowerCase()
                              .includes(term)
                          )
                          .slice(0, 20);
                      }}
                      onChange={(_, value) => {
                        if (value) {
                          addProductToCart(
                            value
                          );
                        }
                      }}
                      renderOption={(
                        props,
                        option
                      ) => (
                        <Box
                          component="li"
                          {...props}
                          key={option.id}
                          sx={{
                            display: "block !important",
                          }}
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            spacing={2}
                            width="100%"
                          >
                            <Box>
                              <Typography fontWeight={800}>
                                {
                                  option.item_name
                                }
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {
                                  option.barcode
                                }{" "}
                                · Stock{" "}
                                {
                                  option.stock
                                }
                              </Typography>
                            </Box>

                            <Box
                              textAlign="right"
                              flexShrink={0}
                            >
                              <Typography fontWeight={800}>
                                {money(
                                  option.sale_price
                                )}
                              </Typography>
                              <Chip
                                size="small"
                                label={stockLabel(
                                  option
                                )}
                                color={stockColor(
                                  option
                                )}
                                variant="outlined"
                              />
                            </Box>
                          </Stack>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          inputRef={
                            productSearchRef
                          }
                          label="Search Product by Name"
                          placeholder="Type product name, barcode or batch"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                <InputAdornment position="start">
                                  <SearchRoundedIcon />
                                </InputAdornment>
                                {
                                  params.InputProps
                                    .startAdornment
                                }
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>

                {(recentProducts.length >
                  0 ||
                  frequentProducts.length >
                    0) && (
                  <Grid
                    container
                    spacing={2}
                    sx={{ mt: 1 }}
                  >
                    {recentProducts.length >
                      0 && (
                      <Grid
                        size={{
                          xs: 12,
                          md: 6,
                        }}
                      >
                        <Paper
                          variant="outlined"
                          sx={{ p: 1.5 }}
                        >
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            mb={1}
                          >
                            <HistoryRoundedIcon
                              fontSize="small"
                              color="primary"
                            />
                            <Typography fontWeight={800}>
                              Recent Products
                            </Typography>
                          </Stack>

                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            {recentProducts.map(
                              (item) => (
                                <Chip
                                  key={item.id}
                                  clickable
                                  label={
                                    item.item_name
                                  }
                                  onClick={() =>
                                    addProductToCart(
                                      item
                                    )
                                  }
                                  variant="outlined"
                                />
                              )
                            )}
                          </Stack>
                        </Paper>
                      </Grid>
                    )}

                    {frequentProducts.length >
                      0 && (
                      <Grid
                        size={{
                          xs: 12,
                          md: 6,
                        }}
                      >
                        <Paper
                          variant="outlined"
                          sx={{ p: 1.5 }}
                        >
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            mb={1}
                          >
                            <LocalFireDepartmentRoundedIcon
                              fontSize="small"
                              color="warning"
                            />
                            <Typography fontWeight={800}>
                              Frequently Sold
                            </Typography>
                          </Stack>

                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            {frequentProducts.map(
                              (item) => (
                                <Chip
                                  key={item.id}
                                  clickable
                                  label={
                                    item.item_name
                                  }
                                  onClick={() =>
                                    addProductToCart(
                                      item
                                    )
                                  }
                                  variant="outlined"
                                />
                              )
                            )}
                          </Stack>
                        </Paper>
                      </Grid>
                    )}
                  </Grid>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mt: 3 }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ p: 2.5 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Box>
                      <Typography variant="h6">
                        Current Bill
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        {cart.length} product
                        {cart.length === 1
                          ? ""
                          : "s"}{" "}
                        in the bill
                      </Typography>
                    </Box>

                    <Chip
                      label={`${cart.reduce(
                        (sum, item) =>
                          sum +
                          Number(
                            item.quantity ||
                              0
                          ),
                        0
                      )} unit(s)`}
                      color="primary"
                      variant="outlined"
                    />
                  </Stack>
                </Box>

                <TableContainer>
                  <Table
                    size="small"
                    sx={{
                      minWidth: 900,
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          Product
                        </TableCell>
                        <TableCell align="right">
                          MRP
                        </TableCell>
                        <TableCell align="right">
                          Rate
                        </TableCell>
                        <TableCell align="center">
                          Qty
                        </TableCell>
                        <TableCell align="right">
                          GST
                        </TableCell>
                        <TableCell align="right">
                          Amount
                        </TableCell>
                        <TableCell align="center">
                          Action
                        </TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {cart.map((item) => {
                        const base =
                          toNumber(
                            item.sale_price
                          ) *
                          toNumber(
                            item.quantity
                          );

                        const itemGst =
                          (base *
                            toNumber(
                              item.gst_percent
                            )) /
                          100;

                        return (
                          <TableRow
                            key={item.id}
                            hover
                          >
                            <TableCell>
                              <Typography fontWeight={800}>
                                {
                                  item.item_name
                                }
                              </Typography>

                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {
                                  item.barcode
                                }{" "}
                                · Available{" "}
                                {item.stock}
                              </Typography>
                            </TableCell>

                            <TableCell align="right">
                              {money(
                                item.mrp ||
                                  item.sale_price
                              )}
                            </TableCell>

                            <TableCell align="right">
                              {money(
                                item.sale_price
                              )}
                            </TableCell>

                            <TableCell align="center">
                              <Stack
                                direction="row"
                                justifyContent="center"
                                alignItems="center"
                                spacing={0.5}
                              >
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    updateQty(
                                      item.id,
                                      item.quantity -
                                        1
                                    )
                                  }
                                >
                                  −
                                </IconButton>

                                <TextField
                                  size="small"
                                  type="number"
                                  value={
                                    item.quantity
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateQty(
                                      item.id,
                                      event.target
                                        .value
                                    )
                                  }
                                  inputProps={{
                                    min: 1,
                                    max: item.stock,
                                    style: {
                                      textAlign:
                                        "center",
                                    },
                                  }}
                                  sx={{
                                    width: 72,
                                  }}
                                />

                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    updateQty(
                                      item.id,
                                      item.quantity +
                                        1
                                    )
                                  }
                                >
                                  +
                                </IconButton>
                              </Stack>
                            </TableCell>

                            <TableCell align="right">
                              {money(
                                itemGst
                              )}
                            </TableCell>

                            <TableCell align="right">
                              <Typography fontWeight={800}>
                                {money(
                                  base +
                                    itemGst
                                )}
                              </Typography>
                            </TableCell>

                            <TableCell align="center">
                              <IconButton
                                color="error"
                                onClick={() =>
                                  removeItem(
                                    item.id
                                  )
                                }
                              >
                                <DeleteOutlineRoundedIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {!cart.length && (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                          >
                            <Box
                              sx={{
                                py: 7,
                                textAlign:
                                  "center",
                              }}
                            >
                              <ReceiptLongRoundedIcon
                                sx={{
                                  fontSize: 46,
                                  color:
                                    "text.disabled",
                                  mb: 1,
                                }}
                              />

                              <Typography fontWeight={800}>
                                No items added
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Scan a barcode
                                or search a
                                product by name.
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid
            size={{
              xs: 12,
              xl: 3.6,
            }}
          >
            <Card
              sx={{
                position: {
                  xl: "sticky",
                },
                top: {
                  xl: 90,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                >
                  <PaymentsRoundedIcon color="primary" />
                  <Typography variant="h6">
                    Checkout
                  </Typography>
                </Stack>

                <Divider sx={{ my: 2.5 }} />

                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Bill Date"
                    value={billDate}
                    onChange={(event) =>
                      setBillDate(
                        event.target.value
                      )
                    }
                    slotProps={{
                      inputLabel: {
                        shrink: true,
                      },
                    }}
                  />

                  <TextField
                    fullWidth
                    select
                    label="Payment Mode"
                    value={paymentMode}
                    onChange={(event) => {
                      setPaymentMode(
                        event.target.value
                      );
                      setAmountReceived("");
                      setSplitPayment({
                        cash: "",
                        online: "",
                        credit: "",
                      });
                    }}
                  >
                    <MenuItem value="Cash">
                      Cash
                    </MenuItem>
                    <MenuItem value="Online">
                      Online / UPI
                    </MenuItem>
                    <MenuItem value="Credit">
                      Credit
                    </MenuItem>
                    <MenuItem value="Split">
                      Split Payment
                    </MenuItem>
                  </TextField>

                  <Stack
                    direction="row"
                    spacing={1}
                  >
                    <TextField
                      select
                      label="Discount"
                      value={discountType}
                      onChange={(event) =>
                        setDiscountType(
                          event.target.value
                        )
                      }
                      sx={{ width: 130 }}
                    >
                      <MenuItem value="amount">
                        ₹ Amount
                      </MenuItem>
                      <MenuItem value="percent">
                        %
                      </MenuItem>
                    </TextField>

                    <TextField
                      fullWidth
                      type="number"
                      label={
                        discountType ===
                        "percent"
                          ? "Discount %"
                          : "Discount Amount"
                      }
                      value={discountValue}
                      onChange={(event) =>
                        setDiscountValue(
                          event.target.value
                        )
                      }
                      inputProps={{
                        min: 0,
                        max:
                          discountType ===
                          "percent"
                            ? 100
                            : undefined,
                      }}
                    />
                  </Stack>

                  {paymentMode === "Cash" && (
                    <TextField
                      fullWidth
                      type="number"
                      label="Amount Received"
                      value={amountReceived}
                      onChange={(event) =>
                        setAmountReceived(
                          event.target.value
                        )
                      }
                      helperText={`Change Return: ${money(
                        changeReturn
                      )}`}
                      inputProps={{
                        min: 0,
                      }}
                    />
                  )}

                  {paymentMode ===
                    "Split" && (
                    <Card
                      variant="outlined"
                    >
                      <CardContent>
                        <Typography fontWeight={800}>
                          Split Payment
                        </Typography>

                        <Stack
                          spacing={1.5}
                          sx={{ mt: 1.5 }}
                        >
                          <TextField
                            fullWidth
                            type="number"
                            label="Cash"
                            value={
                              splitPayment.cash
                            }
                            onChange={(
                              event
                            ) =>
                              setSplitPayment({
                                ...splitPayment,
                                cash:
                                  event
                                    .target
                                    .value,
                              })
                            }
                          />

                          <TextField
                            fullWidth
                            type="number"
                            label="UPI / Online"
                            value={
                              splitPayment.online
                            }
                            onChange={(
                              event
                            ) =>
                              setSplitPayment({
                                ...splitPayment,
                                online:
                                  event
                                    .target
                                    .value,
                              })
                            }
                          />

                          <TextField
                            fullWidth
                            type="number"
                            label="Credit"
                            value={
                              splitPayment.credit
                            }
                            onChange={(
                              event
                            ) =>
                              setSplitPayment({
                                ...splitPayment,
                                credit:
                                  event
                                    .target
                                    .value,
                              })
                            }
                          />

                          <Alert
                            severity={
                              Math.abs(
                                splitDifference
                              ) <= 0.01
                                ? "success"
                                : "info"
                            }
                          >
                            Entered{" "}
                            {money(
                              splitTotal
                            )}
                            . Difference{" "}
                            {money(
                              splitDifference
                            )}
                            .
                          </Alert>
                        </Stack>
                      </CardContent>
                    </Card>
                  )}

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor:
                        "background.default",
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                      >
                        <Typography color="text.secondary">
                          Total MRP
                        </Typography>
                        <Typography>
                          {money(totalMrp)}
                        </Typography>
                      </Stack>

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                      >
                        <Typography color="success.main">
                          Product Saving
                        </Typography>
                        <Typography color="success.main">
                          {money(
                            productSaving
                          )}
                        </Typography>
                      </Stack>

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                      >
                        <Typography color="text.secondary">
                          Subtotal
                        </Typography>
                        <Typography>
                          {money(subtotal)}
                        </Typography>
                      </Stack>

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                      >
                        <Typography color="text.secondary">
                          GST
                        </Typography>
                        <Typography>
                          {money(gst)}
                        </Typography>
                      </Stack>

                      {discountAmount >
                        0 && (
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                        >
                          <Typography color="success.main">
                            Bill Discount
                          </Typography>
                          <Typography color="success.main">
                            -
                            {money(
                              discountAmount
                            )}
                          </Typography>
                        </Stack>
                      )}

                      <Divider />

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography
                          variant="h6"
                          fontWeight={900}
                        >
                          Grand Total
                        </Typography>
                        <Typography
                          variant="h5"
                          fontWeight={900}
                          color="primary.main"
                        >
                          {money(
                            finalTotal
                          )}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>

                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    startIcon={
                      <ReceiptLongRoundedIcon />
                    }
                    onClick={generateBill}
                    disabled={
                      saving ||
                      !cart.length
                    }
                  >
                    {saving
                      ? "Generating..."
                      : "Generate Invoice (F5)"}
                  </Button>

                  {generatedInvoice && (
                    <>
                      <TextField
                        fullWidth
                        select
                        size="small"
                        label="Print Layout"
                        value={
                          printSettings.layout
                        }
                        onChange={(event) => {
                          const next = {
                            ...printSettings,
                            layout:
                              event.target
                                .value,
                          };

                          setPrintSettings(
                            next
                          );

                          localStorage.setItem(
                            "billing_print_settings",
                            JSON.stringify(
                              next
                            )
                          );
                        }}
                      >
                        <MenuItem value="a4">
                          A4 Tax Invoice
                        </MenuItem>
                        <MenuItem value="thermal">
                          Thermal Receipt
                        </MenuItem>
                      </TextField>

                      <Button
                        fullWidth
                        color="success"
                        variant="contained"
                        startIcon={
                          <PrintRoundedIcon />
                        }
                        onClick={
                          handlePrintInvoice
                        }
                      >
                        Print Last Invoice
                      </Button>

                      <Alert severity="success">
                        Last invoice:{" "}
                        {
                          generatedInvoice.invoice_number
                        }{" "}
                        ·{" "}
                        {money(
                          generatedInvoice.total_amount
                        )}
                      </Alert>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Dialog
          open={holdDialogOpen}
          onClose={() =>
            setHoldDialogOpen(false)
          }
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            Hold Current Bill
          </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={2}>
              <Alert severity="info">
                The bill will be stored in this
                browser until resumed or deleted.
              </Alert>

              <TextField
                fullWidth
                label="Reference / Note"
                placeholder="Customer waiting, table number, etc."
                value={holdNote}
                onChange={(event) =>
                  setHoldNote(
                    event.target.value
                  )
                }
              />

              <Typography>
                {cart.length} product(s) ·{" "}
                {money(finalTotal)}
              </Typography>
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={() =>
                setHoldDialogOpen(false)
              }
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={holdCurrentBill}
            >
              Hold Bill
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={resumeDialogOpen}
          onClose={() =>
            setResumeDialogOpen(false)
          }
          fullWidth
          maxWidth="md"
        >
          <DialogTitle>
            Resume Held Bill
          </DialogTitle>

          <DialogContent dividers>
            {!heldBills.length ? (
              <Box
                sx={{
                  py: 6,
                  textAlign: "center",
                }}
              >
                <PauseCircleOutlineRoundedIcon
                  sx={{
                    fontSize: 48,
                    color: "text.disabled",
                  }}
                />
                <Typography
                  fontWeight={800}
                  sx={{ mt: 1 }}
                >
                  No held bills
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {heldBills.map((held) => {
                  const heldTotal =
                    (held.cart || []).reduce(
                      (sum, item) => {
                        const base =
                          toNumber(
                            item.sale_price
                          ) *
                          toNumber(
                            item.quantity
                          );

                        return (
                          sum +
                          base +
                          (base *
                            toNumber(
                              item.gst_percent
                            )) /
                            100
                        );
                      },
                      0
                    );

                  return (
                    <Card
                      key={held.id}
                      variant="outlined"
                    >
                      <CardContent>
                        <Stack
                          direction={{
                            xs: "column",
                            sm: "row",
                          }}
                          justifyContent="space-between"
                          spacing={2}
                        >
                          <Box>
                            <Typography fontWeight={800}>
                              {held.note ||
                                held.id}
                            </Typography>

                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              {
                                held.cart
                                  ?.length
                              }{" "}
                              product(s) ·{" "}
                              {money(
                                heldTotal
                              )}
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Held{" "}
                              {held.held_at
                                ? new Date(
                                    held.held_at
                                  ).toLocaleString(
                                    "en-IN"
                                  )
                                : ""}
                            </Typography>
                          </Box>

                          <Stack
                            direction="row"
                            spacing={1}
                          >
                            <Button
                              variant="contained"
                              startIcon={
                                <PlayCircleOutlineRoundedIcon />
                              }
                              onClick={() =>
                                resumeHeldBill(
                                  held
                                )
                              }
                            >
                              Resume
                            </Button>

                            <Button
                              color="error"
                              onClick={() =>
                                deleteHeldBill(
                                  held.id
                                )
                              }
                            >
                              Delete
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </DialogContent>

          <DialogActions>
            <Button
              onClick={() =>
                setResumeDialogOpen(false)
              }
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>

      {generatedInvoice && (
        <InvoicePrint
          business={businessDetails}
          invoice={{
            invoice_number:
              generatedInvoice.invoice_number,
            bill_date:
              generatedInvoice.bill_date,
            payment_mode:
              generatedInvoice.payment_mode,
            subtotal:
              generatedInvoice.subtotal,
            gst_amount:
              generatedInvoice.gst_amount,
            discount:
              generatedInvoice.discount,
            total_mrp:
              generatedInvoice.total_mrp,
            total_saving:
              generatedInvoice.total_saving,
            total_amount:
              generatedInvoice.total_amount,
            paid_amount:
              generatedInvoice.paid_amount,
            balance:
              generatedInvoice.balance,
            cash_amount:
              generatedInvoice.cash_amount,
            online_amount:
              generatedInvoice.online_amount,
            credit_amount:
              generatedInvoice.credit_amount,
            amount_received:
              generatedInvoice.amount_received,
            change_return:
              generatedInvoice.change_return,
          }}
          customer={
            generatedInvoice.customer
          }
          items={generatedInvoice.items}
          printSettings={printSettings}
        />
      )}
    </AppLayout>
  );
}
