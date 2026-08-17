import { useEffect, useMemo, useState } from "react";
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
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import {
  addDealer,
  addDealerPayment,
  deleteDealer,
  getDealerLedger,
  getDealers,
} from "../services/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value || 0));

const today = () => new Date().toISOString().slice(0, 10);

const emptySupplier = {
  dealer_name: "",
  mobile: "",
  email: "",
  gst_number: "",
  address: "",
};

export default function Dealers() {
  const [dealers, setDealers] = useState([]);
  const [message, setMessage] = useState({
    type: "",
    text: "",
  });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptySupplier);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState(null);

  const [payment, setPayment] = useState({
    paid_amount: "",
    payment_mode: "Cash",
    payment_date: today(),
    reference: "",
    note: "",
  });

  const load = async () => {
    try {
      setDealers(await getDealers());
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(
    () =>
      dealers.reduce(
        (acc, dealer) => ({
          purchase:
            acc.purchase +
            Number(dealer.bill_amount || 0),
          paid:
            acc.paid +
            Number(dealer.paid_amount || 0),
          pending:
            acc.pending +
            Number(dealer.pending_amount || 0),
        }),
        {
          purchase: 0,
          paid: 0,
          pending: 0,
        }
      ),
    [dealers]
  );

  const saveSupplier = async () => {
    if (!form.dealer_name.trim()) {
      setMessage({
        type: "warning",
        text: "Supplier name is required.",
      });
      return;
    }

    try {
      setSaving(true);

      await addDealer({
        dealer_name: form.dealer_name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim() || null,
        gst_number: form.gst_number.trim() || null,
        address: form.address.trim() || null,
      });

      setForm(emptySupplier);
      await load();

      setMessage({
        type: "success",
        text: "Supplier saved successfully.",
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

  const openPayment = (dealer) => {
    setSelected(dealer);
    setPayment({
      paid_amount: "",
      payment_mode: "Cash",
      payment_date: today(),
      reference: "",
      note: "",
    });
    setPaymentOpen(true);
  };

  const recordPayment = async () => {
    const amount = Number(payment.paid_amount || 0);

    if (amount <= 0) {
      setMessage({
        type: "warning",
        text: "Enter a valid supplier payment amount.",
      });
      return;
    }

    if (amount > Number(selected?.pending_amount || 0)) {
      setMessage({
        type: "warning",
        text: "Payment cannot exceed supplier outstanding amount.",
      });
      return;
    }

    try {
      setSaving(true);

      await addDealerPayment({
        dealer_id: selected.id,
        ...payment,
        paid_amount: amount,
      });

      setPaymentOpen(false);
      await load();

      setMessage({
        type: "success",
        text: "Supplier payment recorded successfully.",
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

  const showLedger = async (dealer) => {
    try {
      setSelected(dealer);
      setLedgerOpen(true);
      setLedger(null);
      setLedger(await getDealerLedger(dealer.id));
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    }
  };

  const remove = async (dealer) => {
    if (
      !window.confirm(
        `Delete ${dealer.dealer_name}? This also deletes its supplier ledger and linked purchase records.`
      )
    ) {
      return;
    }

    try {
      await deleteDealer(dealer.id);
      await load();
      setMessage({
        type: "success",
        text: "Supplier deleted.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Suppliers & Ledger"
        subtitle="Manage supplier masters, purchase balances and dated payments"
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

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          ["Suppliers", dealers.length],
          ["Total purchases", money(totals.purchase)],
          ["Total paid", money(totals.paid)],
          ["Outstanding", money(totals.pending)],
        ].map(([label, value]) => (
          <Grid
            key={label}
            size={{ xs: 12, sm: 6, lg: 3 }}
          >
            <Card>
              <CardContent>
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
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack
                direction="row"
                spacing={1.2}
                alignItems="center"
                sx={{ mb: 2.5 }}
              >
                <PersonAddAltRoundedIcon color="primary" />
                <Box>
                  <Typography variant="h6">
                    Add Supplier
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Create supplier details before entering a purchase.
                  </Typography>
                </Box>
              </Stack>

              <Stack spacing={2}>
                <TextField
                  label="Supplier Name *"
                  value={form.dealer_name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dealer_name: e.target.value,
                    })
                  }
                />
                <TextField
                  label="Mobile"
                  value={form.mobile}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      mobile: e.target.value,
                    })
                  }
                />
                <TextField
                  label="Email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: e.target.value,
                    })
                  }
                />
                <TextField
                  label="GST Number"
                  value={form.gst_number}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      gst_number: e.target.value,
                    })
                  }
                />
                <TextField
                  label="Address"
                  multiline
                  rows={3}
                  value={form.address}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: e.target.value,
                    })
                  }
                />

                <Button
                  variant="contained"
                  startIcon={<LocalShippingRoundedIcon />}
                  onClick={saveSupplier}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save Supplier"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 3 }}>
                <Typography variant="h6">
                  Supplier Summary
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Purchase bills are created automatically from Purchase Management.
                </Typography>
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Supplier</TableCell>
                      <TableCell>GSTIN</TableCell>
                      <TableCell align="right">
                        Purchases
                      </TableCell>
                      <TableCell align="right">
                        Paid
                      </TableCell>
                      <TableCell align="right">
                        Outstanding
                      </TableCell>
                      <TableCell align="center">
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {dealers.map((dealer) => (
                      <TableRow key={dealer.id} hover>
                        <TableCell>
                          <Typography fontWeight={800}>
                            {dealer.dealer_name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {dealer.mobile || "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {dealer.gst_number || "—"}
                        </TableCell>
                        <TableCell align="right">
                          {money(dealer.bill_amount)}
                        </TableCell>
                        <TableCell align="right">
                          {money(dealer.paid_amount)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={900}
                            color={
                              Number(dealer.pending_amount) > 0
                                ? "error.main"
                                : "success.main"
                            }
                          >
                            {money(dealer.pending_amount)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Record Payment">
                            <span>
                              <IconButton
                                color="success"
                                disabled={
                                  Number(
                                    dealer.pending_amount
                                  ) <= 0
                                }
                                onClick={() =>
                                  openPayment(dealer)
                                }
                              >
                                <PaymentsRoundedIcon />
                              </IconButton>
                            </span>
                          </Tooltip>

                          <Tooltip title="Supplier Ledger">
                            <IconButton
                              color="primary"
                              onClick={() =>
                                showLedger(dealer)
                              }
                            >
                              <HistoryRoundedIcon />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete Supplier">
                            <IconButton
                              color="error"
                              onClick={() =>
                                remove(dealer)
                              }
                            >
                              <DeleteOutlineRoundedIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!dealers.length && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          align="center"
                          sx={{ py: 7 }}
                        >
                          No suppliers found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Record Supplier Payment
        </DialogTitle>

        <DialogContent dividers>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2.5 }}
          >
            {selected?.dealer_name} · Outstanding{" "}
            {money(selected?.pending_amount)}
          </Typography>

          <Stack spacing={2}>
            <TextField
              type="number"
              label="Payment Amount"
              value={payment.paid_amount}
              onChange={(e) =>
                setPayment({
                  ...payment,
                  paid_amount: e.target.value,
                })
              }
            />
            <TextField
              type="date"
              label="Payment Date"
              InputLabelProps={{ shrink: true }}
              value={payment.payment_date}
              onChange={(e) =>
                setPayment({
                  ...payment,
                  payment_date: e.target.value,
                })
              }
            />
            <TextField
              select
              label="Payment Mode"
              value={payment.payment_mode}
              onChange={(e) =>
                setPayment({
                  ...payment,
                  payment_mode: e.target.value,
                })
              }
            >
              {[
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
            <TextField
              label="Reference Number"
              value={payment.reference}
              onChange={(e) =>
                setPayment({
                  ...payment,
                  reference: e.target.value,
                })
              }
            />
            <TextField
              label="Note"
              multiline
              rows={2}
              value={payment.note}
              onChange={(e) =>
                setPayment({
                  ...payment,
                  note: e.target.value,
                })
              }
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setPaymentOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={recordPayment}
            disabled={saving}
          >
            Save Payment
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Supplier Ledger — {selected?.dealer_name}
        </DialogTitle>

        <DialogContent dividers>
          {!ledger ? (
            <Typography color="text.secondary">
              Loading ledger...
            </Typography>
          ) : (
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                {[
                  [
                    "Total Purchases",
                    money(ledger.summary?.total_bills),
                  ],
                  [
                    "Total Paid",
                    money(ledger.summary?.total_paid),
                  ],
                  [
                    "Outstanding",
                    money(ledger.summary?.outstanding),
                  ],
                ].map(([label, value]) => (
                  <Grid
                    key={label}
                    size={{ xs: 12, sm: 4 }}
                  >
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 3,
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {label}
                      </Typography>
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        sx={{ mt: 0.5 }}
                      >
                        {value}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography
                    fontWeight={850}
                    sx={{ mb: 1 }}
                  >
                    Purchase Bills
                  </Typography>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ borderRadius: 3 }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Invoice</TableCell>
                          <TableCell align="right">
                            Amount
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(ledger.bills || []).map(
                          (row, index) => (
                            <TableRow
                              key={
                                row.id ||
                                `${row.bill_number}-${index}`
                              }
                            >
                              <TableCell>
                                {row.bill_date
                                  ? String(
                                      row.bill_date
                                    ).slice(0, 10)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {row.bill_number || "—"}
                              </TableCell>
                              <TableCell align="right">
                                {money(row.bill_amount)}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography
                    fontWeight={850}
                    sx={{ mb: 1 }}
                  >
                    Payments
                  </Typography>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ borderRadius: 3 }}
                  >
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Mode</TableCell>
                          <TableCell align="right">
                            Amount
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(ledger.payments || []).map(
                          (row) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                {row.payment_date
                                  ? String(
                                      row.payment_date
                                    ).slice(0, 10)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={row.payment_mode}
                                />
                              </TableCell>
                              <TableCell align="right">
                                {money(row.paid_amount)}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setLedgerOpen(false)}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
