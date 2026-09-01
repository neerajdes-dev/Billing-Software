import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const user = localStorage.getItem("user");
  const token = localStorage.getItem("token");
  if (!user || !token) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}
