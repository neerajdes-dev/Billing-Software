import {
  Box,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  buildUpiPaymentUrl,
  DEFAULT_UPI_SETTINGS,
} from "../utils/upi";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const plainMoney = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
};

const formatTime = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const integerToWords = (number) => {
  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];

  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];

  const belowHundred = (value) => {
    if (value < 20) return ones[value];

    return `${tens[Math.floor(value / 10)]}${
      value % 10 ? ` ${ones[value % 10]}` : ""
    }`;
  };

  const belowThousand = (value) => {
    if (value < 100) return belowHundred(value);

    const hundred = Math.floor(value / 100);
    const remainder = value % 100;

    return `${ones[hundred]} HUNDRED${
      remainder ? ` ${belowHundred(remainder)}` : ""
    }`;
  };

  const value = Math.max(0, Math.floor(Number(number || 0)));

  if (value === 0) return "ZERO";

  const parts = [];
  let remaining = value;

  const crore = Math.floor(remaining / 10000000);
  if (crore) {
    parts.push(`${integerToWords(crore)} CRORE`);
    remaining %= 10000000;
  }

  const lakh = Math.floor(remaining / 100000);
  if (lakh) {
    parts.push(`${integerToWords(lakh)} LAKH`);
    remaining %= 100000;
  }

  const thousand = Math.floor(remaining / 1000);
  if (thousand) {
    parts.push(`${integerToWords(thousand)} THOUSAND`);
    remaining %= 1000;
  }

  if (remaining) {
    parts.push(belowThousand(remaining));
  }

  return parts.join(" ");
};

const amountInWords = (value) => {
  const amount = Number(value || 0);
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  return `RUPEES ${integerToWords(rupees)}${
    paise ? ` AND ${integerToWords(paise)} PAISE` : ""
  } ONLY`;
};

const getUpiSettings = () => {
  if (typeof window === "undefined") {
    return DEFAULT_UPI_SETTINGS;
  }

  try {
    return {
      ...DEFAULT_UPI_SETTINGS,
      ...(JSON.parse(
        localStorage.getItem("billing_upi_settings") || "{}"
      ) || {}),
    };
  } catch {
    return DEFAULT_UPI_SETTINGS;
  }
};

