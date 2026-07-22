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

function InvoicePrint({
  business = {},
  invoice = {},
  customer = {},
  items = [],
}) {
  const subtotal = Number(invoice.subtotal || 0);
  const gstAmount = Number(invoice.gst_amount || 0);
  const grandTotal = Number(invoice.total_amount || 0);

  return (
    <Box
      className="invoice-print-area"
      sx={{
        backgroundColor: "#ffffff",
        color: "#000000",
        width: "100%",
        p: 3,
      }}
    >
      <Box textAlign="center" mb={2}>
        <Typography variant="h4" fontWeight={800}>
          {business.business_name || "Business Name"}
        </Typography>

        <Typography variant="body2">
          {business.address || ""}
        </Typography>

        <Typography variant="body2">
          GSTIN: {business.gst_number || "-"}
        </Typography>

        <Typography variant="body2">
          {business.mobile || ""}
          {business.email ? ` | ${business.email}` : ""}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography fontWeight={700}>Bill To</Typography>
          <Typography>{customer.customer_name || "-"}</Typography>
          <Typography variant="body2">
            Mobile: {customer.mobile || "-"}
          </Typography>
        </Box>

        <Box textAlign="right">
          <Typography fontWeight={700}>
            Invoice No: {invoice.invoice_number || "-"}
          </Typography>

          <Typography variant="body2">
            Date: {invoice.bill_date || "-"}
          </Typography>

          <Typography variant="body2">
            Payment: {invoice.payment_mode || "-"}
          </Typography>
        </Box>
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
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Rate</TableCell>
            <TableCell align="right">GST</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {items.map((item, index) => (
            <TableRow key={item.id || `${item.item_name}-${index}`}>
              <TableCell>{item.item_name || "-"}</TableCell>

              <TableCell align="right">
                {Number(item.quantity || 0)}
              </TableCell>

              <TableCell align="right">
                ₹{Number(item.sale_price || item.rate || 0).toFixed(2)}
              </TableCell>

              <TableCell align="right">
                {Number(item.gst_percent || 0).toFixed(2)}%
              </TableCell>

              <TableCell align="right">
                ₹{Number(item.amount || 0).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}

          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} align="center">
                No invoice items
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Box
        sx={{
          width: 300,
          ml: "auto",
          mt: 3,
        }}
      >
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography>Subtotal</Typography>
          <Typography>₹{subtotal.toFixed(2)}</Typography>
        </Box>

        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography>GST</Typography>
          <Typography>₹{gstAmount.toFixed(2)}</Typography>
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box display="flex" justifyContent="space-between">
          <Typography variant="h6" fontWeight={800}>
            Grand Total
          </Typography>

          <Typography variant="h6" fontWeight={800}>
            ₹{grandTotal.toFixed(2)}
          </Typography>
        </Box>
      </Box>

      <Box textAlign="center" mt={5}>
        <Typography fontWeight={700}>
          Thank you for your business
        </Typography>

        <Typography variant="caption">
          This is a computer-generated invoice.
        </Typography>
      </Box>
    </Box>
  );
}

export default InvoicePrint;