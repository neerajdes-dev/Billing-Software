import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import theme from "./theme/theme";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import CreateBill from "./pages/CreateBill";
import Customers from "./pages/Customers";
import Items from "./pages/Items";
import Dealers from "./pages/Dealers";
import StockReport from "./pages/StockReport";
import SalesReport from "./pages/SalesReport";
import Expense from "./pages/Expense";
import Settings from "./pages/Settings";

const Secure = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;
export default function App() {
  return <ThemeProvider theme={theme}><CssBaseline /><BrowserRouter><Routes>
    <Route path="/" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/dashboard" element={<Secure><Dashboard /></Secure>} />
    <Route path="/create-bill" element={<Secure><CreateBill /></Secure>} />
    <Route path="/customers" element={<Secure><Customers /></Secure>} />
    <Route path="/items" element={<Secure><Items /></Secure>} />
    <Route path="/dealers" element={<Secure><Dealers /></Secure>} />
    <Route path="/stock-report" element={<Secure><StockReport /></Secure>} />
    <Route path="/sales-report" element={<Secure><SalesReport /></Secure>} />
    <Route path="/expense" element={<Secure><Expense /></Secure>} />
    <Route path="/settings" element={<Secure><Settings /></Secure>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></BrowserRouter></ThemeProvider>;
}
