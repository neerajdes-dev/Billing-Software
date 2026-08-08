import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  MenuItem,
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
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import { getSalesReport } from "../services/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const localDateValue = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 10);
};

const today = () => localDateValue(new Date());

const monthStart = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-01`;
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
};

const paymentChip = (mode) => {
  if (mode === "Credit") return "warning";
  if (mode === "Online") return "secondary";
  return "success";
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const EMPTY_REPORT = {
  total_sales: 0,
  cash_sales: 0,
  online_sales: 0,
  credit_sales: 0,
  total_gst: 0,
  total_bills: 0,
  sales: [],
};

export default function SalesReport() {
  const [report, setReport] = useState(EMPTY_REPORT);
  const [filters, setFilters] = useState({
    from_date: monthStart(),
    to_date: today(),
    payment_mode: "All",
  });
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState({
    type: "",
    text: "",
  });
  const [loading, setLoading] = useState(false);

  const load = async (customFilters = filters) => {
    try {
      setLoading(true);
      setMessage({ type: "", text: "" });

      if (
        customFilters.from_date &&
        customFilters.to_date &&
        customFilters.from_date > customFilters.to_date
      ) {
        throw new Error(
          "From Date cannot be later than To Date."
        );
      }

      const data = await getSalesReport(
        customFilters.from_date,
        customFilters.to_date,
        customFilters.payment_mode
      );

      setReport({
        ...EMPTY_REPORT,
        ...(data || {}),
        sales: Array.isArray(data?.sales)
          ? data.sales
          : [],
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to load sales report.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Initial report load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    const next = {
      from_date: monthStart(),
      to_date: today(),
      payment_mode: "All",
    };

    setFilters(next);
    setSearch("");
    load(next);
  };

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return report.sales;

    return report.sales.filter((sale) =>
      `${sale.invoice_no || ""} ${
        sale.customer_name || ""
      } ${sale.customer_mobile || ""} ${
        sale.payment_mode || ""
      }`
        .toLowerCase()
        .includes(term)
    );
  }, [report.sales, search]);

  const filteredTotals = useMemo(
    () => ({
      amount: filteredSales.reduce(
        (sum, sale) =>
          sum + Number(sale.final_amount || 0),
        0
      ),
      gst: filteredSales.reduce(
        (sum, sale) =>
          sum + Number(sale.gst_amount || 0),
        0
      ),
      subtotal: filteredSales.reduce(
        (sum, sale) =>
          sum + Number(sale.subtotal || 0),
        0
      ),
    }),
    [filteredSales]
  );

  const exportExcel = () => {
    const rows = filteredSales.map((sale) => ({
      Date: sale.bill_date || "",
      "Invoice No.": sale.invoice_no || "",
      Customer: sale.customer_name || "Walk-in Customer",
      Mobile: sale.customer_mobile || "",
      "Payment Mode": sale.payment_mode || "",
      Subtotal: Number(sale.subtotal || 0),
      GST: Number(sale.gst_amount || 0),
      "Final Amount": Number(sale.final_amount || 0),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Sales Report"
    );

    XLSX.writeFile(
      workbook,
      `Sales_Report_${filters.from_date || "All"}_${
        filters.to_date || "All"
      }.xlsx`
    );
  };

  const printReport = () => {
    const businessName =
      JSON.parse(localStorage.getItem("user") || "{}")
        ?.business_name || "Business";

    const logo =
      localStorage.getItem("billing_business_logo") ||
      "/resolvent-logo.jpg";

    const rows = filteredSales
      .map(
        (sale) => `
          <tr>
            <td>${escapeHtml(formatDate(sale.bill_date))}</td>
            <td>${escapeHtml(sale.invoice_no || "—")}</td>
            <td>${escapeHtml(
              sale.customer_name || "Walk-in Customer"
            )}</td>
            <td>${escapeHtml(sale.customer_mobile || "—")}</td>
            <td>${escapeHtml(sale.payment_mode || "—")}</td>
            <td class="num">${escapeHtml(
              money(sale.subtotal)
            )}</td>
            <td class="num">${escapeHtml(
              money(sale.gst_amount)
            )}</td>
            <td class="num">${escapeHtml(
              money(sale.final_amount)
            )}</td>
          </tr>
        `
      )
      .join("");

    const printWindow = window.open(
      "",
      "_blank",
      "width=1200,height=800"
    );

    if (!printWindow) {
      setMessage({
        type: "error",
        text: "Popup blocked. Please allow popups to print the sales report.",
      });
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Sales Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 24px;
              color: #111827;
            }

            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 18px;
            }

            .brand {
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .brand img {
              width: 72px;
              height: 52px;
              object-fit: contain;
            }

            h1, h2, p {
              margin: 0;
            }

            .meta {
              color: #64748b;
              margin-top: 4px;
              font-size: 12px;
            }

            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 18px 0;
            }

            .summary > div {
              border: 1px solid #cbd5e1;
              padding: 10px;
              border-radius: 6px;
            }

            .label {
              color: #64748b;
              font-size: 11px;
            }

            .value {
              font-weight: 700;
              margin-top: 4px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }

            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px;
            }

            th {
              background: #f1f5f9;
              text-align: left;
            }

            .num {
              text-align: right;
            }

            .footer {
              display: flex;
              justify-content: space-between;
              margin-top: 24px;
              font-size: 10px;
            }

            @page {
              size: landscape;
              margin: 10mm;
            }
          </style>
        </head>

        <body>
          <div class="header">
            <div class="brand">
              <img src="${escapeHtml(logo)}" />
              <div>
                <h1>${escapeHtml(businessName)}</h1>
                <h2>Sales Report</h2>
                <div class="meta">
                  ${escapeHtml(filters.from_date || "All Dates")}
                  to
                  ${escapeHtml(filters.to_date || "All Dates")}
                  ·
                  ${escapeHtml(filters.payment_mode)}
                </div>
              </div>
            </div>

            <div class="meta">
              Generated:
              ${escapeHtml(
                new Date().toLocaleString("en-IN")
              )}
            </div>
          </div>

          <div class="summary">
            <div>
              <div class="label">Total Sales</div>
              <div class="value">${escapeHtml(
                money(filteredTotals.amount)
              )}</div>
            </div>

            <div>
              <div class="label">Total GST</div>
              <div class="value">${escapeHtml(
                money(filteredTotals.gst)
              )}</div>
            </div>

            <div>
              <div class="label">Total Bills</div>
              <div class="value">${filteredSales.length}</div>
            </div>

            <div>
              <div class="label">Payment Filter</div>
              <div class="value">${escapeHtml(
                filters.payment_mode
              )}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Payment</th>
                <th class="num">Subtotal</th>
                <th class="num">GST</th>
                <th class="num">Final Amount</th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>
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

    printWindow.document.close();
  };

  const cards = [
    {
      label: "Total Sales",
      value: report.total_sales,
      helper: `${report.total_bills || 0} bill(s)`,
      icon: <TrendingUpRoundedIcon />,
    },
    {
      label: "Cash Sales",
      value: report.cash_sales,
      helper: "Collected in cash",
      icon: <PaymentsRoundedIcon />,
    },
    {
      label: "Online Sales",
      value: report.online_sales,
      helper: "UPI / online collections",
      icon: <CreditCardRoundedIcon />,
    },
    {
      label: "Credit Sales",
      value: report.credit_sales,
      helper: "Outstanding / credit billing",
      icon: <ReceiptLongRoundedIcon />,
    },
    {
      label: "Total GST",
      value: report.total_gst,
      helper: "GST in selected period",
      icon: <RequestQuoteRoundedIcon />,
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Sales Report"
        subtitle="Review date-wise invoices, collections, GST and payment-mode performance"
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

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6">
            Report Filters
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, mb: 2.5 }}
          >
            Select a date range and payment mode to review
            sales.
          </Typography>

          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                type="date"
                label="From Date"
                value={filters.from_date}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    from_date: event.target.value,
                  })
                }
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                type="date"
                label="To Date"
                value={filters.to_date}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    to_date: event.target.value,
                  })
                }
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                select
                label="Payment Mode"
                value={filters.payment_mode}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    payment_mode: event.target.value,
                  })
                }
              >
                {["All", "Cash", "Online", "Credit"].map(
                  (mode) => (
                    <MenuItem key={mode} value={mode}>
                      {mode}
                    </MenuItem>
                  )
                )}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => load()}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Apply"}
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={reset}
                  disabled={loading}
                >
                  Reset
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((card) => (
          <Grid
            key={card.label}
            size={{
              xs: 12,
              sm: 6,
              md: 4,
              xl: 2.4,
            }}
          >
            <Card sx={{ height: "100%" }}>
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
                      {money(card.value)}
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
                      flexShrink: 0,
                    }}
                  >
                    {card.icon}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
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
            <Stack
              direction={{
                xs: "column",
                lg: "row",
              }}
              justifyContent="space-between"
              alignItems={{
                xs: "stretch",
                lg: "center",
              }}
              spacing={2}
            >
              <Box>
                <Typography variant="h6">
                  Invoice Register
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {report.total_bills || 0} bill(s) · GST{" "}
                  {money(report.total_gst)}
                </Typography>
              </Box>

              <Stack
  direction={{ xs: "column", md: "row" }}
  spacing={1.25}
  useFlexGap
  flexWrap="wrap"
  alignItems={{ xs: "stretch", md: "center" }}
>
  <TextField
    size="small"
    placeholder="Search invoice or customer"
    value={search}
    onChange={(event) =>
      setSearch(event.target.value)
    }
    sx={{
      width: { xs: "100%", md: 320 },
      flexShrink: 0,
    }}
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

  <Button
    variant="outlined"
    startIcon={<RefreshRoundedIcon />}
    onClick={() => load()}
    disabled={loading}
    sx={{
      height: 42,
      minWidth: 120,
      flexShrink: 0,
    }}
  >
    Refresh
  </Button>

  <Button
    variant="outlined"
    startIcon={<FileDownloadRoundedIcon />}
    onClick={exportExcel}
    disabled={!filteredSales.length}
    sx={{
      height: 42,
      minWidth: 145,
      flexShrink: 0,
    }}
  >
    Export Excel
  </Button>

  <Button
    variant="outlined"
    startIcon={<PrintRoundedIcon />}
    onClick={printReport}
    disabled={!filteredSales.length}
    sx={{
      height: 42,
      minWidth: 110,
      flexShrink: 0,
    }}
  >
    Print
  </Button>
</Stack>
            </Stack>

            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              justifyContent="space-between"
              spacing={1}
              sx={{ mt: 2 }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Showing {filteredSales.length} record(s)
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Current view:{" "}
                <strong>
                  {money(filteredTotals.amount)}
                </strong>
              </Typography>
            </Stack>
          </Box>

          <TableContainer sx={{ maxHeight: 620 }}>
            <Table
              stickyHeader
              size="small"
              sx={{
                minWidth: 1050,
                "& .MuiTableCell-head": {
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell align="right">
                    Subtotal
                  </TableCell>
                  <TableCell align="right">
                    GST
                  </TableCell>
                  <TableCell align="right">
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow key={sale.id} hover>
                    <TableCell>
                      {formatDate(sale.bill_date)}
                    </TableCell>

                    <TableCell>
                      <Typography
                        fontWeight={800}
                        color="primary.main"
                      >
                        {sale.invoice_no || "—"}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      {sale.customer_name ||
                        "Walk-in Customer"}
                    </TableCell>

                    <TableCell>
                      {sale.customer_mobile || "—"}
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        label={sale.payment_mode || "—"}
                        color={paymentChip(
                          sale.payment_mode
                        )}
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell align="right">
                      {money(sale.subtotal)}
                    </TableCell>

                    <TableCell align="right">
                      {money(sale.gst_amount)}
                    </TableCell>

                    <TableCell align="right">
                      <Typography fontWeight={800}>
                        {money(sale.final_amount)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}

                {!filteredSales.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Box
                        sx={{
                          py: 8,
                          textAlign: "center",
                        }}
                      >
                        <ReceiptLongRoundedIcon
                          sx={{
                            fontSize: 46,
                            color: "text.disabled",
                            mb: 1,
                          }}
                        />

                        <Typography fontWeight={800}>
                          No sales found
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          Change the date range, payment
                          mode or search text.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell colSpan={8}>
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
                          Loading sales report...
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
