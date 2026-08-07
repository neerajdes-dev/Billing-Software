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

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const THEME_MAP = {
  classic: {
    fontFamily: '"Times New Roman", serif',
    tableBorder: "1px solid #000",
    headerBackground: "#fff",
    totalBackground: "#fff",
  },
  professional: {
    fontFamily: '"Inter", Arial, sans-serif',
    tableBorder: "1px solid #64748B",
    headerBackground: "#F8FAFC",
    totalBackground: "#F1F5F9",
  },
  modern: {
    fontFamily: '"Inter", Arial, sans-serif',
    tableBorder: "1px solid #CBD5E1",
    headerBackground: "#EEF2FF",
    totalBackground: "#EEF2FF",
  },
  minimal: {
    fontFamily: '"Inter", Arial, sans-serif',
    tableBorder: "none",
    headerBackground: "#fff",
    totalBackground: "#fff",
  },
  retail: {
    fontFamily: '"Arial Narrow", Arial, sans-serif',
    tableBorder: "1px dashed #64748B",
    headerBackground: "#FFFBEB",
    totalBackground: "#FEF3C7",
  },
};

const TEXT_SCALE = {
  small: 0.86,
  medium: 1,
  large: 1.14,
};

function InvoicePrint({
  business = {},
  invoice = {},
  customer = {},
  items = [],
  printSettings = {},
}) {
  const layout = printSettings.layout || "a4";
  const thermalSize = printSettings.thermal_size || "80mm";
  const isThermal = layout === "thermal";

  const theme =
    THEME_MAP[printSettings.invoice_theme] ||
    THEME_MAP.professional;
  const scale =
    TEXT_SCALE[printSettings.invoice_text_size] || 1;

  const headerAlignment =
    printSettings.header_alignment || "left";
  const logoPosition =
    printSettings.logo_position || "left";

  const showLogo = printSettings.show_logo !== false;
  const showBarcode = printSettings.show_barcode !== false;
  const showBatchExpiry =
    printSettings.show_batch_expiry !== false;
  const showSavings = printSettings.show_savings !== false;
  const showCustomer =
    printSettings.show_customer_details !== false;
  const showBusiness =
    printSettings.show_business_details !== false;
  const showFooter = printSettings.show_footer !== false;

  const footerMessage =
    printSettings.footer_message ||
    "Thank you for your business. Visit again.";

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

  const businessLogo =
    typeof window !== "undefined"
      ? localStorage.getItem("billing_business_logo") ||
        "/resolvent-logo.jpg"
      : "/resolvent-logo.jpg";

  const upiSettings =
    typeof window !== "undefined"
      ? {
          ...DEFAULT_UPI_SETTINGS,
          ...(JSON.parse(
            localStorage.getItem("billing_upi_settings") || "{}"
          ) || {}),
        }
      : DEFAULT_UPI_SETTINGS;

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

  const logoWidth = isThermal
    ? Math.min(Number(printSettings.logo_width || 90), 100)
    : Number(printSettings.logo_width || 90);

  const logoHeight = isThermal
    ? Math.min(Number(printSettings.logo_height || 60), 72)
    : Number(printSettings.logo_height || 60);

  const logo = showLogo ? (
    <Box
      component="img"
      src={businessLogo}
      alt="Business Logo"
      sx={{
        width: logoWidth,
        height: logoHeight,
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  ) : null;

  const businessBlock = (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        textAlign: headerAlignment,
      }}
    >
      <Typography
        sx={{
          fontSize: (isThermal ? 16 : 25) * scale,
          fontWeight: 900,
          lineHeight: 1.15,
        }}
      >
        {business.business_name || "Business Name"}
      </Typography>

      {showBusiness && (
        <>
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            {business.address || ""}
          </Typography>

          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            GSTIN: {business.gst_number || "-"}
          </Typography>

          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            {business.mobile || ""}
            {business.email ? ` | ${business.email}` : ""}
          </Typography>
        </>
      )}
    </Box>
  );

  const invoiceMeta = !isThermal ? (
    <Box
      sx={{
        textAlign:
          headerAlignment === "left"
            ? "right"
            : headerAlignment,
        minWidth: 165,
      }}
    >
      <Typography sx={{ fontSize: 21 * scale, fontWeight: 900 }}>
        TAX INVOICE
      </Typography>
      <Typography sx={{ fontSize: 12 * scale }}>
        Invoice: {invoice.invoice_number || "-"}
      </Typography>
      <Typography sx={{ fontSize: 12 * scale }}>
        Date: {formatDateTime(invoice.bill_date)}
      </Typography>
      <Typography sx={{ fontSize: 12 * scale }}>
        Payment: {invoice.payment_mode || "-"}
      </Typography>
    </Box>
  ) : null;

  const header = (() => {
    if (logoPosition === "center") {
      return (
        <Stack spacing={1} sx={{ width: "100%" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
            }}
          >
            {logo}
          </Box>

          <Box
            sx={{
              display: isThermal ? "block" : "flex",
              justifyContent:
                headerAlignment === "right"
                  ? "flex-end"
                  : headerAlignment === "center"
                  ? "center"
                  : "space-between",
              gap: 2,
            }}
          >
            {businessBlock}
            {invoiceMeta}
          </Box>
        </Stack>
      );
    }

    return (
      <Stack
        direction={isThermal ? "column" : "row"}
        spacing={isThermal ? 0.75 : 2}
        alignItems={isThermal ? "center" : "center"}
        sx={{
          width: "100%",
          flexDirection:
            !isThermal && logoPosition === "right"
              ? "row-reverse"
              : isThermal
              ? "column"
              : "row",
        }}
      >
        {logo}
        {businessBlock}
        {invoiceMeta}
      </Stack>
    );
  })();

  const qrSize = isThermal
    ? Math.min(Number(upiSettings.qr_size || 150), 135)
    : Number(upiSettings.qr_size || 150);

  const qrBlock = upiUrl ? (
    <Stack
      alignItems="center"
      spacing={0.5}
      sx={{ mt: isThermal ? 1.5 : 2.5 }}
    >
      <Typography
        sx={{
          fontSize: (isThermal ? 10 : 12) * scale,
          fontWeight: 900,
        }}
      >
        Scan to Pay
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
          bgcolor: "#fff",
          p: 0.5,
        }}
      />

      <Typography
        sx={{
          fontSize: (isThermal ? 10 : 12) * scale,
          fontWeight: 900,
        }}
      >
        {money(amountToPay)}
      </Typography>

      {upiSettings.show_upi_id && (
        <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
          {upiSettings.upi_id}
        </Typography>
      )}
    </Stack>
  ) : null;

  return (
    <Box
      className={`invoice-print-area ${
        isThermal ? "invoice-thermal" : "invoice-a4"
      }`}
      data-thermal-size={thermalSize}
      sx={{
        backgroundColor: "#ffffff",
        color: "#000000",
        width: "100%",
        p: isThermal ? 1.25 : 3,
        fontFamily: theme.fontFamily,
      }}
    >
      {header}

      <Divider
        sx={{
          my: isThermal ? 0.75 : 2,
          borderStyle:
            printSettings.invoice_theme === "retail" ||
            isThermal
              ? "dashed"
              : "solid",
          borderColor: "#000",
        }}
      />

      {isThermal && (
        <Box sx={{ textAlign: headerAlignment, mb: 1 }}>
          <Typography sx={{ fontSize: 10 * scale }}>
            Invoice: {invoice.invoice_number || "-"}
          </Typography>
          <Typography sx={{ fontSize: 10 * scale }}>
            Date: {formatDateTime(invoice.bill_date)}
          </Typography>
          <Typography sx={{ fontSize: 10 * scale }}>
            Payment: {invoice.payment_mode || "-"}
          </Typography>
        </Box>
      )}

      {showCustomer && (
        <Box sx={{ mb: isThermal ? 1 : 2 }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: (isThermal ? 10 : 13) * scale,
            }}
          >
            Bill To
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 10 : 13) * scale }}>
            {customer.customer_name || "Walk-in Customer"}
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            Mobile: {customer.mobile || "-"}
          </Typography>
        </Box>
      )}

      <Table
        size="small"
        sx={{
          tableLayout: "fixed",
          border:
            isThermal ||
            printSettings.invoice_theme === "minimal"
              ? "none"
              : theme.tableBorder,
          "& th, & td": {
            border:
              isThermal ||
              printSettings.invoice_theme === "minimal"
                ? "none"
                : theme.tableBorder,
            px: isThermal ? 0.25 : 1,
            py: isThermal ? 0.35 : 0.75,
            fontSize: (isThermal ? 9 : 11) * scale,
            lineHeight: 1.15,
          },
          "& thead th": {
            fontWeight: 900,
            bgcolor: theme.headerBackground,
            borderBottom: isThermal
              ? "1px dashed #000"
              : theme.tableBorder,
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: isThermal ? "43%" : "28%" }}>
              Item
            </TableCell>
            {!isThermal && showBarcode && (
              <TableCell sx={{ width: "16%" }}>
                Barcode
              </TableCell>
            )}
            <TableCell align="right" sx={{ width: "8%" }}>
              Qty
            </TableCell>
            <TableCell align="right" sx={{ width: "13%" }}>
              MRP
            </TableCell>
            <TableCell align="right" sx={{ width: "13%" }}>
              Rate
            </TableCell>
            {!isThermal && (
              <TableCell align="right" sx={{ width: "9%" }}>
                GST
              </TableCell>
            )}
            <TableCell align="right" sx={{ width: "17%" }}>
              Amount
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {items.map((item, index) => (
            <TableRow key={item.id || `${item.item_name}-${index}`}>
              <TableCell>
                <Typography
                  component="div"
                  sx={{
                    fontSize: (isThermal ? 9 : 11) * scale,
                    fontWeight: 700,
                  }}
                >
                  {item.item_name || "-"}
                </Typography>

                {isThermal && showBarcode && item.barcode && (
                  <Typography sx={{ fontSize: 8 * scale }}>
                    {item.barcode}
                  </Typography>
                )}

                {showBatchExpiry &&
                  (item.batch_number || item.expiry_date) && (
                    <Typography sx={{ fontSize: (isThermal ? 8 : 9) * scale }}>
                      {item.batch_number
                        ? `Batch: ${item.batch_number}`
                        : ""}
                      {item.batch_number && item.expiry_date
                        ? " | "
                        : ""}
                      {item.expiry_date
                        ? `Exp: ${String(item.expiry_date).slice(0, 10)}`
                        : ""}
                    </Typography>
                  )}
              </TableCell>

              {!isThermal && showBarcode && (
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

              {!isThermal && (
                <TableCell align="right">
                  {Number(item.gst_percent || 0).toFixed(2)}%
                </TableCell>
              )}

              <TableCell align="right">
                {money(item.amount || 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box
        sx={{
          width: isThermal ? "100%" : 330,
          ml: isThermal ? 0 : "auto",
          mt: 1.5,
          p:
            printSettings.invoice_theme === "minimal"
              ? 0
              : 1.25,
          bgcolor:
            printSettings.invoice_theme === "minimal"
              ? "transparent"
              : theme.totalBackground,
        }}
      >
        {showSavings && totalMrp > 0 && (
          <>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
                Total MRP
              </Typography>
              <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
                {money(totalMrp)}
              </Typography>
            </Stack>

            {totalSaving > 0 && (
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale, fontWeight: 800 }}>
                  You Saved
                </Typography>
                <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale, fontWeight: 800 }}>
                  {money(totalSaving)}
                </Typography>
              </Stack>
            )}
          </>
        )}

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            Subtotal
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            {money(subtotal)}
          </Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            GST
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            {money(gstAmount)}
          </Typography>
        </Stack>

        {discount > 0 && (
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
              Discount
            </Typography>
            <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
              -{money(discount)}
            </Typography>
          </Stack>
        )}

        <Divider sx={{ my: 0.75, borderColor: "#000" }} />

        <Stack direction="row" justifyContent="space-between">
          <Typography
            sx={{
              fontSize: (isThermal ? 13 : 17) * scale,
              fontWeight: 900,
            }}
          >
            Grand Total
          </Typography>
          <Typography
            sx={{
              fontSize: (isThermal ? 13 : 17) * scale,
              fontWeight: 900,
            }}
          >
            {money(grandTotal)}
          </Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            Paid
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            {money(paidAmount)}
          </Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            Balance
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 10 : 12) * scale }}>
            {money(balance)}
          </Typography>
        </Stack>
      </Box>

      {upiSettings.qr_position === "below_total" && qrBlock}

      {showFooter && (
        <Box textAlign="center" mt={isThermal ? 1.5 : 4}>
          <Typography
            sx={{
              fontSize: (isThermal ? 10 : 13) * scale,
              fontWeight: 800,
            }}
          >
            {footerMessage}
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
            Powered by Resolvent IT Services Pvt. Ltd.
          </Typography>
        </Box>
      )}

      {upiSettings.qr_position === "footer" && qrBlock}
    </Box>
  );
}

export default InvoicePrint;
