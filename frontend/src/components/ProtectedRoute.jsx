import { Navigate, useLocation } from "react-router-dom";

// `permission`: the module key(s) an employee needs to reach this route
// (string, or an array meaning "any of these"). Pass "admin" for a page
// that isn't grantable to employees at all, regardless of any permission
// they hold. Admins always pass, no matter what's set here -- this mirrors
// the backend's require_permission()/require_admin() checks, so a direct
// URL visit doesn't show a blank/broken page instead of just redirecting.
export default function ProtectedRoute({ children, permission }) {
  const location = useLocation();
  const userRaw = localStorage.getItem("user");
  const token = localStorage.getItem("token");
  if (!userRaw || !token) return <Navigate to="/" replace state={{ from: location.pathname }} />;

  let user = {};
  try { user = JSON.parse(userRaw) || {}; } catch { user = {}; }
  // Accounts created before Sprint 7 have no `role` stored -- treat that as
  // admin, since that was the only kind of account that existed then.
  const isAdmin = user.role !== "employee";

  if (!isAdmin && permission) {
    if (permission === "admin") return <Navigate to="/dashboard" replace />;
    const keys = Array.isArray(permission) ? permission : [permission];
    const permissions = user.permissions || {};
    if (!keys.some((key) => permissions[key])) return <Navigate to="/dashboard" replace />;
  }

  return children;
}
