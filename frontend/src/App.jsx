import { Navigate, Route, Routes } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Router } from "./AppRouter";
import theme from "./theme/theme";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import CreateBill from "./pages/CreateBill";
import Customers from "./pages/Customers";
import Items from "./pages/Items";
import Dealers from "./pages/Dealers";
import Purchase from "./pages/Purchase";
import StockReport from "./pages/StockReport";
import SalesReport from "./pages/SalesReport";
import Expense from "./pages/Expense";
import ReturnsInventory from "./pages/ReturnsInventory";
import Settings from "./pages/Settings";

const Secure = ({ children, permission }) => <ProtectedRoute permission={permission}>{children}</ProtectedRoute>;
export default function App() {
  return <ThemeProvider theme={theme}><CssBaseline /><Router><Routes>
    <Route path="/" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/dashboard" element={<Secure permission="dashboard"><Dashboard /></Secure>} />
    <Route path="/create-bill" element={<Secure permission="create_bill"><CreateBill /></Secure>} />
    <Route path="/customers" element={<Secure permission="credit_customers"><Customers /></Secure>} />
    <Route path="/items" element={<Secure permission="admin"><Items /></Secure>} />
    <Route path="/dealers" element={<Secure permission="admin"><Dealers /></Secure>} />
    <Route path="/purchase" element={<Secure permission="admin"><Purchase /></Secure>} />
    <Route path="/stock-report" element={<Secure permission="admin"><StockReport /></Secure>} />
    <Route path="/sales-report" element={<Secure permission="sales_report"><SalesReport /></Secure>} />
    <Route path="/expense" element={<Secure permission="admin"><Expense /></Secure>} />
    <Route path="/returns-inventory" element={<Secure permission="returns_inventory"><ReturnsInventory /></Secure>} />
    <Route path="/settings" element={<Secure permission={["settings_print", "settings_ai"]}><Settings /></Secure>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></Router></ThemeProvider>;
}
