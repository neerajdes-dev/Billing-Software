# Resolvent Billing Software — Staging Deployment

## 1. Repository structure

- `frontend/` — React + Vite
- `backend/` — FastAPI + SQLAlchemy
- `render.yaml` — optional Render backend blueprint

## 2. Create a staging database

Create a separate PostgreSQL database named `resolvent_billing_stage`.
Never point staging to the production database.

Copy the provider connection string into the backend environment variable:

```env
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/resolvent_billing_stage
```

## 3. Deploy the backend

Configure the backend service with:

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

Required environment variables:

```env
APP_ENV=staging
APP_NAME=Resolvent Billing Software API - Staging
DATABASE_URL=<staging PostgreSQL URL>
CORS_ORIGINS=<exact staging frontend URL>
SECRET_KEY=<long random value>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

After deployment, verify:

- `/health` returns `{"status":"ok","service":"billing-api"}`
- `/docs` opens the FastAPI Swagger page

## 4. Deploy the frontend

Configure:

- Root directory: `frontend`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

Set this frontend environment variable before building:

```env
VITE_API_URL=https://YOUR-STAGING-BACKEND-DOMAIN
```

## 5. Complete CORS setup

Once the frontend URL is known, update the backend variable with the exact origin only:

```env
CORS_ORIGINS=https://YOUR-STAGING-FRONTEND-DOMAIN
```

Do not add a trailing slash.
Redeploy the backend after changing this value.

## 6. Local verification

Backend:

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/macOS
uvicorn main:app --reload
```

Frontend:

```bash
cd frontend
npm ci
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/macOS
npm run dev
```

## 7. UAT smoke test

1. Open the staging frontend from another computer.
2. Create a dedicated UAT user.
3. Log in with a wrong password and confirm access is rejected.
4. Add one customer, item, dealer, and expense.
5. Generate Cash, Online, and Credit invoices.
6. Verify stock deduction and insufficient-stock validation.
7. Collect a credit payment and verify outstanding totals.
8. Verify Dashboard, Sales Report, and Stock Report.
9. Print an invoice.
10. Confirm data remains after logout and a new login.

## Security notes

- Never commit `.env` files or database passwords.
- Use a separate staging database and test user accounts.
- Restrict `CORS_ORIGINS` to the actual frontend URL.
- Back up the staging database before destructive UAT cycles when needed.
