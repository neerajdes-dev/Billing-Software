import {
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

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

function InvoicePrint({
  business = {},
  invoice = {},
  customer = {},
  items = [],
  printSettings = {},
}) {
  const layout = printSettings.layout || "a4";
  const thermalSize = printSettings.thermal_size || "80mm";
  const showLogo = printSettings.show_logo !== false;
  const showBarcode = printSettings.show_barcode !== false;
  const showBatchExpiry = printSettings.show_batch_expiry !== false;
  const showSavings = printSettings.show_savings !== false;
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

  const isThermal = layout === "thermal";

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
        fontFamily: isThermal
          ? '"Courier New", monospace'
          : '"Inter", Arial, sans-serif',
      }}
    >
      <Box
        sx={{
          display: isThermal ? "block" : "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 2,
          mb: isThermal ? 1 : 2,
          textAlign: isThermal ? "center" : "left",
        }}
      >
        <Box
          sx={{
            display: isThermal ? "block" : "flex",
            gap: 2,
            alignItems: "center",
          }}
        >
          {showLogo && (
            <Box
              component="img"
              src="/resolvent-logo.jpg"
              alt="Business Logo"
              sx={{
                width: isThermal ? 58 : 92,
                height: isThermal ? 42 : 64,
                objectFit: "contain",
                mb: isThermal ? 0.5 : 0,
              }}
            />
          )}

          <Box>
            <Typography
              sx={{
                fontSize: isThermal ? 16 : 25,
                fontWeight: 900,
                lineHeight: 1.15,
              }}
            >
              {business.business_name || "Business Name"}
            </Typography>

            <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
              {business.address || ""}
            </Typography>

            <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
              GSTIN: {business.gst_number || "-"}
            </Typography>

            <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
              {business.mobile || ""}
              {business.email ? ` | ${business.email}` : ""}
            </Typography>
          </Box>
        </Box>

        {!isThermal && (
          <Box textAlign="right">
            <Typography variant="h5" fontWeight={900}>
              TAX INVOICE
            </Typography>
            <Typography variant="body2">
              Invoice: {invoice.invoice_number || "-"}
            </Typography>
            <Typography variant="body2">
              Date: {formatDateTime(invoice.bill_date)}
            </Typography>
            <Typography variant="body2">
              Payment: {invoice.payment_mode || "-"}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider
        sx={{
          my: isThermal ? 0.75 : 2,
          borderStyle: isThermal ? "dashed" : "solid",
          borderColor: "#000",
        }}
      />

      {isThermal && (
        <Box sx={{ textAlign: "left", fontSize: 10, mb: 1 }}>
          <Typography sx={{ fontSize: 10 }}>
            Invoice: {invoice.invoice_number || "-"}
          </Typography>
          <Typography sx={{ fontSize: 10 }}>
            Date: {formatDateTime(invoice.bill_date)}
          </Typography>
          <Typography sx={{ fontSize: 10 }}>
            Payment: {invoice.payment_mode || "-"}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: isThermal ? "block" : "flex",
          justifyContent: "space-between",
          gap: 2,
          mb: isThermal ? 1 : 2,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: isThermal ? 10 : 13,
            }}
          >
            Bill To
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 10 : 13 }}>
            {customer.customer_name || "Walk-in Customer"}
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
            Mobile: {customer.mobile || "-"}
          </Typography>
        </Box>
      </Box>

      <Table
        size="small"
        sx={{
          tableLayout: "fixed",
          border: isThermal ? "none" : "1px solid #000",
          "& th, & td": {
            border: isThermal
              ? "none"
              : "1px solid #000",
            px: isThermal ? 0.25 : 1,
            py: isThermal ? 0.35 : 0.75,
            fontSize: isThermal ? 9 : 11,
            lineHeight: 1.15,
          },
          "& thead th": {
            fontWeight: 900,
            borderBottom: isThermal
              ? "1px dashed #000"
              : "1px solid #000",
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
                    fontSize: isThermal ? 9 : 11,
                    fontWeight: 700,
                  }}
                >
                  {item.item_name || "-"}
                </Typography>

                {isThermal && showBarcode && item.barcode && (
                  <Typography sx={{ fontSize: 8 }}>
                    {item.barcode}
                  </Typography>
                )}

                {showBatchExpiry &&
                  (item.batch_number || item.expiry_date) && (
                    <Typography sx={{ fontSize: isThermal ? 8 : 9 }}>
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

          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={isThermal ? 5 : 7}
                align="center"
              >
                No invoice items
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Divider
        sx={{
          my: isThermal ? 0.75 : 1.5,
          borderStyle: isThermal ? "dashed" : "solid",
          borderColor: "#000",
        }}
      />

      <Box
        sx={{
          width: isThermal ? "100%" : 330,
          ml: isThermal ? 0 : "auto",
        }}
      >
        {showSavings && totalMrp > 0 && (
          <Box display="flex" justifyContent="space-between">
            <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
              Total MRP
            </Typography>
            <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
              {money(totalMrp)}
            </Typography>
          </Box>
        )}

        <Box display="flex" justifyContent="space-between">
          <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
            Subtotal
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
            {money(subtotal)}
          </Typography>
        </Box>

        <Box display="flex" justifyContent="space-between">
          <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
            GST
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
            {money(gstAmount)}
          </Typography>
        </Box>

        {discount > 0 && (
          <Box display="flex" justifyContent="space-between">
            <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
              Discount
            </Typography>
            <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
              -{money(discount)}
            </Typography>
          </Box>
        )}

        {showSavings && totalSaving > 0 && (
          <Box display="flex" justifyContent="space-between">
            <Typography
              sx={{
                fontSize: isThermal ? 10 : 12,
                fontWeight: 800,
              }}
            >
              You Saved
            </Typography>
            <Typography
              sx={{
                fontSize: isThermal ? 10 : 12,
                fontWeight: 800,
              }}
            >
              {money(totalSaving)}
            </Typography>
          </Box>
        )}

        <Divider
          sx={{
            my: 0.75,
            borderColor: "#000",
            borderStyle: isThermal ? "dashed" : "solid",
          }}
        />

        <Box display="flex" justifyContent="space-between">
          <Typography
            sx={{
              fontSize: isThermal ? 13 : 17,
              fontWeight: 900,
            }}
          >
            Grand Total
          </Typography>
          <Typography
            sx={{
              fontSize: isThermal ? 13 : 17,
              fontWeight: 900,
            }}
          >
            {money(grandTotal)}
          </Typography>
        </Box>

        <Box display="flex" justifyContent="space-between">
          <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
            Paid
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
            {money(paidAmount)}
          </Typography>
        </Box>

        <Box display="flex" justifyContent="space-between">
          <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
            Balance
          </Typography>
          <Typography sx={{ fontSize: isThermal ? 10 : 12 }}>
            {money(balance)}
          </Typography>
        </Box>
      </Box>

      <Box textAlign="center" mt={isThermal ? 1.5 : 4}>
        <Typography
          sx={{
            fontSize: isThermal ? 10 : 13,
            fontWeight: 800,
          }}
        >
          {footerMessage}
        </Typography>
        <Typography sx={{ fontSize: isThermal ? 8 : 10 }}>
          Powered by Resolvent IT Services Pvt. Ltd.
        </Typography>
      </Box>
    </Box>
  );
}

export default InvoicePrint;
