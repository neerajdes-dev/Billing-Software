import {
  Box,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { buildUpiPaymentUrl } from "../utils/upi";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const THEME_MAP = {
  classic: {
    borderRadius: 0,
    borderWidth: 1,
    headerWeight: 800,
    sectionBorder: "1px solid #111827",
    softBackground: "#ffffff",
    totalBackground: "#ffffff",
  },
  professional: {
    borderRadius: 2,
    borderWidth: 1,
    headerWeight: 900,
    sectionBorder: "1px solid #CBD5E1",
    softBackground: "#F8FAFC",
    totalBackground: "#F1F5F9",
  },
  modern: {
    borderRadius: 3,
    borderWidth: 1,
    headerWeight: 900,
    sectionBorder: "1px solid #E2E8F0",
    softBackground: "#F8FAFC",
    totalBackground: "#EEF2FF",
  },
  minimal: {
    borderRadius: 0,
    borderWidth: 0,
    headerWeight: 700,
    sectionBorder: "1px solid #E5E7EB",
    softBackground: "#ffffff",
    totalBackground: "#ffffff",
  },
  retail: {
    borderRadius: 1.5,
    borderWidth: 1,
    headerWeight: 900,
    sectionBorder: "1px dashed #94A3B8",
    softBackground: "#FFFBEB",
    totalBackground: "#FEF3C7",
  },
};

const TEXT_SCALE = {
  small: 0.86,
  medium: 1,
  large: 1.14,
};

const alignValue = (value) => {
  if (value === "center") return "center";
  if (value === "right") return "flex-end";
  return "flex-start";
};

function LogoBlock({
  businessLogo,
  printSettings,
  isThermal,
}) {
  if (!printSettings.show_logo) return null;

  const width = isThermal
    ? Math.min(Number(printSettings.logo_width || 90), 100)
    : Number(printSettings.logo_width || 90);

  const height = isThermal
    ? Math.min(Number(printSettings.logo_height || 60), 72)
    : Number(printSettings.logo_height || 60);

  return (
    <Box
      component="img"
      src={businessLogo}
      alt="Business Logo"
      sx={{
        width,
        height,
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  );
}

export default function PrintDesignerPreview({
  business,
  businessLogo,
  printSettings,
  upiSettings,
}) {
  const isThermal = printSettings.layout === "thermal";
  const previewAmount = 580;
  const theme =
    THEME_MAP[printSettings.invoice_theme] ||
    THEME_MAP.professional;
  const scale =
    TEXT_SCALE[printSettings.invoice_text_size] || 1;

  const headerAlignment =
    printSettings.header_alignment || "left";
  const logoPosition =
    printSettings.logo_position || "left";

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

  const qrSize = Math.min(
    Number(upiSettings.qr_size || 150),
    isThermal ? 105 : 125
  );

  const qrBlock = showQr ? (
    <Stack alignItems="center" spacing={0.5} sx={{ my: 1.25 }}>
      <Typography sx={{ fontSize: 10 * scale, fontWeight: 800 }}>
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
      <Typography sx={{ fontSize: 10 * scale, fontWeight: 800 }}>
        {money(previewAmount)}
      </Typography>
      {upiSettings.show_upi_id && (
        <Typography sx={{ fontSize: 8 * scale }}>
          {upiSettings.upi_id}
        </Typography>
      )}
    </Stack>
  ) : null;

  const businessBlock = (
    <Box
      sx={{
        textAlign: headerAlignment,
        minWidth: 0,
        flex: 1,
      }}
    >
      <Typography
        sx={{
          fontSize: (isThermal ? 14 : 20) * scale,
          fontWeight: theme.headerWeight,
          lineHeight: 1.15,
        }}
      >
        {business.business_name || "Your Business Name"}
      </Typography>

      {printSettings.show_business_details !== false && (
        <>
          <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
            {business.address || "Business address"}
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
            GSTIN: {business.gst_number || "Not configured"}
          </Typography>
        </>
      )}
    </Box>
  );

  const header = (() => {
    if (logoPosition === "center") {
      return (
        <Stack
          spacing={0.75}
          alignItems={alignValue(headerAlignment)}
          sx={{ width: "100%" }}
        >
          <Box
            sx={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <LogoBlock
              businessLogo={businessLogo}
              printSettings={printSettings}
              isThermal={isThermal}
            />
          </Box>
          {businessBlock}
        </Stack>
      );
    }

    return (
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{
          width: "100%",
          flexDirection:
            logoPosition === "right" ? "row-reverse" : "row",
          justifyContent:
            headerAlignment === "center"
              ? "center"
              : headerAlignment === "right"
              ? "flex-end"
              : "flex-start",
        }}
      >
        <LogoBlock
          businessLogo={businessLogo}
          printSettings={printSettings}
          isThermal={isThermal}
        />
        {businessBlock}
      </Stack>
    );
  })();

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: isThermal ? 310 : 520,
        mx: "auto",
        bgcolor: "#fff",
        color: "#111827",
        border: `${theme.borderWidth}px solid #D8DEE8`,
        borderRadius: theme.borderRadius,
        p: isThermal ? 1.5 : 2.5,
        boxShadow:
          printSettings.invoice_theme === "minimal"
            ? "none"
            : "0 12px 32px rgba(15,23,42,0.08)",
        fontFamily:
          printSettings.invoice_theme === "classic"
            ? '"Times New Roman", serif'
            : printSettings.invoice_theme === "retail"
            ? '"Arial Narrow", Arial, sans-serif'
            : "Inter, Arial, sans-serif",
        transition: "all .2s ease",
      }}
    >
      {header}

      <Divider sx={{ my: 1.25 }} />

      <Stack
        direction="row"
        justifyContent="space-between"
        sx={{
          p:
            printSettings.invoice_theme === "modern"
              ? 1
              : 0,
          bgcolor:
            printSettings.invoice_theme === "modern"
              ? theme.softBackground
              : "transparent",
          borderRadius: 1.5,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: (isThermal ? 8 : 10) * scale,
              fontWeight: 800,
            }}
          >
            Invoice INV-2026-0012
          </Typography>

          {printSettings.show_customer_details !== false && (
            <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
              Customer: Sample Customer
            </Typography>
          )}
        </Box>

        <Box textAlign="right">
          <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
            06-08-2026
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
            UPI
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 1.25 }} />

      <Box
        sx={{
          border:
            printSettings.invoice_theme === "minimal"
              ? "none"
              : theme.sectionBorder,
          borderRadius:
            printSettings.invoice_theme === "modern" ? 1.5 : 0,
          overflow: "hidden",
        }}
      >
        {[
          ["Sample Product", "2", "₹140", "₹280"],
          ["Another Product", "1", "₹300", "₹300"],
        ].map(([name, qty, rate, amount], index) => (
          <Box
            key={name}
            sx={{
              p: isThermal ? 0.5 : 0.75,
              bgcolor:
                index % 2 === 1 &&
                printSettings.invoice_theme === "professional"
                  ? theme.softBackground
                  : "#fff",
              borderBottom:
                index === 0
                  ? theme.sectionBorder
                  : "none",
            }}
          >
            <Stack direction="row" justifyContent="space-between">
              <Typography
                sx={{
                  fontSize: (isThermal ? 8 : 10) * scale,
                  fontWeight: 700,
                }}
              >
                {name}
              </Typography>
              <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
                {amount}
              </Typography>
            </Stack>

            <Typography sx={{ fontSize: (isThermal ? 7 : 9) * scale }}>
              {qty} × {rate}
              {printSettings.show_barcode ? " · 8901234567890" : ""}
              {printSettings.show_batch_expiry
                ? " · Batch B-001 · Exp 12/2027"
                : ""}
            </Typography>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1.25 }} />

      <Box
        sx={{
          p:
            printSettings.invoice_theme === "minimal"
              ? 0
              : 1,
          bgcolor:
            printSettings.invoice_theme === "minimal"
              ? "transparent"
              : theme.totalBackground,
          borderRadius: 1.5,
        }}
      >
        {printSettings.show_savings && (
          <>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
                Total MRP
              </Typography>
              <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
                ₹620.00
              </Typography>
            </Stack>

            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
                You Saved
              </Typography>
              <Typography sx={{ fontSize: (isThermal ? 8 : 10) * scale }}>
                ₹40.00
              </Typography>
            </Stack>
          </>
        )}

        <Stack direction="row" justifyContent="space-between">
          <Typography
            sx={{
              fontSize: (isThermal ? 11 : 14) * scale,
              fontWeight: 900,
            }}
          >
            Grand Total
          </Typography>
          <Typography
            sx={{
              fontSize: (isThermal ? 11 : 14) * scale,
              fontWeight: 900,
            }}
          >
            ₹580.00
          </Typography>
        </Stack>
      </Box>

      {upiSettings.qr_position === "below_total" && qrBlock}

      {printSettings.show_footer !== false && (
        <Box textAlign="center" mt={1.5}>
          <Typography
            sx={{
              fontSize: (isThermal ? 8 : 10) * scale,
              fontWeight: 800,
            }}
          >
            {printSettings.footer_message ||
              "Thank you for your business. Visit again."}
          </Typography>
          <Typography sx={{ fontSize: (isThermal ? 7 : 8) * scale }}>
            Powered by Resolvent IT Services Pvt. Ltd.
          </Typography>
        </Box>
      )}

      {upiSettings.qr_position === "footer" && qrBlock}
    </Box>
  );
}
