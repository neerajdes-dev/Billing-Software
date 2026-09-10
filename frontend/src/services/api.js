// The desktop app's local backend (see desktop/main/backend-manager.js)
// binds to a fresh, randomly-chosen local port on every launch -- avoiding
// port collisions with anything else already running on the shop's PC --
// so that address can never be a Vite build-time constant the way
// VITE_API_URL is for the web deploy. Instead, desktop/main/preload.js
// exposes the actual port chosen for *this* launch on
// `window.electronAPI.apiBaseUrl`, and that preload script runs before this
// page's own scripts, so it's already set by the time this module
// evaluates. On the web build `window.electronAPI` is simply undefined, so
// this is a pure superset of the previous logic: identical behavior there.
const rawApiUrl =
  window.electronAPI?.apiBaseUrl ||
  import.meta.env.VITE_API_URL ||
  "https://billing-software-fy50.onrender.com";

const API_URL = rawApiUrl.replace(/\/+$/, "");

// Endpoints the backend allows without a logged-in session. Everything else
// needs the Authorization header attached below.
const PUBLIC_ENDPOINTS = new Set(["/login", "/signup", "/setup/status"]);

function getToken() {
  return localStorage.getItem("token");
}

function clearSessionAndRedirectToLogin() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  if (window.electronAPI) {
    // The desktop build uses HashRouter (see src/AppRouter.js) -- there is
    // no server behind the file:// page to redirect to, and
    // window.location.pathname doesn't change between hash routes the way
    // it does between BrowserRouter paths, so the web build's pathname
    // check below isn't meaningful here. Going straight to the login
    // page's hash route is the desktop-correct equivalent.
    if (window.location.hash !== "#/") {
      window.location.hash = "#/";
    }
    return;
  }
  if (window.location.pathname !== "/") {
    window.location.assign("/");
  }
}

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
  const token = getToken();

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  if (response.status === 401 && !PUBLIC_ENDPOINTS.has(endpoint)) {
    clearSessionAndRedirectToLogin();
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

// Only meaningful for the desktop build (see pages/Login.jsx's first-run
// check) -- a brand-new local SQLite database has no admin account yet, so
// the app should route straight to Signup instead of Login. Harmless to
// call on the web build too (every web business already has an admin by
// definition), it's just never called there.
export const getSetupStatus = () => request("/setup/status", { method: "GET" });

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

export const getLoyaltySettings = () =>
  request("/loyalty/settings");

export const updateLoyaltySettings = (data) =>
  request("/loyalty/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const getCustomerLoyalty = (customerId) =>
  request(`/customers/${customerId}/loyalty`);

export const adjustCustomerLoyalty = (customerId, data) =>
  request(`/customers/${customerId}/loyalty-adjustment`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getLoyaltyDashboard = () =>
  request("/loyalty/dashboard");



export const getPurchases = () =>
  request("/purchases");

export const getPurchaseDashboard = () =>
  request("/purchases/dashboard");

export const getPurchaseDetail = (purchaseId) =>
  request(`/purchases/${purchaseId}`);

export const createPurchase = (data) =>
  request("/purchases", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const createPurchaseReturn = (data) =>
  request("/purchase-returns", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getPurchaseReturns = () =>
  request("/purchase-returns");

export const getProfitSummary = () =>
  request("/reports/profit-summary");


export const getAISettings = () =>
  request("/ai/settings");

export const updateAISettings = (data) =>
  request("/ai/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const testAIConnection = () =>
  request("/ai/test", {
    method: "POST",
  });

export const extractPurchaseBill = async (file) => {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();

  const response = await fetch(
    `${API_URL}/ai/extract-purchase-bill`,
    {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );

  if (response.status === 401) {
    clearSessionAndRedirectToLogin();
  }

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      payload.detail ||
        payload.message ||
        `Request failed (${response.status})`
    );
  }

  return payload;
};


// Returns & Inventory Control
export const getSaleReturnDetail = (saleId) =>
  request(`/sales/${saleId}/return-detail`);

export const createSalesReturn = (data) =>
  request("/sales-returns", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getSalesReturns = () =>
  request("/sales-returns");

export const getInventoryMovements = (itemId = "", movementType = "All") => {
  const params = new URLSearchParams();
  if (itemId) params.set("item_id", itemId);
  if (movementType && movementType !== "All") {
    params.set("movement_type", movementType);
  }
  const query = params.toString();
  return request(`/inventory-movements${query ? `?${query}` : ""}`);
};

export const getReturnsDashboard = () =>
  request("/returns/dashboard");


// Sprint 7: employee accounts (Admin-only)
export const createEmployee = (data) =>
  request("/employees", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getEmployees = () => request("/employees");

export const updateEmployee = (employeeId, data) =>
  request(`/employees/${employeeId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const resetEmployeePassword = (employeeId, password) =>
  request(`/employees/${employeeId}/reset-password`, {
    method: "PUT",
    body: JSON.stringify({ password: password || null }),
  });

export const setEmployeeActive = (employeeId, active) =>
  request(`/employees/${employeeId}/${active ? "enable" : "disable"}`, {
    method: "PUT",
  });
