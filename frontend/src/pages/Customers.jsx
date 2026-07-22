import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
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
  Typography,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import {
  addCustomer,
  addCustomerPayment,
  getCustomerCreditLedger,
} from "../services/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const actionButtonSx = {
  minHeight: 46,
  borderRadius: 2.5,
  px: 2.25,
  justifyContent: "flex-start",
  fontWeight: 800,
  textTransform: "none",
  borderColor: "primary.main",
  color: "primary.main",
  bgcolor: "background.paper",
  "&:hover": {
    borderColor: "primary.dark",
    bgcolor: "primary.light",
  },
};

const emptyPayment = {
  paid_amount: "",
  payment_mode: "Cash",
  payment_date: dayjs(),
  reference: "",
  note: "",
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [form, setForm] = useState({ customer_name: "", mobile: "", address: "" });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [payment, setPayment] = useState(emptyPayment);

  const load = async () => {
    try {
      setCustomers(await getCustomerCreditLedger());
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredCustomers = useMemo(() => {
    const value = search.trim().toLowerCase();
    return customers.filter((customer) =>
      `${customer.customer_name || ""} ${customer.mobile || ""}`
        .toLowerCase()
        .includes(value)
    );
  }, [customers, search]);

  const totals = useMemo(
    () =>
      customers.reduce(
        (summary, customer) => ({
          credit: summary.credit + Number(customer.credit_amount || 0),
          paid: summary.paid + Number(customer.paid_amount || 0),
          outstanding: summary.outstanding + Number(customer.pending_amount || 0),
        }),
        { credit: 0, paid: 0, outstanding: 0 }
      ),
    [customers]
  );

  const save = async () => {
    if (!form.customer_name.trim()) {
      setMessage({ type: "warning", text: "Customer name is required." });
      return;
    }

    try {
      setSaving(true);
      await addCustomer(form);
      setForm({ customer_name: "", mobile: "", address: "" });
      await load();
      setMessage({ type: "success", text: "Customer saved successfully." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (customer) => {
    setSelectedCustomer(customer);
    setPayment(emptyPayment);
    setPaymentOpen(true);
  };

  const openHistory = (customer) => {
    setSelectedCustomer(customer);
    setHistoryOpen(true);
  };

  const savePayment = async () => {
    const amount = Number(payment.paid_amount || 0);
    const outstanding = Number(selectedCustomer?.pending_amount || 0);

    if (amount <= 0) {
      setMessage({ type: "warning", text: "Enter a payment amount greater than zero." });
      return;
    }
    if (amount > outstanding) {
      setMessage({
        type: "warning",
        text: `Payment cannot exceed outstanding amount of ${money(outstanding)}.`,
      });
      return;
    }

    try {
      setPaymentSaving(true);
      const result = await addCustomerPayment({
        customer_id: selectedCustomer.id,
        paid_amount: amount,
        payment_mode: payment.payment_mode,
        payment_date: payment.payment_date.format("YYYY-MM-DD"),
        reference: payment.reference.trim() || null,
        note: payment.note.trim() || null,
      });
      setPaymentOpen(false);
      await load();
      setMessage({
        type: "success",
        text: `${result.message}. Updated outstanding: ${money(
          result.updated_outstanding_amount
        )}.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setPaymentSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Credit Customers"
        subtitle="Track credit purchases, received payments and outstanding balances"
      />

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 2.5 }} onClose={() => setMessage({ type: "", text: "" })}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          ["Credit customers", customers.length, <PeopleAltRoundedIcon />],
          ["Total credit", money(totals.credit), <ReceiptLongRoundedIcon />],
          ["Amount received", money(totals.paid), <PaymentsRoundedIcon />],
          ["Outstanding", money(totals.outstanding), <AccountBalanceWalletRoundedIcon />],
        ].map(([label, value, icon]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, xl: 3 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: "100%" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="h5" fontWeight={900} sx={{ mt: 0.6 }}>{value}</Typography>
                </Box>
                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center" }}>
                  {icon}
                </Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 3.5 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: "primary.light", color: "primary.main", display: "grid", placeItems: "center" }}>
                  <AddRoundedIcon />
                </Box>
                <Box>
                  <Typography variant="h6">Add customer</Typography>
                  <Typography variant="body2" color="text.secondary">Create a new credit profile.</Typography>
                </Box>
              </Stack>

              <Stack spacing={2} sx={{ mt: 3 }}>
                <TextField label="Customer Name" value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} />
                <TextField label="Mobile Number" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
                <TextField label="Address" multiline rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
                <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={save} disabled={saving} sx={actionButtonSx}>
                  {saving ? "Saving..." : "Save Customer"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 8.5 }}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 3, display: "flex", gap: 2, justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" } }}>
                <Box>
                  <Typography variant="h6">Credit amount details</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Credit purchases automatically increase the balance. Record a payment to reduce paid and outstanding amounts.
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  placeholder="Search customer or mobile"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  sx={{ maxWidth: 320 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Divider />

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell>Mobile</TableCell>
                      <TableCell>Purchase Date</TableCell>
                      <TableCell align="right">Credit Amount</TableCell>
                      <TableCell align="right">Paid Amount</TableCell>
                      <TableCell align="right">Outstanding</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>
                          No credit customers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <TableRow key={customer.id} hover>
                          <TableCell>
                            <Typography fontWeight={800}>{customer.customer_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{customer.address || "No address"}</Typography>
                          </TableCell>
                          <TableCell>{customer.mobile || "-"}</TableCell>
                          <TableCell>{customer.purchase_date ? dayjs(customer.purchase_date).format("DD MMM YYYY") : "-"}</TableCell>
                          <TableCell align="right"><Typography fontWeight={750}>{money(customer.credit_amount)}</Typography></TableCell>
                          <TableCell align="right"><Typography fontWeight={750} color="success.main">{money(customer.paid_amount)}</Typography></TableCell>
                          <TableCell align="right">
                            <Chip
                              label={money(customer.pending_amount)}
                              color={Number(customer.pending_amount || 0) > 0 ? "warning" : "success"}
                              variant="outlined"
                              sx={{ fontWeight: 800 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction={{ xs: "column", xl: "row" }} spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<PaymentsRoundedIcon />}
                                onClick={() => openPayment(customer)}
                                disabled={Number(customer.pending_amount || 0) <= 0}
                                sx={{ ...actionButtonSx, minHeight: 38, px: 1.5, whiteSpace: "nowrap" }}
                              >
                                Update Amount
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<HistoryRoundedIcon />}
                                onClick={() => openHistory(customer)}
                                sx={{ ...actionButtonSx, minHeight: 38, px: 1.5, whiteSpace: "nowrap" }}
                              >
                                History
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={paymentOpen} onClose={() => !paymentSaving && setPaymentOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Update Credit Amount</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.25}>
            <Box>
              <Typography fontWeight={850}>{selectedCustomer?.customer_name}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedCustomer?.mobile || "No mobile number"}</Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}><Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary">Credit</Typography><Typography fontWeight={850}>{money(selectedCustomer?.credit_amount)}</Typography></Paper></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary">Paid</Typography><Typography fontWeight={850} color="success.main">{money(selectedCustomer?.paid_amount)}</Typography></Paper></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><Paper variant="outlined" sx={{ p: 1.5 }}><Typography variant="caption" color="text.secondary">Outstanding</Typography><Typography fontWeight={850} color="warning.main">{money(selectedCustomer?.pending_amount)}</Typography></Paper></Grid>
            </Grid>

            <Alert severity="info">
              Enter the amount received from the customer. After saving, Paid Amount increases and Outstanding Amount decreases automatically.
            </Alert>

            <TextField label="Payment Amount" type="number" value={payment.paid_amount} onChange={(event) => setPayment({ ...payment, paid_amount: event.target.value })} inputProps={{ min: 0.01, max: selectedCustomer?.pending_amount, step: 0.01 }} />
            <TextField select label="Payment Mode" value={payment.payment_mode} onChange={(event) => setPayment({ ...payment, payment_mode: event.target.value })}>
              {["Cash", "Online", "Cheque", "Bank Transfer", "UPI"].map((mode) => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
            </TextField>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker label="Payment Date" value={payment.payment_date} onChange={(value) => value && setPayment({ ...payment, payment_date: value })} format="DD-MM-YYYY" slotProps={{ textField: { fullWidth: true } }} />
            </LocalizationProvider>
            <TextField label="Reference Number" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} placeholder="UPI reference, cheque number, transaction ID" />
            <TextField label="Note" multiline rows={3} value={payment.note} onChange={(event) => setPayment({ ...payment, note: event.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" onClick={() => setPaymentOpen(false)} disabled={paymentSaving} sx={actionButtonSx}>Cancel</Button>
          <Button variant="outlined" startIcon={<PaymentsRoundedIcon />} onClick={savePayment} disabled={paymentSaving} sx={actionButtonSx}>
            {paymentSaving ? "Updating..." : "Update Amount"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Credit & Payment History</DialogTitle>
        <DialogContent dividers>
          <Typography variant="h6">{selectedCustomer?.customer_name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Purchase dates show when credit invoices were created. Payment history shows each received amount.
          </Typography>

          <Typography fontWeight={850} sx={{ mb: 1 }}>Credit purchases</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead><TableRow><TableCell>Invoice</TableCell><TableCell>Purchase Date</TableCell><TableCell align="right">Credit Amount</TableCell></TableRow></TableHead>
              <TableBody>
                {(selectedCustomer?.credit_purchases || []).length === 0 ? (
                  <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}>No credit purchases</TableCell></TableRow>
                ) : selectedCustomer.credit_purchases.map((purchase) => (
                  <TableRow key={purchase.id}><TableCell>{purchase.invoice_no}</TableCell><TableCell>{purchase.purchase_date ? dayjs(purchase.purchase_date).format("DD MMM YYYY") : "-"}</TableCell><TableCell align="right">{money(purchase.credit_amount)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography fontWeight={850} sx={{ mt: 3, mb: 1 }}>Payments received</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead><TableRow><TableCell>Payment Date</TableCell><TableCell>Mode</TableCell><TableCell>Reference</TableCell><TableCell>Note</TableCell><TableCell align="right">Paid Amount</TableCell></TableRow></TableHead>
              <TableBody>
                {(selectedCustomer?.payments || []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>No payments recorded</TableCell></TableRow>
                ) : selectedCustomer.payments.map((item) => (
                  <TableRow key={item.id}><TableCell>{item.payment_date ? dayjs(item.payment_date).format("DD MMM YYYY") : "-"}</TableCell><TableCell>{item.payment_mode}</TableCell><TableCell>{item.reference || "-"}</TableCell><TableCell>{item.note || "-"}</TableCell><TableCell align="right">{money(item.paid_amount)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button variant="outlined" onClick={() => setHistoryOpen(false)} sx={actionButtonSx}>Close</Button></DialogActions>
      </Dialog>
    </AppLayout>
  );
}
