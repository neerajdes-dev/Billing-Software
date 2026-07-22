import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar, Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Stack, Toolbar, Tooltip, Typography,
  useMediaQuery,
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";

const drawerWidth = 272;
const menu = [
  ["Dashboard", "/dashboard", <DashboardRoundedIcon />],
  ["Create Bill", "/create-bill", <ReceiptLongRoundedIcon />],
  ["Credit Customers", "/customers", <PeopleAltRoundedIcon />],
  ["Items & Stock", "/items", <Inventory2RoundedIcon />],
  ["Dealers", "/dealers", <LocalShippingRoundedIcon />],
  ["Stock Report", "/stock-report", <AssessmentRoundedIcon />],
  ["Sales Report", "/sales-report", <PointOfSaleRoundedIcon />],
  ["Expenses", "/expense", <PaymentsRoundedIcon />],
  ["Settings", "/settings", <SettingsRoundedIcon />],
];

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const desktop = useMediaQuery("(min-width:900px)");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user")) || {}; } catch { return {}; }
  }, []);
  const current = menu.find((x) => location.pathname.startsWith(x[1]))?.[0] || "Billing 24×7";
  const logout = () => { localStorage.removeItem("user"); navigate("/", { replace: true }); };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#0B1220", color: "white" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, py: 2.4 }}>
        <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#2563EB", fontWeight: 900 }}>R</Box>
        <Box>
          <Typography fontWeight={850} lineHeight={1.1}>Billing 24×7</Typography>
          <Typography variant="caption" sx={{ color: "#94A3B8" }}>Resolvent Business Suite</Typography>
        </Box>
      </Stack>
      <Divider sx={{ borderColor: "rgba(148,163,184,.16)" }} />
      <Typography variant="overline" sx={{ color: "#64748B", px: 2.5, pt: 2.3, pb: 1, fontWeight: 800, letterSpacing: 1.2 }}>Workspace</Typography>
      <List sx={{ px: 1.4, pt: 0, flex: 1 }}>
        {menu.map(([label, path, icon]) => (
          <ListItemButton key={path} component={NavLink} to={path} onClick={() => setMobileOpen(false)}
            sx={{ mb: .55, minHeight: 46, borderRadius: 2.2, color: "#A8B3C7", '& .MuiListItemIcon-root': { color: "inherit", minWidth: 40 }, '&.active': { color: "white", bgcolor: "#2563EB", boxShadow: "0 8px 22px rgba(37,99,235,.30)" }, '&:hover': { color: "white", bgcolor: "rgba(255,255,255,.07)" } }}>
            <ListItemIcon>{icon}</ListItemIcon><ListItemText primary={label} primaryTypographyProps={{ fontSize: 14, fontWeight: 650 }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
          <Typography fontSize={13} fontWeight={700} noWrap>{user.business_name || "Your Business"}</Typography>
          <Typography variant="caption" sx={{ color: "#94A3B8" }} noWrap>{user.user_id || "Administrator"}</Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer variant={desktop ? "permanent" : "temporary"} open={desktop || mobileOpen} onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }} sx={{ width: desktop ? drawerWidth : 0, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, border: 0 } }}>
        {drawer}
      </Drawer>
      <Box sx={{ flex: 1, minWidth: 0, ml: desktop ? 0 : 0 }}>
        <AppBar position="sticky" elevation={0} color="inherit" sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "rgba(255,255,255,.92)", backdropFilter: "blur(12px)" }}>
          <Toolbar sx={{ minHeight: 68 }}>
            {!desktop && <IconButton onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}><MenuRoundedIcon /></IconButton>}
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800}>{current}</Typography>
              <Typography variant="caption" color="text.secondary">Manage your business operations</Typography>
            </Box>
            <Tooltip title="Account menu">
              <Stack direction="row" alignItems="center" spacing={1} onClick={(e) => setAnchor(e.currentTarget)} sx={{ cursor: "pointer", p: .7, borderRadius: 2, '&:hover': { bgcolor: "#F1F5F9" } }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14 }}>{(user.business_name || "R").slice(0,1).toUpperCase()}</Avatar>
                {desktop && <Box><Typography fontSize={13} fontWeight={750}>{user.business_name || "Resolvent"}</Typography><Typography variant="caption" color="text.secondary">Administrator</Typography></Box>}
                <KeyboardArrowDownRoundedIcon fontSize="small" />
              </Stack>
            </Tooltip>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
              <MenuItem onClick={() => { setAnchor(null); navigate("/settings"); }}><SettingsRoundedIcon fontSize="small" sx={{ mr: 1.5 }} /> Settings</MenuItem>
              <MenuItem onClick={logout} sx={{ color: "error.main" }}><LogoutRoundedIcon fontSize="small" sx={{ mr: 1.5 }} /> Logout</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 1600, mx: "auto" }}>{children}</Box>
      </Box>
    </Box>
  );
}
