// Shared helpers for the "business logo" a client can upload from
// Settings (see Settings.jsx's "Business Logo" card) and that then shows
// up everywhere the app displays a logo: printed invoices/reports
// (InvoicePrint.jsx, StockReport.jsx, SalesReport.jsx) and the app's own
// top-bar account avatar (AppLayout.jsx). Centralized here so all of
// those agree on the exact same localStorage key and update-notification
// event instead of each hardcoding its own copy of these strings.
import resolventLogo from "../assets/Resolvent-Logo.jpg";

export const BUSINESS_LOGO_STORAGE_KEY = "billing_business_logo";

// Settings.jsx dispatches this after every upload/remove so any other
// already-mounted component (the AppLayout avatar, an open report page)
// can pick up the change immediately -- the browser's own "storage" event
// only fires in *other* tabs/windows, never in the tab that made the
// change.
export const BUSINESS_LOGO_UPDATED_EVENT = "billing:business-logo-updated";

// The full Resolvent wordmark -- used as the fallback "business logo" on
// printed invoices/reports and the Settings preview until the client
// uploads their own. (A previous version of this fallback pointed at
// "/resolvent-logo.jpg", a path with no matching file anywhere in the
// project, so it rendered as a broken image whenever no logo had been
// uploaded yet. This points at the real bundled asset instead.)
export const DEFAULT_BUSINESS_LOGO = resolventLogo;

export function getStoredBusinessLogo(fallback = DEFAULT_BUSINESS_LOGO) {
  return localStorage.getItem(BUSINESS_LOGO_STORAGE_KEY) || fallback;
}

export function setStoredBusinessLogo(dataUrl) {
  localStorage.setItem(BUSINESS_LOGO_STORAGE_KEY, dataUrl);
  window.dispatchEvent(new Event(BUSINESS_LOGO_UPDATED_EVENT));
}

export function clearStoredBusinessLogo() {
  localStorage.removeItem(BUSINESS_LOGO_STORAGE_KEY);
  window.dispatchEvent(new Event(BUSINESS_LOGO_UPDATED_EVENT));
}
