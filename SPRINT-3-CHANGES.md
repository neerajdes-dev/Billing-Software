# Sprint 3

Implemented:
- Complete Items CRUD: add, edit and safe delete.
- Excel/CSV item import with duplicate-barcode handling.
- Inventory KPIs: total products, low stock, out of stock and stock value.
- Persistent Expenses backend with categories, payment modes, notes and delete.
- Customer credit-ledger and customer-payment backend endpoints.
- Dealer delete and payment-history backend endpoints.
- Consistent title/description/form spacing across commercial screens.
- Backend date parsing fixes for dealer bills and expenses.
- Frontend production build verified.

Item import columns:
item_name, barcode, purchase_price, sale_price, gst_percent, stock

Notes:
- Existing tables remain compatible. New tables `expenses` and `customer_payments` are created automatically when FastAPI starts.
- Items already used on sales invoices are protected from deletion.
