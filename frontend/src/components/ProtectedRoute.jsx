import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const user = localStorage.getItem("user");
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}
