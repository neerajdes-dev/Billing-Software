const rawApiUrl =
  import.meta.env.VITE_API_URL || "https://billing-software-fy50.onrender.com";

const API_URL = rawApiUrl.replace(/\/+$/, "");

function getErrorMessage(payload, status) {
  const detail = payload?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item?.loc)
          ? item.loc.filter((part) => part !== "body").join(".")
          : "";

        const message = item?.msg || "Invalid value";

        return field ? `${field}: ${message}` : message;
      })
      .join(", ");
  }

  if (detail && typeof detail === "object") {
    return (
      detail.message ||
      detail.msg ||
      JSON.stringify(detail)
    );
  }

  if (typeof payload?.message === "string") {
    return payload.message;
  }

  return `Request failed with status ${status}`;
}

async function request(path, options = {}) {
  const endpoint = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_URL}${endpoint}`;

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    console.error("API connection error:", {
      url,
      error,
    });

    throw new Error(
      "Cannot connect to the server. Please check the API URL, CORS settings, and backend status."
    );
  }

  const contentType = response.headers.get("content-type") || "";

  let payload = {};

  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => ({}));
  } else {
    const text = await response.text().catch(() => "");
    payload = text ? { message: text } : {};
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  return payload;
}

export const signupUser = (data) =>
  request("/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const loginUser = (data) =>
  request("/login", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const addCustomer = (data) =>
  request("/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getCustomers = () => request("/customers");

export const addItem = (data) =>
  request("/items", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getItems = () => request("/items");

export const getItemByBarcode = (barcode) =>
  request(`/items/barcode/${encodeURIComponent(barcode)}`);

export const createSale = (data) =>
  request("/sales", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getSales = () => request("/sales");

export const addDealer = (data) =>
  request("/dealers", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getDealers = () => request("/dealers");

export const addDealerPayment = (data) =>
  request("/dealer-payments", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getStockReport = () => request("/reports/stock");

export const getSalesReport = (
  fromDate = "",
  toDate = "",
  paymentMode = "All"
) => {
  const params = new URLSearchParams();

  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);

  if (paymentMode && paymentMode !== "All") {
    params.set("payment_mode", paymentMode);
  }

  const query = params.toString();

  return request(
    `/reports/sales${query ? `?${query}` : ""}`
  );
};

export const getDashboardReport = (fromDate, toDate) => {
  const params = new URLSearchParams();

  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);

  const query = params.toString();

  return request(
    `/dashboard${query ? `?${query}` : ""}`
  );
};

export const getSettings = (userId) =>
  request(`/settings/${encodeURIComponent(userId)}`);

export const updateSettings = (userId, data) =>
  request(`/settings/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const updateUsername = (userId, data) =>
  request(`/settings/${encodeURIComponent(userId)}/username`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const updatePassword = (userId, data) =>
  request(`/settings/${encodeURIComponent(userId)}/password`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const updateItem = (itemId, data) =>
  request(`/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteItem = (itemId) =>
  request(`/items/${itemId}`, {
    method: "DELETE",
  });

export const importItems = (items) =>
  request("/items/import", {
    method: "POST",
    body: JSON.stringify({ items }),
  });

export const bulkUpdateItems = (items) =>
  request("/items/bulk-update", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });


export const addStockAdjustment = (itemId, data) =>
  request(`/items/${itemId}/stock-adjustments`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getStockAdjustmentHistory = (itemId) =>
  request(`/items/${itemId}/stock-adjustments`);

export const getInventorySummary = () =>
  request("/items/inventory-summary");

export const getCustomerCreditLedger = () =>
  request("/customers/credit-ledger");

export const addCustomerPayment = (data) =>
  request("/customer-payments", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteDealer = (dealerId) =>
  request(`/dealers/${dealerId}`, {
    method: "DELETE",
  });

export const getDealerPayments = (dealerId) =>
  request(`/dealers/${dealerId}/payments`);

export const addDealerBill = (data) =>
  request("/dealer-bills", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateDealerBill = (billId, data) =>
  request(`/dealer-bills/${billId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteDealerBill = (billId) =>
  request(`/dealer-bills/${billId}`, {
    method: "DELETE",
  });

export const getDealerLedger = (dealerId) =>
  request(`/dealers/${dealerId}/ledger`);

export const addExpense = (data) =>
  request("/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getExpenses = (
  fromDate = "",
  toDate = ""
) => {
  const params = new URLSearchParams();

  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);

  const query = params.toString();

  return request(
    `/expenses${query ? `?${query}` : ""}`
  );
};

export const deleteExpense = (expenseId) =>
  request(`/expenses/${expenseId}`, {
    method: "DELETE",
  });