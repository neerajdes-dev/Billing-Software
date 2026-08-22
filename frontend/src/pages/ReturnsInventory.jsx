import { useEffect, useMemo, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Chip, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, Grid, MenuItem,
  Paper, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AssignmentReturnRoundedIcon from "@mui/icons-material/AssignmentReturnRounded";
import KeyboardReturnRoundedIcon from "@mui/icons-material/KeyboardReturnRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AppLayout from "../components/AppLayout";
import PageHeader from "../components/PageHeader";
import {
  addStockAdjustment,
  createPurchaseReturn,
  createSalesReturn,
  getInventoryMovements,
  getItems,
  getPurchaseDetail,
  getPurchaseReturns,
  getPurchases,
  getReturnsDashboard,
  getSaleReturnDetail,
  getSales,
  getSalesReturns,
} from "../services/api";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const today = () => new Date().toISOString().slice(0, 10);

const reasonOptions = [
  "Damaged",
  "Expired",
  "Wrong Item",
  "Customer Return",
  "Quality Issue",
  "Counting Difference",
  "Lost",
  "Theft",
  "Sample / Free",
  "Other",
];

export default function ReturnsInventory() {
  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);

  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [items, setItems] = useState([]);
  const [salesReturns, setSalesReturns] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [movements, setMovements] = useState([]);
  const [dashboard, setDashboard] = useState({});

  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetail, setSaleDetail] = useState(null);
  const [saleReturn, setSaleReturn] = useState({
    sale_item_id: "",
    quantity: 1,
    reason: "Customer Return",
    refund_method: "Cash",
    return_date: today(),
  });

  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [purchaseDetail, setPurchaseDetail] = useState(null);
  const [purchaseReturn, setPurchaseReturn] = useState({
    purchase_item_id: "",
    quantity: 1,
    reason: "Damaged",
    return_date: today(),
  });

  const [adjustment, setAdjustment] = useState({
    item: null,
    direction: "OUT",
    quantity: 1,
    reason: "Damaged",
  });

  const [movementItem, setMovementItem] = useState(null);
  const [movementType, setMovementType] = useState("All");

  const loadAll = async () => {
    try {
      setLoading(true);
      const [saleRows, purchaseRows, itemRows, sr, pr, mv, dash] =
        await Promise.all([
          getSales(),
          getPurchases(),
          getItems(),
          getSalesReturns(),
          getPurchaseReturns(),
          getInventoryMovements(),
          getReturnsDashboard(),
        ]);
      setSales(Array.isArray(saleRows) ? saleRows : []);
      setPurchases(Array.isArray(purchaseRows) ? purchaseRows : []);
      setItems(Array.isArray(itemRows) ? itemRows : []);
      setSalesReturns(Array.isArray(sr) ? sr : []);
      setPurchaseReturns(Array.isArray(pr) ? pr : []);
      setMovements(Array.isArray(mv) ? mv : []);
      setDashboard(dash || {});
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const selectSale = async (sale) => {
    setSelectedSale(sale);
    setSaleDetail(null);
    setSaleReturn({
      sale_item_id: "",
      quantity: 1,
      reason: "Customer Return",
      refund_method: sale?.payment_mode === "Credit" ? "Credit Note" : "Cash",
      return_date: today(),
    });
    if (!sale) return;
    try {
      setSaleDetail(await getSaleReturnDetail(sale.id));
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const selectPurchase = async (purchase) => {
    setSelectedPurchase(purchase);
    setPurchaseDetail(null);
    setPurchaseReturn({
      purchase_item_id: "",
      quantity: 1,
      reason: "Damaged",
      return_date: today(),
    });
    if (!purchase) return;
    try {
      setPurchaseDetail(await getPurchaseDetail(purchase.id));
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const submitSalesReturn = async () => {
    try {
      if (!saleReturn.sale_item_id) throw new Error("Select a product to return.");
      setLoading(true);
      const result = await createSalesReturn({
        ...saleReturn,
        sale_item_id: Number(saleReturn.sale_item_id),
        quantity: Number(saleReturn.quantity),
      });
      setMessage({ type: "success", text: result.message });
      await selectSale(selectedSale);
      await loadAll();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const submitPurchaseReturn = async () => {
    try {
      if (!purchaseReturn.purchase_item_id) throw new Error("Select a product to return.");
      setLoading(true);
      const result = await createPurchaseReturn({
        ...purchaseReturn,
        purchase_item_id: Number(purchaseReturn.purchase_item_id),
        quantity: Number(purchaseReturn.quantity),
      });
      setMessage({ type: "success", text: result.message });
      await selectPurchase(selectedPurchase);
      await loadAll();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const submitAdjustment = async () => {
    try {
      if (!adjustment.item) throw new Error("Select an inventory item.");
      const qty = Number(adjustment.quantity || 0);
      if (qty <= 0) throw new Error("Quantity must be greater than zero.");
      setLoading(true);
      const signed = adjustment.direction === "IN" ? qty : -qty;
      const result = await addStockAdjustment(adjustment.item.id, {
        adjustment: signed,
        reason: adjustment.reason,
      });
      setMessage({ type: "success", text: result.message });
      setAdjustment({ item: null, direction: "OUT", quantity: 1, reason: "Damaged" });
      await loadAll();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const refreshMovements = async () => {
    try {
      setLoading(true);
      const rows = await getInventoryMovements(
        movementItem?.id || "",
        movementType
      );
      setMovements(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const selectedSaleLine = useMemo(
    () => saleDetail?.items?.find((x) => x.id === Number(saleReturn.sale_item_id)),
    [saleDetail, saleReturn.sale_item_id]
  );

  const selectedPurchaseLine = useMemo(
    () => purchaseDetail?.items?.find((x) => x.id === Number(purchaseReturn.purchase_item_id)),
    [purchaseDetail, purchaseReturn.purchase_item_id]
  );

  const cards = [
    ["Sales Returns", dashboard.sales_return_count || 0, money(dashboard.sales_return_amount), "error"],
    ["Purchase Returns", dashboard.purchase_return_count || 0, money(dashboard.purchase_return_amount), "warning"],
    ["Stock Adjustments", dashboard.stock_adjustment_count || 0, "Manual stock corrections", "info"],
    ["Inventory Movements", dashboard.movement_count || 0, "Traceable stock events", "success"],
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Returns & Inventory Control"
        subtitle="Manage sales returns, supplier returns, stock corrections and complete inventory movement history"
      />

      {message.text && (
        <Alert
          severity={message.type}
          sx={{ mb: 2.5 }}
          onClose={() => setMessage({ type: "", text: "" })}
        >
          {message.text}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {cards.map(([label, value, sub, color]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, xl: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="h4" fontWeight={900} sx={{ my: 0.5 }}>{value}</Typography>
                <Chip size="small" color={color} variant="outlined" label={sub} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined" sx={{ borderRadius: 3, mb: 2.5 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<AssignmentReturnRoundedIcon />} iconPosition="start" label="Sales Return" />
          <Tab icon={<KeyboardReturnRoundedIcon />} iconPosition="start" label="Purchase Return" />
          <Tab icon={<TuneRoundedIcon />} iconPosition="start" label="Stock Adjustment" />
          <Tab icon={<HistoryRoundedIcon />} iconPosition="start" label="Movement Ledger" />
          <Tab icon={<HistoryRoundedIcon />} iconPosition="start" label="Return History" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={900}>Find Invoice</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Search the original invoice before accepting a return.
                </Typography>
                <Autocomplete
                  options={sales}
                  value={selectedSale}
                  onChange={(_, value) => selectSale(value)}
                  getOptionLabel={(option) =>
                    `${option.invoice_no || "Invoice"} — ${option.customer_name || "Walk-in"}`
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Invoice Number / Customer" />
                  )}
                />
                {saleDetail && (
                  <Stack spacing={1.25} sx={{ mt: 2 }}>
                    <Divider />
                    <Typography fontWeight={850}>{saleDetail.invoice_no}</Typography>
                    <Typography variant="body2">
                      {saleDetail.customer_name} · {saleDetail.payment_mode} · {money(saleDetail.final_amount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Bill Date: {saleDetail.bill_date || "-"}
                    </Typography>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 7 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={900}>Return Product</Typography>
                {!saleDetail ? (
                  <Alert severity="info" sx={{ mt: 2 }}>Select an invoice to continue.</Alert>
                ) : (
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      select fullWidth label="Product"
                      value={saleReturn.sale_item_id}
                      onChange={(e) =>
                        setSaleReturn({ ...saleReturn, sale_item_id: e.target.value, quantity: 1 })
                      }
                    >
                      {(saleDetail.items || []).map((row) => (
                        <MenuItem key={row.id} value={row.id} disabled={row.available_to_return <= 0}>
                          {row.item_name} — Sold {row.quantity} / Returnable {row.available_to_return}
                        </MenuItem>
                      ))}
                    </TextField>

                    {selectedSaleLine && (
                      <Alert severity={selectedSaleLine.available_to_return > 0 ? "success" : "warning"}>
                        Maximum return quantity: {selectedSaleLine.available_to_return}. Unit selling rate: {money(selectedSaleLine.rate)}.
                      </Alert>
                    )}

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth type="number" label="Return Quantity"
                          value={saleReturn.quantity}
                          inputProps={{ min: 1, max: selectedSaleLine?.available_to_return || 1 }}
                          onChange={(e) => setSaleReturn({ ...saleReturn, quantity: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          select fullWidth label="Refund Method"
                          value={saleReturn.refund_method}
                          onChange={(e) => setSaleReturn({ ...saleReturn, refund_method: e.target.value })}
                        >
                          {["Cash", "Online", "Credit Note", "No Refund"].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          select fullWidth label="Reason"
                          value={saleReturn.reason}
                          onChange={(e) => setSaleReturn({ ...saleReturn, reason: e.target.value })}
                        >
                          {reasonOptions.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth type="date" label="Return Date"
                          InputLabelProps={{ shrink: true }}
                          value={saleReturn.return_date}
                          onChange={(e) => setSaleReturn({ ...saleReturn, return_date: e.target.value })}
                        />
                      </Grid>
                    </Grid>
                    <Button
                      variant="contained"
                      color="error"
                      disabled={loading || !saleReturn.sale_item_id}
                      onClick={submitSalesReturn}
                    >
                      Confirm Sales Return & Restore Stock
                    </Button>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Card><CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={900}>Find Purchase</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select the supplier invoice used for the original purchase.
              </Typography>
              <Autocomplete
                options={purchases}
                value={selectedPurchase}
                onChange={(_, value) => selectPurchase(value)}
                getOptionLabel={(option) =>
                  `${option.invoice_number || "Purchase"} — ${option.dealer_name || "Supplier"}`
                }
                renderInput={(params) => <TextField {...params} label="Supplier Invoice / Supplier" />}
              />
              {purchaseDetail && (
                <Stack spacing={1} sx={{ mt: 2 }}>
                  <Divider />
                  <Typography fontWeight={850}>{purchaseDetail.invoice_number}</Typography>
                  <Typography variant="body2">{purchaseDetail.dealer_name} · {money(purchaseDetail.total_amount)}</Typography>
                </Stack>
              )}
            </CardContent></Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 7 }}>
            <Card><CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={900}>Return to Supplier</Typography>
              {!purchaseDetail ? (
                <Alert severity="info" sx={{ mt: 2 }}>Select a purchase to continue.</Alert>
              ) : (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <TextField
                    select fullWidth label="Product"
                    value={purchaseReturn.purchase_item_id}
                    onChange={(e) =>
                      setPurchaseReturn({ ...purchaseReturn, purchase_item_id: e.target.value, quantity: 1 })
                    }
                  >
                    {(purchaseDetail.items || []).map((row) => (
                      <MenuItem key={row.id} value={row.id} disabled={row.available_to_return <= 0}>
                        {row.item_name} — Purchased {row.quantity} / Returnable {row.available_to_return}
                      </MenuItem>
                    ))}
                  </TextField>
                  {selectedPurchaseLine && (
                    <Alert severity="warning">
                      Current returnable quantity: {selectedPurchaseLine.available_to_return}. The system will also verify that enough stock is physically available.
                    </Alert>
                  )}
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField fullWidth type="number" label="Return Quantity"
                        value={purchaseReturn.quantity}
                        inputProps={{ min: 1, max: selectedPurchaseLine?.available_to_return || 1 }}
                        onChange={(e) => setPurchaseReturn({ ...purchaseReturn, quantity: e.target.value })} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField select fullWidth label="Reason"
                        value={purchaseReturn.reason}
                        onChange={(e) => setPurchaseReturn({ ...purchaseReturn, reason: e.target.value })}>
                        {reasonOptions.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField fullWidth type="date" label="Return Date"
                        InputLabelProps={{ shrink: true }}
                        value={purchaseReturn.return_date}
                        onChange={(e) => setPurchaseReturn({ ...purchaseReturn, return_date: e.target.value })} />
                    </Grid>
                  </Grid>
                  <Button variant="contained" color="warning" disabled={loading || !purchaseReturn.purchase_item_id}
                    onClick={submitPurchaseReturn}>
                    Confirm Purchase Return & Reduce Stock
                  </Button>
                </Stack>
              )}
            </CardContent></Card>
          </Grid>
        </Grid>
      )}

      {tab === 2 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={900}>Manual Stock Adjustment</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Use only for physical stock corrections. Sales and purchases should use their normal workflows.
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Autocomplete
                  options={items}
                  value={adjustment.item}
                  onChange={(_, value) => setAdjustment({ ...adjustment, item: value })}
                  getOptionLabel={(option) => `${option.item_name} — Stock ${option.stock}`}
                  renderInput={(params) => <TextField {...params} label="Inventory Item" />}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <TextField select fullWidth label="Movement"
                  value={adjustment.direction}
                  onChange={(e) => setAdjustment({ ...adjustment, direction: e.target.value })}>
                  <MenuItem value="IN">Stock IN (+)</MenuItem>
                  <MenuItem value="OUT">Stock OUT (-)</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <TextField fullWidth type="number" label="Quantity" value={adjustment.quantity}
                  inputProps={{ min: 1 }}
                  onChange={(e) => setAdjustment({ ...adjustment, quantity: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField select fullWidth label="Reason" value={adjustment.reason}
                  onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })}>
                  {reasonOptions.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
            {adjustment.item && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Current stock: {adjustment.item.stock}. New stock will be validated by the backend and cannot become negative.
              </Alert>
            )}
            <Button sx={{ mt: 2 }} variant="contained" disabled={loading || !adjustment.item} onClick={submitAdjustment}>
              Save Stock Adjustment
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between" mb={2}>
              <Box>
                <Typography variant="h6" fontWeight={900}>Inventory Movement Ledger</Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete history of stock movement with quantity, reference and reason.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Autocomplete sx={{ minWidth: 260 }} options={items} value={movementItem}
                  onChange={(_, value) => setMovementItem(value)}
                  getOptionLabel={(option) => option.item_name}
                  renderInput={(params) => <TextField {...params} size="small" label="Filter Product" />} />
                <TextField select size="small" label="Movement Type" value={movementType}
                  onChange={(e) => setMovementType(e.target.value)} sx={{ minWidth: 180 }}>
                  {["All","SALE","PURCHASE","SALES_RETURN","PURCHASE_RETURN","ADJUSTMENT"].map((x) =>
                    <MenuItem key={x} value={x}>{x.replaceAll("_"," ")}</MenuItem>
                  )}
                </TextField>
                <Button variant="contained" onClick={refreshMovements}>Apply Filters</Button>
                <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={refreshMovements}>Refresh</Button>
                <Button
                  variant="text"
                  onClick={async () => {
                    setMovementItem(null);
                    setMovementType("All");
                    try {
                      setLoading(true);
                      const rows = await getInventoryMovements("", "All");
                      setMovements(Array.isArray(rows) ? rows : []);
                    } catch (error) {
                      setMessage({ type: "error", text: error.message });
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Clear
                </Button>
              </Stack>
            </Stack>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Date</TableCell><TableCell>Product</TableCell><TableCell>Type</TableCell>
                  <TableCell>Reference</TableCell><TableCell align="right">Change</TableCell>
                  <TableCell align="right">Before</TableCell><TableCell align="right">After</TableCell><TableCell>Reason</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {movements.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString("en-IN") : "-"}</TableCell>
                      <TableCell><Typography fontWeight={750}>{row.item_name}</Typography><Typography variant="caption">{row.barcode}</Typography></TableCell>
                      <TableCell><Chip size="small" label={String(row.movement_type).replaceAll("_"," ")} /></TableCell>
                      <TableCell>{row.reference_number || "-"}</TableCell>
                      <TableCell align="right"><Typography fontWeight={900} color={row.quantity_change >= 0 ? "success.main" : "error.main"}>
                        {row.quantity_change >= 0 ? "+" : ""}{row.quantity_change}
                      </Typography></TableCell>
                      <TableCell align="right">{row.previous_stock}</TableCell>
                      <TableCell align="right">{row.new_stock}</TableCell>
                      <TableCell>{row.reason || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {!movements.length && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}>No inventory movements found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {tab === 4 && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, xl: 6 }}>
            <Card><CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={900} mb={2}>Sales Return History</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Invoice</TableCell><TableCell>Product</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Amount</TableCell><TableCell>Refund</TableCell></TableRow></TableHead>
                <TableBody>{salesReturns.map((row) => <TableRow key={row.id}>
                  <TableCell>{row.return_date}</TableCell><TableCell>{row.invoice_no}</TableCell><TableCell>{row.item_name}</TableCell>
                  <TableCell align="right">{row.quantity}</TableCell><TableCell align="right">{money(row.return_amount)}</TableCell><TableCell>{row.refund_method}</TableCell>
                </TableRow>)}
                {!salesReturns.length && <TableRow><TableCell colSpan={6} align="center">No sales returns.</TableCell></TableRow>}
                </TableBody>
              </Table></TableContainer>
            </CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, xl: 6 }}>
            <Card><CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={900} mb={2}>Purchase Return History</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Supplier Invoice</TableCell><TableCell>Product</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Amount</TableCell><TableCell>Reason</TableCell></TableRow></TableHead>
                <TableBody>{purchaseReturns.map((row) => <TableRow key={row.id}>
                  <TableCell>{row.return_date}</TableCell><TableCell>{row.invoice_number}</TableCell><TableCell>{row.item_name}</TableCell>
                  <TableCell align="right">{row.quantity}</TableCell><TableCell align="right">{money(row.return_amount)}</TableCell><TableCell>{row.reason || "-"}</TableCell>
                </TableRow>)}
                {!purchaseReturns.length && <TableRow><TableCell colSpan={6} align="center">No purchase returns.</TableCell></TableRow>}
                </TableBody>
              </Table></TableContainer>
            </CardContent></Card>
          </Grid>
        </Grid>
      )}
    </AppLayout>
  );
}
