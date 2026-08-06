# Resolvent Billing Software — Inventory Demo Final

## Replace these files

Backend:
- `backend/models.py`
- `backend/schemas.py`
- `backend/main.py`

Frontend:
- `frontend/src/pages/Items.jsx`
- `frontend/src/services/api.js`

## Database migration

Run `backend/inventory_demo_migration.sql` in the Neon SQL Editor before testing.

The migration is idempotent and can be run more than once.

## Deployment order

1. Back up the current project.
2. Replace the backend files.
3. Run the SQL migration.
4. Test backend syntax:
   `python -m py_compile main.py models.py schemas.py`
5. Push backend code and redeploy Render.
6. Verify:
   - `/health`
   - `/items`
   - `/items/inventory-summary`
7. Replace frontend files.
8. Confirm Vercel environment:
   `VITE_API_URL=https://billing-software-fy50.onrender.com`
9. Redeploy Vercel.
10. Hard refresh with `Ctrl + Shift + R`.

## Demo test checklist

- Add an item with minimum stock, batch, manufacturing date and expiry date.
- Set current stock equal to minimum stock: status must be Low Stock.
- Set stock above minimum: status must be Healthy.
- Set stock to zero: status must be Out of Stock.
- Use an expiry date in the past: Expired.
- Use today's expiry date: Expires Today.
- Use a date within alert days: Expiring in N days.
- Test Excel/CSV import and templates.
- Test Bulk Update.
- Test stock adjustment and history.
- Test expiry/stock filters.
- Export inventory and stock history.