function ThermalInvoice({
  business,
  invoice,
  customer,
  items,
  printSettings,
  businessLogo,
  upiSettings,
  preview = false,
}) {
  const thermalSize = printSettings.thermal_size || "80mm";
  const is58 = thermalSize === "58mm";
  const showLogo = printSettings.show_logo !== false;
  const showBarcode = printSettings.show_barcode !== false;
  const showBatchExpiry = printSettings.show_batch_expiry !== false;
  const showSavings = printSettings.show_savings !== false;
  const showFooter = printSettings.show_footer !== false;

  const subtotal = Number(invoice.subtotal || 0);
  const gstAmount = Number(invoice.gst_amount || 0);
  const discount = Number(invoice.discount || 0);
  const grandTotal = Number(invoice.total_amount || 0);
  const totalMrp = Number(invoice.total_mrp || 0);
  const totalSaving = Number(
    invoice.total_saving ||
      Math.max(totalMrp - subtotal, 0)
  );
  const paidAmount = Number(
    invoice.paid_amount ?? grandTotal
  );
  const balance = Number(
    invoice.balance ?? Math.max(grandTotal - paidAmount, 0)
  );
  const roundOff = Number(invoice.round_off || 0);

  const shouldShowQr =
    upiSettings.enabled &&
    printSettings.show_payment_qr !== false &&
    (invoice.payment_mode !== "Cash" ||
      upiSettings.show_for_cash);

  const amountToPay =
    balance > 0 ? balance : grandTotal;

  const upiUrl = shouldShowQr
    ? buildUpiPaymentUrl({
        settings: upiSettings,
        amount: amountToPay,
        invoiceNumber: invoice.invoice_number,
        customerName: customer.customer_name,
      })
    : "";

  const qrSize = is58
    ? Math.min(Number(upiSettings.qr_size || 110), 105)
    : Math.min(Number(upiSettings.qr_size || 130), 125);

  const font = is58 ? 9.2 : 10.2;
  const small = is58 ? 8 : 8.8;
  const section = is58 ? 9.5 : 10.5;

  return (
    <Box
      className={`${preview ? "invoice-preview-area" : "invoice-print-area"} invoice-thermal`}
      data-thermal-size={thermalSize}
      sx={{
        width: thermalSize,
        bgcolor: "#fff",
        color: "#000",
        p: is58 ? "1.6mm" : "2.2mm",
        fontFamily: '"Arial", "Segoe UI", sans-serif',
        fontSize: font,
        lineHeight: 1.22,
      }}
    >
      <Stack alignItems="center" spacing={0.35}>
        {showLogo && (
          <Box
            component="img"
            src={businessLogo}
            alt="Business Logo"
            sx={{
              width: is58 ? 42 : 54,
              height: is58 ? 32 : 42,
              objectFit: "contain",
              mb: 0.25,
            }}
          />
        )}

        <Typography
          sx={{
            fontSize: is58 ? 12 : 14,
            fontWeight: 900,
            textAlign: "center",
            lineHeight: 1.12,
          }}
        >
          {business.business_name || "Business Name"}
        </Typography>

        {business.address && (
          <Typography
            sx={{
              fontSize: small,
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            {business.address}
          </Typography>
        )}

        <Typography
          sx={{
            fontSize: small,
            textAlign: "center",
          }}
        >
          {business.gst_number
            ? `GSTIN: ${business.gst_number}`
            : "GSTIN: Not configured"}
        </Typography>

        {(business.mobile || business.email) && (
          <Typography
            sx={{
              fontSize: small,
              textAlign: "center",
            }}
          >
            {[business.mobile, business.email]
              .filter(Boolean)
              .join(" | ")}
          </Typography>
        )}
      </Stack>

      <Box
        sx={{
          borderTop: "1px solid #000",
          borderBottom: "1px solid #000",
          py: 0.55,
          my: 0.8,
          textAlign: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: section,
            fontWeight: 900,
          }}
        >
          {business.gst_number
            ? "TAX INVOICE"
            : "BILL OF SUPPLY"}
        </Typography>
      </Box>

      <Box sx={{ mb: 0.7 }}>
        {[
          ["Bill No", invoice.invoice_number || "-"],
          ["Date", formatDate(invoice.bill_date)],
          ["Time", formatTime(invoice.bill_date)],
          ["Payment", invoice.payment_mode || "-"],
        ].map(([label, value]) => (
          <Stack
            key={label}
            direction="row"
            spacing={0.6}
            sx={{ fontSize: small }}
          >
            <Typography
              component="span"
              sx={{
                width: is58 ? 44 : 52,
                flexShrink: 0,
                fontSize: small,
                fontWeight: 800,
              }}
            >
              {label}:
            </Typography>
            <Typography
              component="span"
              sx={{
                fontSize: small,
                overflowWrap: "anywhere",
              }}
            >
              {value}
            </Typography>
          </Stack>
        ))}
      </Box>

      <Box
        sx={{
          borderTop: "1px solid #000",
          borderBottom: "1px solid #000",
          py: 0.45,
          mb: 0.6,
          textAlign: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: section,
            fontWeight: 900,
          }}
        >
          CUSTOMER DETAILS
        </Typography>
      </Box>

      <Box sx={{ mb: 0.7 }}>
        <Stack direction="row" spacing={0.6}>
          <Typography
            sx={{
              width: is58 ? 44 : 52,
              flexShrink: 0,
              fontSize: small,
              fontWeight: 800,
            }}
          >
            Name:
          </Typography>
          <Typography sx={{ fontSize: small }}>
            {customer.customer_name || "Walk-in Customer"}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.6}>
          <Typography
            sx={{
              width: is58 ? 44 : 52,
              flexShrink: 0,
              fontSize: small,
              fontWeight: 800,
            }}
          >
            Contact:
          </Typography>
          <Typography sx={{ fontSize: small }}>
            {customer.mobile || "-"}
          </Typography>
        </Stack>
      </Box>

      <Box
        sx={{
          borderTop: "1px solid #000",
          borderBottom: "1px solid #000",
          py: 0.38,
        }}
      >
        <Stack
          direction="row"
          sx={{
            fontSize: small,
            fontWeight: 900,
          }}
        >
          <Typography
            sx={{
              width: is58 ? "51%" : "55%",
              fontSize: small,
              fontWeight: 900,
            }}
          >
            Product
          </Typography>
          <Typography
            sx={{
              width: "12%",
              textAlign: "center",
              fontSize: small,
              fontWeight: 900,
            }}
          >
            Qty
          </Typography>
          <Typography
            sx={{
              width: "17%",
              textAlign: "right",
              fontSize: small,
              fontWeight: 900,
            }}
          >
            Rate
          </Typography>
          <Typography
            sx={{
              width: "20%",
              textAlign: "right",
              fontSize: small,
              fontWeight: 900,
            }}
          >
            Amount
          </Typography>
        </Stack>
      </Box>

      <Box>
        {items.map((item, index) => {
          const qty = Number(item.quantity || 0);
          const rate = Number(item.sale_price || item.rate || 0);
          const lineAmount = Number(
            item.amount || rate * qty
          );

          return (
            <Box
              key={item.id || `${item.item_name}-${index}`}
              sx={{
                py: 0.48,
                borderBottom:
                  index === items.length - 1
                    ? "none"
                    : "1px dashed #777",
              }}
            >
              <Stack direction="row">
                <Typography
                  sx={{
                    width: is58 ? "51%" : "55%",
                    pr: 0.4,
                    fontSize: is58 ? 10.4 : 11.2,
                    fontWeight: 900,
                    lineHeight: 1.12,
                    letterSpacing: "0.01em",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.item_name || "-"}
                </Typography>

                <Typography
                  sx={{
                    width: "12%",
                    textAlign: "center",
                    fontSize: font,
                  }}
                >
                  {qty}
                </Typography>

                <Typography
                  sx={{
                    width: "17%",
                    textAlign: "right",
                    fontSize: font,
                  }}
                >
                  {plainMoney(rate)}
                </Typography>

                <Typography
                  sx={{
                    width: "20%",
                    textAlign: "right",
                    fontSize: font,
                    fontWeight: 700,
                  }}
                >
                  {plainMoney(lineAmount)}
                </Typography>
              </Stack>

              <Typography
                sx={{
                  fontSize: small,
                  color: "#333",
                  mt: 0.12,
                  overflowWrap: "anywhere",
                }}
              >
                {[
                  showBarcode && item.barcode
                    ? `BC:${item.barcode}`
                    : "",
                  item.mrp
                    ? `MRP:${plainMoney(item.mrp)}`
                    : "",
                  showBatchExpiry && item.batch_number
                    ? `Batch:${item.batch_number}`
                    : "",
                  showBatchExpiry && item.expiry_date
                    ? `Exp:${String(item.expiry_date).slice(0, 10)}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" | ")}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Divider
        sx={{
          borderColor: "#000",
          borderStyle: "dashed",
          my: 0.7,
        }}
      />

      <Box sx={{ ml: "auto", width: is58 ? "86%" : "76%" }}>
        {[
          ["Items", items.length],
          showSavings && totalMrp > 0
            ? ["Total MRP", plainMoney(totalMrp)]
            : null,
          ["Subtotal", plainMoney(subtotal)],
          gstAmount > 0
            ? ["GST", plainMoney(gstAmount)]
            : null,
          discount > 0
            ? ["Bill Discount", `-${plainMoney(discount)}`]
            : null,
          ["Round Off", plainMoney(roundOff)],
        ]
          .filter(Boolean)
          .map(([label, value]) => (
            <Stack
              key={label}
              direction="row"
              justifyContent="space-between"
              spacing={1}
              sx={{ py: 0.18 }}
            >
              <Typography
                sx={{
                  fontSize: font,
                  fontWeight: label === "Items" ? 700 : 600,
                }}
              >
                {label}
              </Typography>
              <Typography
                sx={{
                  fontSize: font,
                  fontWeight: 700,
                }}
              >
                {value}
              </Typography>
            </Stack>
          ))}

        <Box
          sx={{
            borderTop: "1px solid #000",
            borderBottom: "1px solid #000",
            py: 0.5,
            mt: 0.35,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
          >
            <Typography
              sx={{
                fontSize: is58 ? 12 : 14,
                fontWeight: 900,
              }}
            >
              NET TOTAL
            </Typography>
            <Typography
              sx={{
                fontSize: is58 ? 12 : 14,
                fontWeight: 900,
              }}
            >
              ₹ {plainMoney(grandTotal)}
            </Typography>
          </Stack>
        </Box>
      </Box>

      {showSavings && (
        <Box
          sx={{
            textAlign: "center",
            py: 0.8,
          }}
        >
          <Typography
            sx={{
              fontSize: is58 ? 11 : 13,
              fontWeight: 900,
            }}
          >
            YOU SAVED
          </Typography>
          <Typography
            sx={{
              fontSize: is58 ? 13 : 15,
              fontWeight: 900,
            }}
          >
            ₹ {plainMoney(totalSaving)}
          </Typography>
        </Box>
      )}

      <Divider
        sx={{
          borderColor: "#000",
          borderStyle: "solid",
          mb: 0.55,
        }}
      />

      <Typography
        sx={{
          fontSize: small,
          fontWeight: 800,
          mb: 0.55,
        }}
      >
        Amount in words: {amountInWords(grandTotal)}
      </Typography>

      <Divider
        sx={{
          borderColor: "#000",
          borderStyle: "solid",
          mb: 0.55,
        }}
      />

      <Typography
        sx={{
          fontSize: small,
          fontWeight: 800,
        }}
      >
        Terms & Conditions
      </Typography>
      <Typography sx={{ fontSize: small }}>
        Goods once sold will be accepted for return only as per store policy.
      </Typography>

      {upiUrl && (
        <Stack
          alignItems="center"
          spacing={0.25}
          sx={{ mt: 1.1 }}
        >
          <Typography
            sx={{
              fontSize: section,
              fontWeight: 900,
            }}
          >
            SCAN TO PAY
          </Typography>

          <Box
            component="img"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(
              upiUrl
            )}`}
            alt="UPI Payment QR"
            sx={{
              width: qrSize,
              height: qrSize,
              objectFit: "contain",
            }}
          />

          <Typography
            sx={{
              fontSize: section,
              fontWeight: 900,
            }}
          >
            ₹ {plainMoney(amountToPay)}
          </Typography>

          {upiSettings.show_upi_id && (
            <Typography sx={{ fontSize: small }}>
              {upiSettings.upi_id}
            </Typography>
          )}
        </Stack>
      )}

      {invoice.payment_mode === "Cash" &&
        Number(invoice.amount_received || 0) > 0 && (
          <Box sx={{ mt: 0.75 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
            >
              <Typography sx={{ fontSize: small }}>
                Received
              </Typography>
              <Typography sx={{ fontSize: small }}>
                ₹ {plainMoney(invoice.amount_received)}
              </Typography>
            </Stack>
            <Stack
              direction="row"
              justifyContent="space-between"
            >
              <Typography
                sx={{
                  fontSize: small,
                  fontWeight: 800,
                }}
              >
                Change
              </Typography>
              <Typography
                sx={{
                  fontSize: small,
                  fontWeight: 800,
                }}
              >
                ₹ {plainMoney(invoice.change_return)}
              </Typography>
            </Stack>
          </Box>
        )}

      {showFooter && (
        <Box
          sx={{
            textAlign: "center",
            mt: 1,
            pt: 0.5,
            borderTop: "1px dashed #000",
          }}
        >
          <Typography
            sx={{
              fontSize: font,
              fontWeight: 900,
            }}
          >
            {printSettings.footer_message ||
              "Thank You - Visit Again!"}
          </Typography>
          <Typography sx={{ fontSize: small }}>
            Powered by Resolvent IT Services Pvt. Ltd.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function A4Invoice({
  business,
  invoice,
  customer,
  items,
  printSettings,
  businessLogo,
  upiSettings,
  preview = false,
}) {
  const showLogo = printSettings.show_logo !== false;
  const showBarcode = printSettings.show_barcode !== false;
  const showBatchExpiry = printSettings.show_batch_expiry !== false;
  const showSavings = printSettings.show_savings !== false;

  const subtotal = Number(invoice.subtotal || 0);
  const gstAmount = Number(invoice.gst_amount || 0);
  const discount = Number(invoice.discount || 0);
  const grandTotal = Number(invoice.total_amount || 0);
  const totalMrp = Number(invoice.total_mrp || 0);
  const totalSaving = Number(
    invoice.total_saving ||
      Math.max(totalMrp - subtotal, 0)
  );
  const paidAmount = Number(
    invoice.paid_amount ?? grandTotal
  );
  const balance = Number(
    invoice.balance ?? Math.max(grandTotal - paidAmount, 0)
  );

  const shouldShowQr =
    upiSettings.enabled &&
    printSettings.show_payment_qr !== false &&
    (invoice.payment_mode !== "Cash" ||
      upiSettings.show_for_cash);

  const amountToPay =
    balance > 0 ? balance : grandTotal;

  const upiUrl = shouldShowQr
    ? buildUpiPaymentUrl({
        settings: upiSettings,
        amount: amountToPay,
        invoiceNumber: invoice.invoice_number,
        customerName: customer.customer_name,
      })
    : "";

  return (
    <Box
      className={`${preview ? "invoice-preview-area" : "invoice-print-area"} invoice-a4`}
      sx={{
        bgcolor: "#fff",
        color: "#000",
        width: "100%",
        p: 3,
        fontFamily: '"Inter", Arial, sans-serif',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={2}
      >
        <Stack direction="row" spacing={2}>
          {showLogo && (
            <Box
              component="img"
              src={businessLogo}
              alt="Business Logo"
              sx={{
                width: Number(printSettings.logo_width || 90),
                height: Number(printSettings.logo_height || 60),
                objectFit: "contain",
              }}
            />
          )}

          <Box>
            <Typography variant="h5" fontWeight={900}>
              {business.business_name || "Business Name"}
            </Typography>
            <Typography variant="body2">
              {business.address || ""}
            </Typography>
            <Typography variant="body2">
              GSTIN: {business.gst_number || "-"}
            </Typography>
            <Typography variant="body2">
              {[business.mobile, business.email]
                .filter(Boolean)
                .join(" | ")}
            </Typography>
          </Box>
        </Stack>

        <Box textAlign="right">
          <Typography variant="h5" fontWeight={900}>
            {business.gst_number
              ? "TAX INVOICE"
              : "BILL OF SUPPLY"}
          </Typography>
          <Typography variant="body2">
            Invoice: {invoice.invoice_number || "-"}
          </Typography>
          <Typography variant="body2">
            Date: {formatDate(invoice.bill_date)}
          </Typography>
          <Typography variant="body2">
            Payment: {invoice.payment_mode || "-"}
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 2, borderColor: "#000" }} />

      <Box sx={{ mb: 2 }}>
        <Typography fontWeight={800}>Bill To</Typography>
        <Typography>
          {customer.customer_name || "Walk-in Customer"}
        </Typography>
        <Typography variant="body2">
          Mobile: {customer.mobile || "-"}
        </Typography>
      </Box>

      <Table
        size="small"
        sx={{
          border: "1px solid #000",
          "& th, & td": {
            border: "1px solid #000",
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Item</TableCell>
            {showBarcode && <TableCell>Barcode</TableCell>}
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">MRP</TableCell>
            <TableCell align="right">Rate</TableCell>
            <TableCell align="right">GST</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, index) => (
            <TableRow
              key={item.id || `${item.item_name}-${index}`}
            >
              <TableCell>
                <Typography fontWeight={700}>
                  {item.item_name}
                </Typography>
                {showBatchExpiry &&
                  (item.batch_number || item.expiry_date) && (
                    <Typography variant="caption">
                      {[
                        item.batch_number
                          ? `Batch ${item.batch_number}`
                          : "",
                        item.expiry_date
                          ? `Exp ${String(item.expiry_date).slice(0, 10)}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" | ")}
                    </Typography>
                  )}
              </TableCell>
              {showBarcode && (
                <TableCell>{item.barcode || "-"}</TableCell>
              )}
              <TableCell align="right">
                {Number(item.quantity || 0)}
              </TableCell>
              <TableCell align="right">
                {money(item.mrp || item.sale_price || 0)}
              </TableCell>
              <TableCell align="right">
                {money(item.sale_price || item.rate || 0)}
              </TableCell>
              <TableCell align="right">
                {Number(item.gst_percent || 0).toFixed(2)}%
              </TableCell>
              <TableCell align="right">
                {money(item.amount || 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box
        sx={{
          width: 340,
          ml: "auto",
          mt: 2,
        }}
      >
        {showSavings && totalMrp > 0 && (
          <Stack
            direction="row"
            justifyContent="space-between"
          >
            <Typography>Total MRP</Typography>
            <Typography>{money(totalMrp)}</Typography>
          </Stack>
        )}

        <Stack
          direction="row"
          justifyContent="space-between"
        >
          <Typography>Subtotal</Typography>
          <Typography>{money(subtotal)}</Typography>
        </Stack>

        <Stack
          direction="row"
          justifyContent="space-between"
        >
          <Typography>GST</Typography>
          <Typography>{money(gstAmount)}</Typography>
        </Stack>

        {discount > 0 && (
          <Stack
            direction="row"
            justifyContent="space-between"
          >
            <Typography>Discount</Typography>
            <Typography>-{money(discount)}</Typography>
          </Stack>
        )}

        {showSavings && totalSaving > 0 && (
          <Stack
            direction="row"
            justifyContent="space-between"
          >
            <Typography fontWeight={800}>
              You Saved
            </Typography>
            <Typography fontWeight={800}>
              {money(totalSaving)}
            </Typography>
          </Stack>
        )}

        <Divider sx={{ my: 1, borderColor: "#000" }} />

        <Stack
          direction="row"
          justifyContent="space-between"
        >
          <Typography variant="h6" fontWeight={900}>
            Grand Total
          </Typography>
          <Typography variant="h6" fontWeight={900}>
            {money(grandTotal)}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          justifyContent="space-between"
        >
          <Typography>Paid</Typography>
          <Typography>{money(paidAmount)}</Typography>
        </Stack>

        <Stack
          direction="row"
          justifyContent="space-between"
        >
          <Typography>Balance</Typography>
          <Typography>{money(balance)}</Typography>
        </Stack>
      </Box>

      <Typography
        sx={{
          mt: 2,
          fontWeight: 700,
        }}
      >
        Amount in words: {amountInWords(grandTotal)}
      </Typography>

      {upiUrl && (
        <Stack
          alignItems="center"
          spacing={0.5}
          sx={{ mt: 2 }}
        >
          <Typography fontWeight={900}>
            Scan to Pay
          </Typography>
          <Box
            component="img"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=145x145&data=${encodeURIComponent(
              upiUrl
            )}`}
            alt="UPI Payment QR"
            sx={{ width: 145, height: 145 }}
          />
          <Typography fontWeight={900}>
            {money(amountToPay)}
          </Typography>
        </Stack>
      )}

      <Box textAlign="center" mt={3}>
        <Typography fontWeight={800}>
          {printSettings.footer_message ||
            "Thank you for your business. Visit again."}
        </Typography>
        <Typography variant="caption">
          Powered by Resolvent IT Services Pvt. Ltd.
        </Typography>
      </Box>
    </Box>
  );
}

export default function InvoicePrint({
  business = {},
  invoice = {},
  customer = {},
  items = [],
  printSettings = {},
  preview = false,
  businessLogoOverride = "",
  upiSettingsOverride = null,
}) {
  const layout = printSettings.layout || "a4";

  const businessLogo =
    businessLogoOverride ||
    (typeof window !== "undefined"
      ? localStorage.getItem("billing_business_logo") ||
        "/resolvent-logo.jpg"
      : "/resolvent-logo.jpg");

  const upiSettings =
    upiSettingsOverride || getUpiSettings();

  if (layout === "thermal") {
    return (
      <ThermalInvoice
        business={business}
        invoice={invoice}
        customer={customer}
        items={items}
        printSettings={printSettings}
        businessLogo={businessLogo}
        upiSettings={upiSettings}
        preview={preview}
      />
    );
  }

  return (
    <A4Invoice
      business={business}
      invoice={invoice}
      customer={customer}
      items={items}
      printSettings={printSettings}
      businessLogo={businessLogo}
      upiSettings={upiSettings}
      preview={preview}
    />
  );
}
