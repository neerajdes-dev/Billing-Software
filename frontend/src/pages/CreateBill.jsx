import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
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
  Typography,
} from "@mui/material";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";

import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import InvoicePrint from "../components/InvoicePrint";

import {
  createSale,
  getItemByBarcode,
  getSettings,
} from "../services/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value || 0));

export default function CreateBill() {
  const scannerRef = useRef(null);

  const savedUser = JSON.parse(localStorage.getItem("user")) || {};
  const userId = savedUser.user_id || "admin";

  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState([]);

  const [customer, setCustomer] = useState({
    customer_name: "",
    customer_mobile: "",
  });

  const [paymentMode, setPaymentMode] = useState("Cash");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [lastBill, setLastBill] = useState(null);

  /*
   * generatedInvoice stores a complete invoice snapshot.
   * This is important because the current cart is cleared
   * after the bill is generated.
   */
  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  const [businessDetails, setBusinessDetails] = useState({
    business_name: "",
    address: "",
    gst_number: "",
    mobile: "",
    email: "",
  });

  const [printSettings, setPrintSettings] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("billing_print_settings")
      ) || {
        layout: "a4",
        thermal_size: "80mm",
        show_logo: true,
        show_barcode: true,
        show_batch_expiry: true,
        show_savings: true,
        footer_message: "Thank you for your business. Visit again.",
      };
    } catch {
      return {
        layout: "a4",
        thermal_size: "80mm",
        show_logo: true,
        show_barcode: true,
        show_batch_expiry: true,
        show_savings: true,
        footer_message: "Thank you for your business. Visit again.",
      };
    }
  });

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadBusinessDetails = async () => {
      try {
        const data = await getSettings(userId);

        if (!data?.detail) {
          setBusinessDetails({
            business_name: data.business_name || "",
            address: data.address || "",
            gst_number: data.gst_number || "",
            mobile: data.mobile || "",
            email: data.email || "",
          });
        }
      } catch (error) {
        console.error("Could not load business settings:", error);
      }
    };

    loadBusinessDetails();
  }, [userId]);

  const addByBarcode = async () => {
    setMessage({ type: "", text: "" });

    if (!barcode.trim()) {
      setMessage({
        type: "warning",
        text: "Scan or enter a barcode first.",
      });
      return;
    }

    try {
      const item = await getItemByBarcode(barcode.trim());

      if (Number(item.stock || 0) <= 0) {
        throw new Error(`${item.item_name} is out of stock.`);
      }

      if (item.expiry_date) {
        const expiry = new Date(`${String(item.expiry_date).slice(0, 10)}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!Number.isNaN(expiry.getTime()) && expiry < today) {
          throw new Error(`${item.item_name} is expired and cannot be billed.`);
        }
      }

      setCart((current) => {
        const existingItem = current.find(
          (cartItem) => cartItem.id === item.id
        );

        if (existingItem) {
          if (existingItem.quantity >= Number(item.stock || 0)) {
            setMessage({
              type: "warning",
              text: `Only ${item.stock} unit(s) of ${item.item_name} are available.`,
            });
            return current;
          }

          return current.map((cartItem) =>
            cartItem.id === item.id
              ? {
                  ...cartItem,
                  quantity: cartItem.quantity + 1,
                }
              : cartItem
          );
        }

        return [
          ...current,
          {
            ...item,
            quantity: 1,
          },
        ];
      });

      setBarcode("");
      scannerRef.current?.focus();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to find the product.",
      });
    }
  };

  const updateQty = (id, quantity) => {
    setCart((items) =>
      items.map((item) => {
        if (item.id !== id) return item;

        const requested = Math.max(1, Number(quantity) || 1);
        const available = Math.max(1, Number(item.stock || 1));
        const finalQuantity = Math.min(requested, available);

        if (requested > available) {
          setMessage({
            type: "warning",
            text: `Only ${available} unit(s) of ${item.item_name} are available.`,
          });
        }

        return {
          ...item,
          quantity: finalQuantity,
        };
      })
    );
  };

  const removeItem = (id) => {
    setCart((items) => items.filter((item) => item.id !== id));
  };

  const subtotal = cart.reduce(
    (sum, item) =>
      sum + Number(item.sale_price || 0) * Number(item.quantity || 0),
    0
  );

  const totalMrp = cart.reduce(
    (sum, item) =>
      sum + Number(item.mrp || item.sale_price || 0) *
        Number(item.quantity || 0),
    0
  );

  const totalSaving = Math.max(totalMrp - subtotal, 0);

  const gst = cart.reduce((sum, item) => {
    const baseAmount =
      Number(item.sale_price || 0) * Number(item.quantity || 0);

    return (
      sum +
      (baseAmount * Number(item.gst_percent || 0)) / 100
    );
  }, 0);

  const total = subtotal + gst;

  const generateBill = async () => {
    if (!cart.length) {
      setMessage({
        type: "warning",
        text: "Add at least one item to generate an invoice.",
      });
      return;
    }

    if (
      paymentMode === "Credit" &&
      !customer.customer_name.trim()
    ) {
      setMessage({
        type: "warning",
        text: "Customer name is required for a credit bill.",
      });
      return;
    }

    try {
      setSaving(true);
      setMessage({ type: "", text: "" });

      const cartSnapshot = cart.map((item) => {
        const baseAmount =
          Number(item.sale_price || 0) *
          Number(item.quantity || 0);

        const itemGst =
          (baseAmount * Number(item.gst_percent || 0)) / 100;

        return {
          ...item,
          rate: Number(item.sale_price || 0),
          amount: baseAmount + itemGst,
        };
      });

      const customerSnapshot = {
        customer_name: customer.customer_name,
        mobile: customer.customer_mobile,
      };

      const result = await createSale({
        ...customer,
        payment_mode: paymentMode,
        bill_date: billDate,
        products: cart.map((item) => ({
          item_id: item.id,
          quantity: item.quantity,
        })),
      });

      if (result?.detail) {
        throw new Error(result.detail);
      }

      const invoiceSnapshot = {
        response: result,

        invoice_number:
          result.invoice_no ||
          result.invoice_number ||
          `INV-${Date.now()}`,

        bill_date:
          result.bill_date ||
          result.invoice_date ||
          billDate,

        payment_mode: paymentMode,

        subtotal,
        gst_amount: gst,
        total_mrp: totalMrp,
        total_saving: totalSaving,
        total_amount:
          result.final_amount ||
          result.total_amount ||
          total,

        customer: customerSnapshot,
        items: cartSnapshot,
      };

      setGeneratedInvoice(invoiceSnapshot);
      setLastBill(invoiceSnapshot);

      setCart([]);
      setBarcode("");

      setMessage({
        type: "success",
        text: `Invoice ${invoiceSnapshot.invoice_number} generated successfully.`,
      });

      scannerRef.current?.focus();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to generate the invoice.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!generatedInvoice) {
      setMessage({
        type: "warning",
        text: "Please generate the invoice first.",
      });
      return;
    }

    /*
     * Gives React and the browser enough time to render
     * the printable invoice before opening print preview.
     */
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <AppLayout>
      <Box className="no-print">
        <PageHeader
          title="Create Invoice"
          subtitle="Fast barcode billing with GST and multiple payment modes"
        />

        {message.text && (
          <Alert severity={message.type} sx={{ mb: 2.5 }}>
            {message.text}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, xl: 8.5 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems={{ md: "center" }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">
                      Customer & item entry
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      Scan products and build the invoice.
                    </Typography>
                  </Box>

                  <Chip
                    icon={<QrCodeScannerRoundedIcon />}
                    label="Scanner ready"
                    color="success"
                    variant="outlined"
                  />
                </Stack>

                <Divider sx={{ my: 2.5 }} />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Customer Name"
                      value={customer.customer_name}
                      onChange={(event) =>
                        setCustomer({
                          ...customer,
                          customer_name: event.target.value,
                        })
                      }
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      label="Mobile Number"
                      value={customer.customer_mobile}
                      onChange={(event) =>
                        setCustomer({
                          ...customer,
                          customer_mobile: event.target.value,
                        })
                      }
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Bill Date"
                      InputLabelProps={{ shrink: true }}
                      value={billDate}
                      onChange={(event) => setBillDate(event.target.value)}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      fullWidth
                      select
                      label="Payment Mode"
                      value={paymentMode}
                      onChange={(event) =>
                        setPaymentMode(event.target.value)
                      }
                    >
                      {["Cash", "Online", "Credit"].map((mode) => (
                        <MenuItem key={mode} value={mode}>
                          {mode}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, md: 9 }}>
                    <TextField
                      fullWidth
                      inputRef={scannerRef}
                      autoFocus
                      label="Scan Barcode / Enter Product Barcode"
                      value={barcode}
                      onChange={(event) =>
                        setBarcode(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addByBarcode();
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <QrCodeScannerRoundedIcon
                            color="action"
                            sx={{ mr: 1 }}
                          />
                        ),
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 3 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<AddRoundedIcon />}
                      onClick={addByBarcode}
                      sx={{ height: 40 }}
                    >
                      Add Product
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mt: 3 }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, py: 2.5 }}>
                  <Typography variant="h6">
                    Invoice items
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {cart.length} product line(s)
                  </Typography>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell width={110}>
                          Quantity
                        </TableCell>
                        <TableCell align="right">
                          MRP
                        </TableCell>
                        <TableCell align="right">
                          Rate
                        </TableCell>
                        <TableCell align="right">
                          GST
                        </TableCell>
                        <TableCell align="right">
                          Amount
                        </TableCell>
                        <TableCell width={64} />
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {!cart.length && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Box
                              sx={{
                                py: 7,
                                textAlign: "center",
                              }}
                            >
                              <ReceiptLongRoundedIcon
                                sx={{
                                  fontSize: 42,
                                  color: "#CBD5E1",
                                }}
                              />

                              <Typography
                                fontWeight={700}
                                sx={{ mt: 1 }}
                              >
                                No products added
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Scan a barcode to begin billing.
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}

                      {cart.map((item) => {
                        const baseAmount =
                          Number(item.sale_price || 0) *
                          Number(item.quantity || 0);

                        const lineAmount =
                          baseAmount +
                          (baseAmount *
                            Number(item.gst_percent || 0)) /
                            100;

                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Typography fontWeight={700}>
                                {item.item_name}
                              </Typography>

                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Barcode: {item.barcode}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <TextField
                                fullWidth
                                type="number"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateQty(
                                    item.id,
                                    event.target.value
                                  )
                                }
                                inputProps={{ min: 1 }}
                              />
                            </TableCell>

                            <TableCell align="right">
                              {money(item.mrp || item.sale_price)}
                            </TableCell>

                            <TableCell align="right">
                              {money(item.sale_price)}
                            </TableCell>

                            <TableCell align="right">
                              {Number(
                                item.gst_percent || 0
                              ).toFixed(2)}
                              %
                            </TableCell>

                            <TableCell align="right">
                              <Typography fontWeight={800}>
                                {money(lineAmount)}
                              </Typography>
                            </TableCell>

                            <TableCell>
                              <IconButton
                                color="error"
                                onClick={() =>
                                  removeItem(item.id)
                                }
                              >
                                <DeleteOutlineRoundedIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, xl: 3.5 }}>
            <Card
              sx={{
                position: { xl: "sticky" },
                top: 92,
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6">
                  Payment summary
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5, mb: 2.5 }}
                >
                  Review totals before generating bill.
                </Typography>

                <Stack spacing={1.7}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                  >
                    <Typography color="text.secondary">
                      Total MRP
                    </Typography>

                    <Typography fontWeight={700}>
                      {money(totalMrp)}
                    </Typography>
                  </Stack>

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                  >
                    <Typography color="success.main" fontWeight={700}>
                      Customer Saving
                    </Typography>

                    <Typography color="success.main" fontWeight={800}>
                      {money(totalSaving)}
                    </Typography>
                  </Stack>

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                  >
                    <Typography color="text.secondary">
                      Subtotal
                    </Typography>

                    <Typography fontWeight={700}>
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

                    <Typography fontWeight={700}>
                      {money(gst)}
                    </Typography>
                  </Stack>

                  <Divider />

                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                  >
                    <Typography variant="h6">
                      Grand total
                    </Typography>

                    <Typography
                      color="primary.main"
                      sx={{
                        fontSize: {
                          xs: 22,
                          sm: 26,
                        },
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {money(total)}
                    </Typography>
                  </Stack>
                </Stack>

                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  startIcon={<ReceiptLongRoundedIcon />}
                  disabled={saving || !cart.length}
                  onClick={generateBill}
                  sx={{
                    mt: 3,
                    height: 52,
                  }}
                >
                  {saving
                    ? "Generating..."
                    : "Generate Invoice"}
                </Button>

                {lastBill && (
                  <Paper
                    variant="outlined"
                    sx={{
                      mt: 2.5,
                      p: 2,
                      bgcolor: "#F8FAFC",
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      Last generated invoice
                    </Typography>

                    <Typography fontWeight={800}>
                      {lastBill.invoice_number}
                    </Typography>

                    <Typography
                      fontWeight={800}
                      color="primary.main"
                      sx={{ mt: 0.5 }}
                    >
                      {money(lastBill.total_amount)}
                    </Typography>

                    <TextField
                      fullWidth
                      select
                      size="small"
                      label="Print Layout"
                      value={printSettings.layout}
                      onChange={(event) => {
                        const next = {
                          ...printSettings,
                          layout: event.target.value,
                        };
                        setPrintSettings(next);
                        localStorage.setItem(
                          "billing_print_settings",
                          JSON.stringify(next)
                        );
                      }}
                      sx={{ mt: 2 }}
                    >
                      <MenuItem value="a4">A4 Tax Invoice</MenuItem>
                      <MenuItem value="thermal">Thermal Receipt</MenuItem>
                    </TextField>

                    {printSettings.layout === "thermal" && (
                      <TextField
                        fullWidth
                        select
                        size="small"
                        label="Thermal Paper"
                        value={printSettings.thermal_size}
                        onChange={(event) => {
                          const next = {
                            ...printSettings,
                            thermal_size: event.target.value,
                          };
                          setPrintSettings(next);
                          localStorage.setItem(
                            "billing_print_settings",
                            JSON.stringify(next)
                          );
                        }}
                        sx={{ mt: 1.5 }}
                      >
                        <MenuItem value="58mm">2 Inch / 58mm</MenuItem>
                        <MenuItem value="80mm">3 Inch / 80mm</MenuItem>
                        <MenuItem value="88mm">4 Inch / 88mm</MenuItem>
                      </TextField>
                    )}

                    <Button
                      fullWidth
                      variant="contained"
                      color="success"
                      startIcon={<PrintRoundedIcon />}
                      onClick={handlePrintInvoice}
                      disabled={!generatedInvoice}
                      sx={{ mt: 2 }}
                    >
                      Print Invoice
                    </Button>
                  </Paper>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {generatedInvoice && (
        <InvoicePrint
          business={businessDetails}
          invoice={{
            invoice_number:
              generatedInvoice.invoice_number,
            bill_date: generatedInvoice.bill_date,
            payment_mode:
              generatedInvoice.payment_mode,
            subtotal: generatedInvoice.subtotal,
            gst_amount:
              generatedInvoice.gst_amount,
            total_mrp:
              generatedInvoice.total_mrp,
            total_saving:
              generatedInvoice.total_saving,
            total_amount:
              generatedInvoice.total_amount,
            paid_amount:
              generatedInvoice.total_amount,
            balance: 0,
          }}
          customer={generatedInvoice.customer}
          items={generatedInvoice.items}
          printSettings={printSettings}
        />
      )}
    </AppLayout>
  );
}