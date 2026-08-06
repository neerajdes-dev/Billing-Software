# Resolvent Billing Software v2.0 — Client Demo Release

## Included
- Completed inventory module with minimum stock, expiry, bulk update and history
- Dealer ledger features from the staging build
- A4 tax invoice printing
- Thermal printing for 58mm, 80mm and 88mm paper
- Print settings page
- MRP, selling price and customer savings on invoice
- Batch and expiry display on invoice
- Expired and out-of-stock item billing protection
- Quantity limited to available stock
- Resolvent branding and invoice footer
- Existing customer, dealer, report, expense and settings modules

## Deployment
1. Back up the current project.
2. Run `backend/inventory_demo_migration.sql` in Neon.
3. Replace the project files with this package.
4. Deploy backend to Render.
5. Set Vercel `VITE_API_URL=https://billing-software-fy50.onrender.com`.
6. Deploy frontend to Vercel.
7. In Settings > Print Settings, choose A4 or Thermal.
8. Generate an invoice before clicking Print.

## Demo checklist
- Add/edit an item with MRP, sale price, stock and expiry.
- Confirm low-stock and expiry alerts.
- Scan item barcode.
- Confirm expired/out-of-stock items are blocked.
- Generate invoice.
- Print A4 invoice.
- Switch to Thermal and test 58mm/80mm/88mm.
- Confirm customer savings are printed.
