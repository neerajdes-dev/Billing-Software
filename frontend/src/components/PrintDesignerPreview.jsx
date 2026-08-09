import { Box, Typography } from "@mui/material";
import InvoicePrint from "./InvoicePrint";

export default function PrintDesignerPreview({
  business,
  businessLogo,
  printSettings,
  upiSettings,
}) {
  const sampleInvoice = {
    invoice_number: "INV-2026-0012",
    bill_date: "2026-08-06T12:14:00",
    payment_mode: "UPI",
    subtotal: 580,
    gst_amount: 0,
    discount: 0,
    total_mrp: 620,
    total_saving: 40,
    total_amount: 580,
    paid_amount: 580,
    balance: 0,
    amount_received: 580,
    change_return: 0,
    round_off: 0,
  };

  const sampleCustomer = {
    customer_name: "Sample Customer",
    mobile: "9876543210",
  };

  const sampleItems = [
    {
      id: 1,
      item_name: "Sample Product",
      barcode: "200000000001",
      batch_number: "B-001",
      expiry_date: "2027-12-01",
      quantity: 2,
      mrp: 160,
      sale_price: 140,
      rate: 140,
      gst_percent: 0,
      amount: 280,
    },
    {
      id: 2,
      item_name: "Another Product",
      barcode: "200000000002",
      batch_number: "B-002",
      expiry_date: "2027-12-01",
      quantity: 1,
      mrp: 300,
      sale_price: 300,
      rate: 300,
      gst_percent: 0,
      amount: 300,
    },
  ];

  const isThermal =
    printSettings.layout === "thermal";

  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mb: 1 }}
      >
        Preview uses the same receipt renderer as printing.
      </Typography>

      <Box
        sx={{
          width: "100%",
          overflow: "auto",
          bgcolor: "#eef2f7",
          borderRadius: 2,
          p: 2,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          maxHeight: 720,
        }}
      >
        <Box
          sx={{
            bgcolor: "#fff",
            boxShadow:
              "0 8px 28px rgba(15,23,42,.14)",
            width: isThermal
              ? "fit-content"
              : "100%",
            maxWidth: "100%",
          }}
        >
          <InvoicePrint
            business={business}
            invoice={sampleInvoice}
            customer={sampleCustomer}
            items={sampleItems}
            printSettings={printSettings}
            preview
            businessLogoOverride={businessLogo}
            upiSettingsOverride={upiSettings}
          />
        </Box>
      </Box>
    </Box>
  );
}
