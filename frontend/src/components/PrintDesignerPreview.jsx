import {
  Box,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import { buildUpiPaymentUrl } from "../utils/upi";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const alignMap = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

export default function PrintDesignerPreview({
  business,
  businessLogo,
  printSettings,
  upiSettings,
}) {
  const isThermal = printSettings.layout === "thermal";
  const previewAmount = 580;
  const upiUrl = buildUpiPaymentUrl({
    settings: upiSettings,
    amount: previewAmount,
    invoiceNumber: "INV-2026-0012",
    customerName: "Sample Customer",
  });

  const showQr =
    upiSettings.enabled &&
    upiUrl &&
    printSettings.show_payment_qr !== false;

  const qrBlock = showQr ? (
    <Stack
      alignItems="center"
      spacing={0.5}
      sx={{ my: 1.25 }}
    >
      <Typography sx={{ fontSize: isThermal ? 9 : 11, fontWeight: 800 }}>
        Scan to Pay
      </Typography>
      <QRCodeSVG
        value={upiUrl}
        size={isThermal ? 90 : 125}
        level="M"
        includeMargin
      />
      <Typography sx={{ fontSize: isThermal ? 9 : 11, fontWeight: 800 }}>
        {money(previewAmount)}
      </Typography>
      {upiSettings.show_upi_id && (
        <Typography sx={{ fontSize: isThermal ? 7 : 9 }}>
          {upiSettings.upi_id}
        </Typography>
      )}
    </Stack>
  ) : null;

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: isThermal ? 310 : 520,
        mx: "auto",
        bgcolor: "#fff",
        color: "#111827",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: isThermal ? 1.5 : 2.5,
        boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
        fontFamily:
          printSettings.invoice_text_size === "small"
            ? "Arial, sans-serif"
            : printSettings.invoice_text_size === "large"
            ? "Georgia, serif"
            : "Inter, Arial, sans-serif",
      }}
    >
      <Stack
        direction={isThermal ? "column" : "row"}
        spacing={1.5}
        alignItems={
          isThermal
            ? "center"
            : alignMap[printSettings.header_alignment] || "flex-start"
        }
        justifyContent={
          isThermal
            ? "center"
            : printSettings.header_alignment === "right"
            ? "flex-end"
            : printSettings.header_alignment === "center"
            ? "center"
            : "flex-start"
        }
        textAlign={
          isThermal
            ? "center"
            : printSettings.header_alignment || "left"
        }
      >
        {printSettings.show_logo && (
          <Box
            component="img"
            src={businessLogo}
            alt="Business Logo"
            sx={{
              width: Math.min(Number(printSettings.logo_width || 90), 120),
              height: Math.min(Number(printSettings.logo_height || 60), 80),
              objectFit: "contain",
              order:
                printSettings.logo_position === "right" ? 2 : 0,
            }}
          />
        )}

        <Box>
          <Typography
            sx={{
              fontSize: isThermal ? 14 : 20,
              fontWeight: 900,
              lineHeight: 1.15,
            }}
          >
            {business.business_name || "Your Business Name"}
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 8 : 10 }}>
            {business.address || "Business address"}
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 8 : 10 }}>
            GSTIN: {business.gst_number || "Not configured"}
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 1.25 }} />

      <Stack
        direction="row"
        justifyContent="space-between"
        sx={{ fontSize: isThermal ? 8 : 10 }}
      >
        <Box>
          <Typography sx={{ fontSize: "inherit", fontWeight: 800 }}>
            Invoice INV-2026-0012
          </Typography>
          <Typography sx={{ fontSize: "inherit" }}>
            Customer: Sample Customer
          </Typography>
        </Box>
        <Box textAlign="right">
          <Typography sx={{ fontSize: "inherit" }}>06-08-2026</Typography>
          <Typography sx={{ fontSize: "inherit" }}>UPI</Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 1.25 }} />

      {[
        ["Sample Product", "2", "₹140", "₹280"],
        ["Another Product", "1", "₹300", "₹300"],
      ].map(([name, qty, rate, amount]) => (
        <Box key={name} sx={{ mb: 0.75 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontSize: isThermal ? 8 : 10, fontWeight: 700 }}>
              {name}
            </Typography>
            <Typography sx={{ fontSize: isThermal ? 8 : 10 }}>
              {amount}
            </Typography>
          </Stack>
          <Typography sx={{ fontSize: isThermal ? 7 : 9 }}>
            {qty} × {rate}
            {printSettings.show_batch_expiry
              ? " · Batch B-001 · Exp 12/2027"
              : ""}
          </Typography>
        </Box>
      ))}

      <Divider sx={{ my: 1.25 }} />

      <Stack spacing={0.35}>
        {printSettings.show_savings && (
          <>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: isThermal ? 8 : 10 }}>
                Total MRP
              </Typography>
              <Typography sx={{ fontSize: isThermal ? 8 : 10 }}>
                ₹620.00
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: isThermal ? 8 : 10 }}>
                You Saved
              </Typography>
              <Typography sx={{ fontSize: isThermal ? 8 : 10 }}>
                ₹40.00
              </Typography>
            </Stack>
          </>
        )}

        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontSize: isThermal ? 11 : 14, fontWeight: 900 }}>
            Grand Total
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 11 : 14, fontWeight: 900 }}>
            ₹580.00
          </Typography>
        </Stack>
      </Stack>

      {upiSettings.qr_position === "below_total" && qrBlock}

      {printSettings.show_footer !== false && (
        <Box textAlign="center" mt={1.5}>
          <Typography sx={{ fontSize: isThermal ? 8 : 10, fontWeight: 800 }}>
            {printSettings.footer_message ||
              "Thank you for your business. Visit again."}
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 7 : 8 }}>
            Powered by Resolvent IT Services Pvt. Ltd.
          </Typography>
        </Box>
      )}

      {upiSettings.qr_position === "footer" && qrBlock}
    </Box>
  );
}
