const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("Cannot connect to the server. Please start the backend API.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || "Request failed");
  }
  return payload;
}

export const signupUser = (data) => request("/signup", { method: "POST", body: JSON.stringify(data) });
export const loginUser = (data) => request("/login", { method: "POST", body: JSON.stringify(data) });
export const addCustomer = (data) => request("/customers", { method: "POST", body: JSON.stringify(data) });
export const getCustomers = () => request("/customers");
export const addItem = (data) => request("/items", { method: "POST", body: JSON.stringify(data) });
export const getItems = () => request("/items");
export const getItemByBarcode = (barcode) => request(`/items/barcode/${encodeURIComponent(barcode)}`);
export const createSale = (data) => request("/sales", { method: "POST", body: JSON.stringify(data) });
export const getSales = () => request("/sales");
export const addDealer = (data) => request("/dealers", { method: "POST", body: JSON.stringify(data) });
export const getDealers = () => request("/dealers");
export const addDealerPayment = (data) => request("/dealer-payments", { method: "POST", body: JSON.stringify(data) });
export const getStockReport = () => request("/reports/stock");
export const getSalesReport = (fromDate = "", toDate = "", paymentMode = "All") => {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  if (paymentMode && paymentMode !== "All") params.set("payment_mode", paymentMode);
  const query = params.toString();
  return request(`/reports/sales${query ? `?${query}` : ""}`);
};
export const getDashboardReport = (fromDate, toDate) => {
  const query = fromDate && toDate ? `?from_date=${fromDate}&to_date=${toDate}` : "";
  return request(`/dashboard${query}`);
};
export const getSettings = (userId) => request(`/settings/${encodeURIComponent(userId)}`);
export const updateSettings = (userId, data) => request(`/settings/${encodeURIComponent(userId)}`, { method: "PUT", body: JSON.stringify(data) });
export const updateUsername = (userId, data) => request(`/settings/${encodeURIComponent(userId)}/username`, { method: "PUT", body: JSON.stringify(data) });
export const updatePassword = (userId, data) => request(`/settings/${encodeURIComponent(userId)}/password`, { method: "PUT", body: JSON.stringify(data) });
export const updateItem = (itemId, data) => request(`/items/${itemId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteItem = (itemId) => request(`/items/${itemId}`, { method: "DELETE" });
export const importItems = (items) => request("/items/import", { method: "POST", body: JSON.stringify({ items }) });
export const getCustomerCreditLedger = () => request("/customers/credit-ledger");
export const addCustomerPayment = (data) => request("/customer-payments", { method: "POST", body: JSON.stringify(data) });
export const deleteDealer = (dealerId) => request(`/dealers/${dealerId}`, { method: "DELETE" });
export const getDealerPayments = (dealerId) => request(`/dealers/${dealerId}/payments`);
export const addExpense = (data) => request("/expenses", { method: "POST", body: JSON.stringify(data) });
export const getExpenses = (fromDate = "", toDate = "") => {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  const query = params.toString();
  return request(`/expenses${query ? `?${query}` : ""}`);
};
export const deleteExpense = (expenseId) => request(`/expenses/${expenseId}`, { method: "DELETE" });
