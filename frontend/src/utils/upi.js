export const DEFAULT_UPI_SETTINGS = {
  enabled: false,
  upi_id: "",
  payee_name: "",
  merchant_city: "",
  payment_note: "Invoice Payment",
  qr_position: "below_total",
  qr_size: 150,
  include_amount: true,
  show_upi_id: true,
  show_invoice_number: true,
  show_customer_name: false,
  show_for_cash: false,
};

export const buildUpiPaymentUrl = ({
  settings,
  amount,
  invoiceNumber,
  customerName,
}) => {
  const upiId = String(settings?.upi_id || "").trim();
  const payeeName = String(settings?.payee_name || "").trim();

  if (!upiId || !payeeName) return "";

  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    cu: "INR",
  });

  const numericAmount = Number(amount || 0);

  if (settings.include_amount && numericAmount > 0) {
    params.set("am", numericAmount.toFixed(2));
  }

  const noteParts = [
    String(settings.payment_note || "Invoice Payment").trim(),
  ];

  if (settings.show_invoice_number && invoiceNumber) {
    noteParts.push(`Invoice ${invoiceNumber}`);
  }

  if (settings.show_customer_name && customerName) {
    noteParts.push(String(customerName));
  }

  const note = noteParts.filter(Boolean).join(" - ");

  if (note) params.set("tn", note);

  return `upi://pay?${params.toString()}`;
};

export const isValidUpiId = (value) =>
  /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(
    String(value || "").trim()
  );
