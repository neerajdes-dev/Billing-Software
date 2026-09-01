import os
from datetime import datetime, date
from typing import Any

import jwt
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import Base, engine, SessionLocal
import models
import schemas
from security import hash_password, verify_password, create_access_token, decode_access_token
from ai_service import encrypt_key, decrypt_key, mask_key, extract_bill, test_provider


Base.metadata.create_all(bind=engine)


def run_database_migrations():
    migration_statements = [
        """
        CREATE TABLE IF NOT EXISTS ai_settings (
            id SERIAL PRIMARY KEY,
            enabled INTEGER NOT NULL DEFAULT 0,
            provider VARCHAR NOT NULL DEFAULT 'openai',
            model VARCHAR,
            encrypted_api_key TEXT,
            base_url VARCHAR,
            ollama_mode VARCHAR DEFAULT 'local',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,

        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS email VARCHAR",
        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS gst_number VARCHAR",
        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bill_amount DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bill_date TIMESTAMP",
        "ALTER TABLE dealer_payments ADD COLUMN IF NOT EXISTS reference VARCHAR",
        "ALTER TABLE dealer_payments ADD COLUMN IF NOT EXISTS note VARCHAR",
        "ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS reference VARCHAR",
        "ALTER TABLE items ADD COLUMN IF NOT EXISTS mrp DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE items ADD COLUMN IF NOT EXISTS minimum_stock INTEGER DEFAULT 5",
        "ALTER TABLE items ADD COLUMN IF NOT EXISTS batch_number VARCHAR",
        "ALTER TABLE items ADD COLUMN IF NOT EXISTS manufacturing_date DATE",
        "ALTER TABLE items ADD COLUMN IF NOT EXISTS expiry_date DATE",
        "ALTER TABLE items ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER DEFAULT 30",
        "UPDATE items SET minimum_stock = 5 WHERE minimum_stock IS NULL",
        "UPDATE items SET expiry_alert_days = 30 WHERE expiry_alert_days IS NULL",
        """
        CREATE TABLE IF NOT EXISTS stock_adjustments (
            id SERIAL PRIMARY KEY,
            item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            previous_stock INTEGER NOT NULL,
            adjustment INTEGER NOT NULL,
            new_stock INTEGER NOT NULL,
            reason VARCHAR NOT NULL DEFAULT 'Bulk update',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS bill_date TIMESTAMP",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_mrp DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_saving DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_amount DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS online_amount DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_amount DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_received DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS change_return DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS loyalty_points_earned DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS loyalty_points_redeemed DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS loyalty_discount DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS cost_price DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS profit_amount DOUBLE PRECISION DEFAULT 0",
        """
        CREATE TABLE IF NOT EXISTS purchases (
            id SERIAL PRIMARY KEY,
            dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
            invoice_number VARCHAR NOT NULL,
            purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            subtotal DOUBLE PRECISION DEFAULT 0,
            gst_amount DOUBLE PRECISION DEFAULT 0,
            discount_amount DOUBLE PRECISION DEFAULT 0,
            freight_amount DOUBLE PRECISION DEFAULT 0,
            round_off DOUBLE PRECISION DEFAULT 0,
            total_amount DOUBLE PRECISION DEFAULT 0,
            paid_amount DOUBLE PRECISION DEFAULT 0,
            outstanding_amount DOUBLE PRECISION DEFAULT 0,
            payment_mode VARCHAR DEFAULT 'Credit',
            note VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS purchase_items (
            id SERIAL PRIMARY KEY,
            purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
            item_id INTEGER NOT NULL REFERENCES items(id),
            item_name VARCHAR NOT NULL,
            quantity INTEGER NOT NULL,
            purchase_price DOUBLE PRECISION NOT NULL DEFAULT 0,
            mrp DOUBLE PRECISION DEFAULT 0,
            sale_price DOUBLE PRECISION DEFAULT 0,
            gst_percent DOUBLE PRECISION DEFAULT 0,
            taxable_amount DOUBLE PRECISION DEFAULT 0,
            gst_amount DOUBLE PRECISION DEFAULT 0,
            line_total DOUBLE PRECISION DEFAULT 0,
            batch_number VARCHAR,
            manufacturing_date DATE,
            expiry_date DATE,
            returned_quantity INTEGER DEFAULT 0
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS purchase_returns (
            id SERIAL PRIMARY KEY,
            purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
            purchase_item_id INTEGER NOT NULL REFERENCES purchase_items(id) ON DELETE CASCADE,
            dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
            item_id INTEGER NOT NULL REFERENCES items(id),
            quantity INTEGER NOT NULL,
            return_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
            reason VARCHAR,
            return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,

        "ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0",
        """
        CREATE TABLE IF NOT EXISTS sales_returns (
            id SERIAL PRIMARY KEY,
            sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
            item_id INTEGER NOT NULL REFERENCES items(id),
            quantity INTEGER NOT NULL,
            return_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
            reason VARCHAR NOT NULL,
            refund_method VARCHAR NOT NULL DEFAULT 'Cash',
            return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS inventory_movements (
            id SERIAL PRIMARY KEY,
            item_id INTEGER NOT NULL REFERENCES items(id),
            movement_type VARCHAR NOT NULL,
            quantity_change INTEGER NOT NULL,
            previous_stock INTEGER NOT NULL,
            new_stock INTEGER NOT NULL,
            reference_type VARCHAR,
            reference_id INTEGER,
            reference_number VARCHAR,
            reason VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(item_id)",
        "CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at)",
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR DEFAULT 'Regular'",
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_member_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        """
        CREATE TABLE IF NOT EXISTS loyalty_settings (
            id SERIAL PRIMARY KEY,
            enabled INTEGER NOT NULL DEFAULT 1,
            earn_amount DOUBLE PRECISION NOT NULL DEFAULT 100,
            points_per_earn_amount DOUBLE PRECISION NOT NULL DEFAULT 1,
            point_value DOUBLE PRECISION NOT NULL DEFAULT 1,
            minimum_redeem_points DOUBLE PRECISION NOT NULL DEFAULT 10,
            max_redeem_percent DOUBLE PRECISION NOT NULL DEFAULT 20,
            silver_threshold DOUBLE PRECISION NOT NULL DEFAULT 10000,
            gold_threshold DOUBLE PRECISION NOT NULL DEFAULT 25000,
            platinum_threshold DOUBLE PRECISION NOT NULL DEFAULT 50000,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS loyalty_transactions (
            id SERIAL PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
            transaction_type VARCHAR NOT NULL,
            points DOUBLE PRECISION NOT NULL DEFAULT 0,
            balance_after DOUBLE PRECISION NOT NULL DEFAULT 0,
            note VARCHAR,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        INSERT INTO loyalty_settings (
            enabled, earn_amount, points_per_earn_amount, point_value,
            minimum_redeem_points, max_redeem_percent,
            silver_threshold, gold_threshold, platinum_threshold
        )
        SELECT 1, 100, 1, 1, 10, 20, 10000, 25000, 50000
        WHERE NOT EXISTS (SELECT 1 FROM loyalty_settings)
        """,

        "ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS mrp DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS saving DOUBLE PRECISION DEFAULT 0",
    ]

    with engine.begin() as connection:
        for statement in migration_statements:
            connection.execute(text(statement))

    print("Database migrations completed successfully")


run_database_migrations()

app = FastAPI(title="Resolvent Billing Software API")

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoints reachable without a logged-in session. Everything else requires a
# valid "Authorization: Bearer <token>" header issued by POST /login.
PUBLIC_PATHS = {"/", "/health", "/signup", "/login", "/docs", "/openapi.json", "/redoc"}


@app.middleware("http")
async def require_authentication(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in PUBLIC_PATHS:
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

    token = auth_header[len("Bearer "):].strip()
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        return JSONResponse(status_code=401, content={"detail": "Session expired. Please log in again."})
    except jwt.PyJWTError:
        return JSONResponse(status_code=401, content={"detail": "Invalid session. Please log in again."})

    request.state.user_id = payload.get("sub")
    return await call_next(request)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user_id(request: Request) -> str:
    """The user_id from the caller's verified JWT (set by require_authentication)."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


def generate_invoice_no():
    return "INV-" + datetime.now().strftime("%Y%m%d%H%M%S")


def to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def add_inventory_movement(
    db: Session,
    item_id: int,
    movement_type: str,
    quantity_change: int,
    previous_stock: int,
    new_stock: int,
    reference_type: str | None = None,
    reference_id: int | None = None,
    reference_number: str | None = None,
    reason: str | None = None,
):
    row = models.InventoryMovement(
        item_id=item_id,
        movement_type=movement_type,
        quantity_change=int(quantity_change),
        previous_stock=int(previous_stock),
        new_stock=int(new_stock),
        reference_type=reference_type,
        reference_id=reference_id,
        reference_number=reference_number,
        reason=reason,
    )
    db.add(row)
    return row




def get_loyalty_settings(db: Session):
    settings = db.query(models.LoyaltySettings).order_by(models.LoyaltySettings.id.asc()).first()
    if settings:
        return settings

    settings = models.LoyaltySettings()
    db.add(settings)
    db.flush()
    return settings


def customer_sales_query(db: Session, customer):
    query = db.query(models.Sale)

    if customer.mobile:
        return query.filter(models.Sale.customer_mobile == customer.mobile)

    return query.filter(models.Sale.customer_name == customer.customer_name)


def customer_lifetime_spend(db: Session, customer) -> float:
    return sum(to_float(row.final_amount) for row in customer_sales_query(db, customer).all())


def loyalty_tier_for_spend(spend: float, settings) -> str:
    if spend >= to_float(settings.platinum_threshold):
        return "Platinum"
    if spend >= to_float(settings.gold_threshold):
        return "Gold"
    if spend >= to_float(settings.silver_threshold):
        return "Silver"
    return "Regular"


def loyalty_tier_multiplier(tier: str) -> float:
    return {
        "Regular": 1.0,
        "Silver": 1.25,
        "Gold": 1.5,
        "Platinum": 2.0,
    }.get(str(tier or "Regular"), 1.0)


def normalize_date_value(value):
    if value is None or value == "":
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="Dates must use YYYY-MM-DD format",
            ) from exc

    raise HTTPException(status_code=400, detail="Invalid date value")


def validate_item_values(
    item_name,
    barcode,
    purchase_price,
    mrp,
    sale_price,
    gst_percent,
    stock,
    minimum_stock=5,
    manufacturing_date=None,
    expiry_date=None,
    expiry_alert_days=30,
):
    if not str(item_name or "").strip():
        raise HTTPException(status_code=400, detail="Item name is required")

    if not str(barcode or "").strip():
        raise HTTPException(status_code=400, detail="Barcode is required")

    numeric_values = [
        purchase_price,
        mrp,
        sale_price,
        gst_percent,
        stock,
        minimum_stock,
        expiry_alert_days,
    ]

    if any(to_float(value) < 0 for value in numeric_values):
        raise HTTPException(status_code=400, detail="Negative values are not allowed")

    if to_float(purchase_price) > to_float(sale_price):
        raise HTTPException(
            status_code=400,
            detail="Purchase price cannot exceed sale price",
        )

    if to_float(sale_price) > to_float(mrp):
        raise HTTPException(
            status_code=400,
            detail="Sale price cannot exceed MRP",
        )

    if int(stock) != stock:
        raise HTTPException(status_code=400, detail="Stock must be a whole number")

    if int(minimum_stock) != minimum_stock:
        raise HTTPException(
            status_code=400,
            detail="Minimum stock must be a whole number",
        )

    if int(expiry_alert_days) != expiry_alert_days:
        raise HTTPException(
            status_code=400,
            detail="Expiry alert days must be a whole number",
        )

    mfg = normalize_date_value(manufacturing_date)
    expiry = normalize_date_value(expiry_date)

    if mfg and expiry and expiry < mfg:
        raise HTTPException(
            status_code=400,
            detail="Expiry date cannot be before manufacturing date",
        )

@app.get("/")
def home():
    return {"message": "Resolvent Billing Software API Running"}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "Resolvent Billing Software API Running",
        "cors_origins": cors_origins,
    }


@app.get("/debug/database")
def debug_database(db: Session = Depends(get_db)):
    database_info = db.execute(
        text(
            """
            SELECT
                current_database() AS database_name,
                current_schema() AS schema_name
            """
        )
    ).mappings().first()

    dealer_columns = db.execute(
        text(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'dealers'
            ORDER BY ordinal_position
            """
        )
    ).mappings().all()

    return {
        "database": dict(database_info) if database_info else {},
        "dealer_columns": [dict(column) for column in dealer_columns],
    }


@app.post("/signup")
def signup(data: schemas.SignupRequest, db: Session = Depends(get_db)):
    existing_user = (
        db.query(models.User).filter(models.User.user_id == data.user_id).first()
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="User ID already exists")

    new_user = models.User(
        business_name=data.business_name,
        user_id=data.user_id,
        password=hash_password(data.password),
        email=data.email,
        mobile=data.mobile,
        logo=data.logo,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Account created successfully",
        "user_id": new_user.user_id,
        "business_name": new_user.business_name,
    }


@app.post("/login")
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.user_id == data.user_id).first()

    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid user ID or password")

    # Transparently migrate old plaintext passwords after a valid login.
    if not user.password.startswith("pbkdf2_sha256$"):
        user.password = hash_password(data.password)
        db.commit()

    access_token = create_access_token(subject=user.user_id)

    return {
        "message": "Login successful",
        "user_id": user.user_id,
        "business_name": user.business_name,
        "email": user.email,
        "mobile": user.mobile,
        "access_token": access_token,
        "token_type": "bearer",
    }


@app.post("/customers")
def add_customer(data: schemas.CustomerCreate, db: Session = Depends(get_db)):
    customer = models.Customer(**data.dict())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@app.get("/customers")
def get_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).order_by(models.Customer.id.desc()).all()


@app.post("/items")
def add_item(data: schemas.ItemCreate, db: Session = Depends(get_db)):
    validate_item_values(
        data.item_name,
        data.barcode,
        data.purchase_price,
        data.mrp,
        data.sale_price,
        data.gst_percent,
        data.stock,
        data.minimum_stock,
        data.manufacturing_date,
        data.expiry_date,
        data.expiry_alert_days,
    )

    normalized_barcode = data.barcode.strip()

    existing = (
        db.query(models.Item)
        .filter(models.Item.barcode == normalized_barcode)
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Barcode already exists")

    item_data = data.dict()
    item_data["item_name"] = data.item_name.strip()
    item_data["barcode"] = normalized_barcode
    item_data["manufacturing_date"] = normalize_date_value(
        data.manufacturing_date
    )
    item_data["expiry_date"] = normalize_date_value(data.expiry_date)

    item = models.Item(**item_data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/items")
def get_items(db: Session = Depends(get_db)):
    return db.query(models.Item).order_by(models.Item.id.desc()).all()


@app.get("/items/inventory-summary")
def inventory_summary(db: Session = Depends(get_db)):
    items = db.query(models.Item).all()
    today = date.today()

    result = {
        "total_products": len(items),
        "total_stock": 0,
        "inventory_value": 0.0,
        "healthy_stock": 0,
        "low_stock": 0,
        "out_of_stock": 0,
        "expired": 0,
        "expiring_soon": 0,
    }

    for item in items:
        stock = int(item.stock or 0)
        minimum_stock = int(item.minimum_stock or 0)
        result["total_stock"] += stock
        result["inventory_value"] += (
            to_float(item.purchase_price) * stock
        )

        if stock <= 0:
            result["out_of_stock"] += 1
        elif stock <= minimum_stock:
            result["low_stock"] += 1
        else:
            result["healthy_stock"] += 1

        if item.expiry_date:
            days_remaining = (item.expiry_date - today).days
            if days_remaining <= 0:
                result["expired"] += 1
            elif days_remaining <= int(item.expiry_alert_days or 30):
                result["expiring_soon"] += 1

    result["inventory_value"] = round(result["inventory_value"], 2)
    return result


@app.get("/items/barcode/{barcode}")
def get_item_by_barcode(barcode: str, db: Session = Depends(get_db)):
    item = (
        db.query(models.Item)
        .filter(models.Item.barcode == barcode.strip())
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return item


@app.post("/sales")
def create_sale(data: schemas.SaleCreate, db: Session = Depends(get_db)):
    subtotal = 0.0
    gst_amount = 0.0
    total_mrp = 0.0
    total_saving = 0.0
    sale_items = []

    if not data.products:
        raise HTTPException(status_code=400, detail="Add at least one product")

    for product in data.products:
        item = db.query(models.Item).filter(models.Item.id == product.item_id).first()

        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        current_stock = int(item.stock or 0)
        qty = int(product.quantity or 0)

        if qty <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Quantity must be greater than zero for {item.item_name}",
            )

        if current_stock < qty:
            raise HTTPException(
                status_code=400,
                detail=f"Stock not available for {item.item_name}",
            )

        if item.expiry_date and item.expiry_date < date.today():
            raise HTTPException(
                status_code=400,
                detail=f"{item.item_name} is expired and cannot be billed",
            )

        rate = to_float(item.sale_price)
        cost_price = to_float(item.purchase_price)
        mrp = max(to_float(item.mrp), rate)
        base_amount = rate * qty
        profit_amount = max((rate - cost_price) * qty, 0)
        mrp_amount = mrp * qty
        saving = max(mrp_amount - base_amount, 0)
        item_gst = base_amount * to_float(item.gst_percent) / 100
        line_total = base_amount + item_gst

        subtotal += base_amount
        total_mrp += mrp_amount
        total_saving += saving
        gst_amount += item_gst

        item.stock = current_stock - qty

        sale_items.append(
            {
                "item_id": item.id,
                "item_name": item.item_name,
                "quantity": qty,
                "mrp": mrp,
                "rate": rate,
                "cost_price": cost_price,
                "profit_amount": profit_amount,
                "gst_percent": item.gst_percent,
                "amount": line_total,
                "saving": saving,
            }
        )

    gross_total = subtotal + gst_amount
    discount_amount = max(0.0, min(to_float(data.discount_amount), gross_total))

    loyalty_settings = get_loyalty_settings(db)
    loyalty_customer = None
    loyalty_points_redeemed = 0.0
    loyalty_discount = 0.0

    if data.customer_id:
        loyalty_customer = (
            db.query(models.Customer)
            .filter(models.Customer.id == data.customer_id)
            .first()
        )

        if not loyalty_customer:
            raise HTTPException(status_code=404, detail="Selected customer not found")

    requested_points = max(0.0, to_float(data.loyalty_points_to_redeem))

    if requested_points > 0:
        if not loyalty_settings.enabled:
            raise HTTPException(status_code=400, detail="Loyalty program is disabled")

        if not loyalty_customer:
            raise HTTPException(
                status_code=400,
                detail="Select a registered customer to redeem loyalty points",
            )

        available_points = max(0.0, to_float(loyalty_customer.loyalty_points))

        if requested_points > available_points + 0.001:
            raise HTTPException(
                status_code=400,
                detail=f"Customer has only {available_points:.2f} loyalty points available",
            )

        if requested_points < to_float(loyalty_settings.minimum_redeem_points):
            raise HTTPException(
                status_code=400,
                detail=f"Minimum redemption is {loyalty_settings.minimum_redeem_points:.0f} points",
            )

        pre_loyalty_total = max(gross_total - discount_amount, 0.0)
        maximum_loyalty_discount = (
            pre_loyalty_total * to_float(loyalty_settings.max_redeem_percent) / 100
        )

        requested_discount = requested_points * to_float(loyalty_settings.point_value)
        loyalty_discount = min(requested_discount, maximum_loyalty_discount)

        if to_float(loyalty_settings.point_value) > 0:
            loyalty_points_redeemed = (
                loyalty_discount / to_float(loyalty_settings.point_value)
            )

    final_amount = max(
        gross_total - discount_amount - loyalty_discount,
        0.0,
    )

    payment_mode = str(data.payment_mode or "Cash").strip() or "Cash"

    cash_amount = max(0.0, to_float(data.cash_amount))
    online_amount = max(0.0, to_float(data.online_amount))
    credit_amount = max(0.0, to_float(data.credit_amount))
    amount_received = max(0.0, to_float(data.amount_received))

    if payment_mode == "Cash":
        cash_amount = final_amount
        online_amount = 0.0
        credit_amount = 0.0
    elif payment_mode == "Online":
        cash_amount = 0.0
        online_amount = final_amount
        credit_amount = 0.0
    elif payment_mode == "Credit":
        cash_amount = 0.0
        online_amount = 0.0
        credit_amount = final_amount
    elif payment_mode == "Split":
        split_total = cash_amount + online_amount + credit_amount

        if abs(split_total - final_amount) > 0.01:
            raise HTTPException(
                status_code=400,
                detail="Split payment amounts must equal the final bill amount",
            )

    if payment_mode == "Credit" and not str(data.customer_name or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Customer name is required for a credit bill",
        )

    if credit_amount > 0 and not str(data.customer_name or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Customer name is required when a credit amount is used",
        )

    if payment_mode == "Cash":
        if amount_received > 0 and amount_received + 0.001 < final_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Amount received cannot be less than final amount {final_amount:.2f}",
            )

        received_for_change = amount_received if amount_received > 0 else final_amount
        change_return = max(received_for_change - final_amount, 0.0)
        amount_received = received_for_change
    elif payment_mode == "Split":
        amount_received = cash_amount + online_amount
        change_return = 0.0
    elif payment_mode == "Online":
        amount_received = final_amount
        change_return = 0.0
    else:
        amount_received = 0.0
        change_return = 0.0

    selected_bill_date = datetime.now()

    if data.bill_date:
        try:
            selected_bill_date = datetime.strptime(data.bill_date, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid bill date") from exc

    sale = models.Sale(
        invoice_no=generate_invoice_no(),
        customer_name=data.customer_name,
        customer_mobile=data.customer_mobile,
        subtotal=subtotal,
        total_mrp=total_mrp,
        total_saving=total_saving,
        gst_amount=gst_amount,
        discount_amount=discount_amount,
        final_amount=final_amount,
        payment_mode=payment_mode,
        cash_amount=cash_amount,
        online_amount=online_amount,
        credit_amount=credit_amount,
        amount_received=amount_received,
        change_return=change_return,
        loyalty_points_earned=0,
        loyalty_points_redeemed=loyalty_points_redeemed,
        loyalty_discount=loyalty_discount,
        bill_date=selected_bill_date,
        created_at=selected_bill_date,
    )

    db.add(sale)
    db.flush()

    for row in sale_items:
        db.add(models.SaleItem(sale_id=sale.id, **row))
        current_item = db.query(models.Item).filter(models.Item.id == row["item_id"]).first()
        if current_item:
            current_stock = int(current_item.stock or 0)
            qty = int(row["quantity"] or 0)
            add_inventory_movement(
                db,
                item_id=current_item.id,
                movement_type="SALE",
                quantity_change=-qty,
                previous_stock=current_stock + qty,
                new_stock=current_stock,
                reference_type="sale",
                reference_id=sale.id,
                reference_number=sale.invoice_no,
                reason=f"Sale {sale.invoice_no}",
            )

    loyalty_points_earned = 0.0
    loyalty_balance = None
    loyalty_tier = None

    if loyalty_customer and loyalty_settings.enabled:
        current_balance = max(0.0, to_float(loyalty_customer.loyalty_points))

        if loyalty_points_redeemed > 0:
            current_balance = max(0.0, current_balance - loyalty_points_redeemed)
            loyalty_customer.loyalty_points = current_balance

            db.add(
                models.LoyaltyTransaction(
                    customer_id=loyalty_customer.id,
                    sale_id=sale.id,
                    transaction_type="Redeemed",
                    points=-loyalty_points_redeemed,
                    balance_after=current_balance,
                    note=f"Redeemed on invoice {sale.invoice_no}",
                )
            )

        lifetime_spend = customer_lifetime_spend(db, loyalty_customer)
        loyalty_tier = loyalty_tier_for_spend(lifetime_spend, loyalty_settings)
        loyalty_customer.loyalty_tier = loyalty_tier

        earn_amount = max(1.0, to_float(loyalty_settings.earn_amount))
        earning_units = int(final_amount // earn_amount)
        base_points = (
            earning_units *
            to_float(loyalty_settings.points_per_earn_amount)
        )

        loyalty_points_earned = round(
            base_points * loyalty_tier_multiplier(loyalty_tier),
            2,
        )

        if loyalty_points_earned > 0:
            current_balance += loyalty_points_earned
            loyalty_customer.loyalty_points = current_balance

            db.add(
                models.LoyaltyTransaction(
                    customer_id=loyalty_customer.id,
                    sale_id=sale.id,
                    transaction_type="Earned",
                    points=loyalty_points_earned,
                    balance_after=current_balance,
                    note=f"Earned on invoice {sale.invoice_no}",
                )
            )

        sale.loyalty_points_earned = loyalty_points_earned
        loyalty_balance = current_balance

    db.commit()
    db.refresh(sale)

    return {
        "message": "Bill generated successfully",
        "invoice_no": sale.invoice_no,
        "sale_id": sale.id,
        "customer_name": sale.customer_name,
        "customer_mobile": sale.customer_mobile,
        "subtotal": round(subtotal, 2),
        "total_mrp": round(total_mrp, 2),
        "total_saving": round(total_saving, 2),
        "gst_amount": round(gst_amount, 2),
        "discount_amount": round(discount_amount, 2),
        "final_amount": round(final_amount, 2),
        "payment_mode": sale.payment_mode,
        "cash_amount": round(cash_amount, 2),
        "online_amount": round(online_amount, 2),
        "credit_amount": round(credit_amount, 2),
        "amount_received": round(amount_received, 2),
        "change_return": round(change_return, 2),
        "loyalty_points_earned": round(loyalty_points_earned, 2),
        "loyalty_points_redeemed": round(loyalty_points_redeemed, 2),
        "loyalty_discount": round(loyalty_discount, 2),
        "loyalty_balance": round(loyalty_balance, 2) if loyalty_balance is not None else None,
        "loyalty_tier": loyalty_tier,
        "bill_date": sale.bill_date.strftime("%Y-%m-%d") if sale.bill_date else None,
        "items": sale_items,
    }



@app.get("/sales")
def get_sales(db: Session = Depends(get_db)):
    return db.query(models.Sale).order_by(models.Sale.id.desc()).all()


@app.post("/dealers")
def add_dealer(data: schemas.DealerCreate, db: Session = Depends(get_db)):
    dealer = models.Dealer(
        dealer_name=data.dealer_name, mobile=data.mobile, email=data.email,
        gst_number=data.gst_number, address=data.address,
        bill_amount=0,
    )
    db.add(dealer)
    db.commit()
    db.refresh(dealer)
    return dealer

@app.get("/dealers")
def get_dealers(db: Session = Depends(get_db)):
    dealers = db.query(models.Dealer).order_by(models.Dealer.dealer_name.asc()).all()
    result = []
    for dealer in dealers:
        new_bill_total = sum(to_float(b.bill_amount) for b in dealer.bills)
        legacy_bill_total = to_float(dealer.bill_amount) if not dealer.bills else 0
        bill_total = new_bill_total + legacy_bill_total
        paid = sum(to_float(p.paid_amount) for p in dealer.payments)
        result.append({
            "id": dealer.id, "dealer_name": dealer.dealer_name,
            "mobile": dealer.mobile, "email": dealer.email,
            "gst_number": dealer.gst_number, "address": dealer.address,
            "bill_amount": round(bill_total, 2), "paid_amount": round(paid, 2),
            "pending_amount": round(max(bill_total-paid, 0), 2),
            "bill_count": len(dealer.bills),
        })
    return result

@app.post("/dealer-bills")
def add_dealer_bill(data: schemas.DealerBillCreate, db: Session = Depends(get_db)):
    dealer = db.query(models.Dealer).filter(models.Dealer.id == data.dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    if data.bill_amount <= 0:
        raise HTTPException(status_code=400, detail="Bill amount must be greater than zero")
    bill_date = datetime.now()
    if data.bill_date:
        try: bill_date = datetime.strptime(data.bill_date, "%Y-%m-%d")
        except ValueError as exc: raise HTTPException(status_code=400, detail="Invalid bill date") from exc
    bill = models.DealerBill(dealer_id=data.dealer_id, bill_number=data.bill_number,
        bill_amount=data.bill_amount, bill_date=bill_date, note=data.note)
    db.add(bill); db.commit(); db.refresh(bill)
    return {"message":"Dealer bill saved", "id":bill.id}

@app.get("/dealers/{dealer_id}/ledger")
def dealer_ledger(dealer_id: int, db: Session = Depends(get_db)):
    dealer = db.query(models.Dealer).filter(models.Dealer.id == dealer_id).first()
    if not dealer: raise HTTPException(status_code=404, detail="Dealer not found")
    bills=[{"id":b.id,"bill_number":b.bill_number,"bill_amount":b.bill_amount,
      "bill_date":b.bill_date.isoformat() if b.bill_date else None,"note":b.note}
      for b in sorted(dealer.bills,key=lambda x:x.bill_date or datetime.min,reverse=True)]
    if not bills and to_float(dealer.bill_amount)>0:
        bills=[{"id":None,"bill_number":"Legacy bill","bill_amount":dealer.bill_amount,
          "bill_date":dealer.bill_date.isoformat() if dealer.bill_date else None,"note":"Migrated existing bill"}]
    payments=[{"id":p.id,"paid_amount":p.paid_amount,"payment_mode":p.payment_mode,
      "payment_date":p.payment_date.isoformat() if p.payment_date else None,
      "reference":p.reference,"note":p.note}
      for p in sorted(dealer.payments,key=lambda x:x.payment_date or datetime.min,reverse=True)]
    total_bills=sum(to_float(x["bill_amount"]) for x in bills)
    total_paid=sum(to_float(x["paid_amount"]) for x in payments)
    return {"dealer":{"id":dealer.id,"dealer_name":dealer.dealer_name,"mobile":dealer.mobile,
      "email":dealer.email,"gst_number":dealer.gst_number,"address":dealer.address},
      "summary":{"total_bills":round(total_bills,2),"total_paid":round(total_paid,2),
      "outstanding":round(max(total_bills-total_paid,0),2)},"bills":bills,"payments":payments}

@app.put("/dealer-bills/{bill_id}")
def update_dealer_bill(bill_id:int,data:schemas.DealerBillUpdate,db:Session=Depends(get_db)):
    bill=db.query(models.DealerBill).filter(models.DealerBill.id==bill_id).first()
    if not bill: raise HTTPException(status_code=404,detail="Dealer bill not found")
    if data.bill_amount<=0: raise HTTPException(status_code=400,detail="Bill amount must be greater than zero")
    bill.bill_number=data.bill_number; bill.bill_amount=data.bill_amount; bill.note=data.note
    if data.bill_date:
        try: bill.bill_date=datetime.strptime(data.bill_date,"%Y-%m-%d")
        except ValueError as exc: raise HTTPException(status_code=400,detail="Invalid bill date") from exc
    db.commit(); return {"message":"Dealer bill updated"}

@app.delete("/dealer-bills/{bill_id}")
def delete_dealer_bill(bill_id:int,db:Session=Depends(get_db)):
    bill=db.query(models.DealerBill).filter(models.DealerBill.id==bill_id).first()
    if not bill: raise HTTPException(status_code=404,detail="Dealer bill not found")
    db.delete(bill); db.commit(); return {"message":"Dealer bill deleted"}

@app.post("/dealer-payments")
def add_dealer_payment(data: schemas.DealerPaymentCreate, db: Session = Depends(get_db)):
    dealer=db.query(models.Dealer).filter(models.Dealer.id==data.dealer_id).first()
    if not dealer: raise HTTPException(status_code=404,detail="Dealer not found")
    total_bills=sum(to_float(b.bill_amount) for b in dealer.bills) or to_float(dealer.bill_amount)
    paid=sum(to_float(p.paid_amount) for p in dealer.payments)
    outstanding=max(total_bills-paid,0)
    if data.paid_amount<=0: raise HTTPException(status_code=400,detail="Payment amount must be greater than zero")
    if data.paid_amount>outstanding: raise HTTPException(status_code=400,detail=f"Payment cannot exceed outstanding amount of {outstanding:.2f}")
    payment_date=datetime.now()
    if data.payment_date:
        try: payment_date=datetime.strptime(data.payment_date,"%Y-%m-%d")
        except ValueError as exc: raise HTTPException(status_code=400,detail="Invalid payment date") from exc
    payment=models.DealerPayment(dealer_id=data.dealer_id,paid_amount=data.paid_amount,
      payment_mode=data.payment_mode,payment_date=payment_date,reference=data.reference,note=data.note)
    db.add(payment)

    # Allocate supplier payments against the oldest open purchases so
    # purchase-level outstanding values remain aligned with the supplier ledger.
    remaining_payment = to_float(data.paid_amount)
    open_purchases = (
        db.query(models.Purchase)
        .filter(
            models.Purchase.dealer_id == data.dealer_id,
            models.Purchase.outstanding_amount > 0,
        )
        .order_by(models.Purchase.purchase_date.asc(), models.Purchase.id.asc())
        .all()
    )

    for purchase in open_purchases:
        if remaining_payment <= 0:
            break

        open_amount = max(to_float(purchase.outstanding_amount), 0)
        allocation = min(open_amount, remaining_payment)

        purchase.paid_amount = min(
            to_float(purchase.total_amount),
            to_float(purchase.paid_amount) + allocation,
        )
        purchase.outstanding_amount = max(open_amount - allocation, 0)
        remaining_payment -= allocation

    db.commit(); db.refresh(payment)
    return {"message":"Dealer payment added successfully","payment_id":payment.id}


@app.get("/reports/stock")
def stock_report(db: Session = Depends(get_db)):
    items = db.query(models.Item).order_by(models.Item.id.desc()).all()

    return [
        {
            "id": item.id,
            "item_name": item.item_name,
            "barcode": item.barcode,
            "purchase_price": item.purchase_price,
            "mrp": item.mrp,
            "sale_price": item.sale_price,
            "gst_percent": item.gst_percent,
            "stock": item.stock,
            "minimum_stock": item.minimum_stock,
            "batch_number": item.batch_number,
            "manufacturing_date": item.manufacturing_date.isoformat()
            if item.manufacturing_date
            else None,
            "expiry_date": item.expiry_date.isoformat()
            if item.expiry_date
            else None,
            "expiry_alert_days": item.expiry_alert_days,
        }
        for item in items
    ]


@app.get("/reports/sales")
def sales_report(from_date: str | None = None, to_date: str | None = None, payment_mode: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Sale)
    try:
        if from_date:
            query = query.filter(models.Sale.bill_date >= datetime.strptime(from_date, "%Y-%m-%d"))
        if to_date:
            query = query.filter(models.Sale.bill_date <= datetime.strptime(to_date + " 23:59:59", "%Y-%m-%d %H:%M:%S"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid report date") from exc
    if payment_mode and payment_mode != "All":
        query = query.filter(models.Sale.payment_mode == payment_mode)
    sales = query.order_by(models.Sale.bill_date.desc(), models.Sale.id.desc()).all()
    def total_for(mode=None):
        return sum(to_float(s.final_amount) for s in sales if mode is None or s.payment_mode == mode)
    rows = [{
        "id": s.id, "invoice_no": s.invoice_no, "customer_name": s.customer_name,
        "customer_mobile": s.customer_mobile, "payment_mode": s.payment_mode,
        "subtotal": s.subtotal, "gst_amount": s.gst_amount, "final_amount": s.final_amount,
        "bill_date": (s.bill_date or s.created_at).strftime("%Y-%m-%d") if (s.bill_date or s.created_at) else None
    } for s in sales]
    return {
        "total_sales": total_for(), "cash_sales": total_for("Cash"),
        "online_sales": total_for("Online"), "credit_sales": total_for("Credit"),
        "total_gst": sum(to_float(s.gst_amount) for s in sales),
        "total_bills": len(sales), "sales": rows
    }

    
@app.get("/dashboard")
def get_dashboard(
    from_date: str | None = None,
    to_date: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Sale)

    if from_date:
        try:
            start_date = datetime.strptime(from_date, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid from_date format") from exc
        query = query.filter(models.Sale.created_at >= start_date)

    if to_date:
        try:
            end_date = datetime.strptime(to_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid to_date format") from exc
        query = query.filter(models.Sale.created_at <= end_date)

    sales = query.order_by(models.Sale.created_at.asc()).all()

    total_sales = sum(to_float(s.final_amount) for s in sales)
    cash_sales = sum(to_float(s.final_amount) for s in sales if getattr(s, "payment_mode", None) == "Cash")
    online_sales = sum(to_float(s.final_amount) for s in sales if getattr(s, "payment_mode", None) == "Online")
    credit_sales = sum(to_float(s.final_amount) for s in sales if getattr(s, "payment_mode", None) == "Credit")
    customer_payments = db.query(models.CustomerPayment).all()
    customer_credit_outstanding = max(
        credit_sales - sum(to_float(payment.paid_amount) for payment in customer_payments),
        0,
    )

    dealers = db.query(models.Dealer).all()
    dealer_pending = 0.0
    for dealer in dealers:
        payments = getattr(dealer, "payments", []) or []
        paid = sum(to_float(p.paid_amount) for p in payments)
        dealer_pending += max(to_float(dealer.bill_amount) - paid, 0)

    trend_map: dict[str, float] = {}
    for sale in sales:
        key = sale.created_at.strftime("%Y-%m-%d") if sale.created_at else "Unknown"
        trend_map[key] = trend_map.get(key, 0.0) + to_float(sale.final_amount)

    recent_sales = list(reversed(sales))[:6]
    low_stock_items = (
        db.query(models.Item)
        .filter(models.Item.stock <= 10)
        .order_by(models.Item.stock.asc(), models.Item.item_name.asc())
        .limit(6)
        .all()
    )

    return {
        "total_sales": round(total_sales, 2),
        "cash_sales": round(cash_sales, 2),
        "online_sales": round(online_sales, 2),
        "credit_sales": round(credit_sales, 2),
        "customer_credit_outstanding": round(customer_credit_outstanding, 2),
        "dealer_pending": round(dealer_pending, 2),
        "total_bills": len(sales),
        "total_customers": db.query(models.Customer).count(),
        "total_items": db.query(models.Item).count(),
        "low_stock_count": db.query(models.Item).filter(models.Item.stock <= 10).count(),
        "sales_trend": [
            {"date": date, "amount": round(amount, 2)}
            for date, amount in trend_map.items()
        ],
        "recent_sales": [
            {
                "id": sale.id,
                "invoice_no": sale.invoice_no,
                "customer_name": sale.customer_name or "Walk-in Customer",
                "payment_mode": sale.payment_mode,
                "final_amount": round(to_float(sale.final_amount), 2),
                "created_at": sale.created_at.isoformat() if sale.created_at else None,
            }
            for sale in recent_sales
        ],
        "low_stock_items": [
            {
                "id": item.id,
                "item_name": item.item_name,
                "barcode": item.barcode,
                "stock": int(item.stock or 0),
            }
            for item in low_stock_items
        ],
    }


@app.put("/items/bulk-update")
def bulk_update_items(
    data: schemas.BulkItemUpdate,
    db: Session = Depends(get_db),
):
    changed = 0

    try:
        for row in data.items:
            item = (
                db.query(models.Item)
                .filter(models.Item.id == row.id)
                .first()
            )

            if not item:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {row.id} not found",
                )

            barcode = (
                row.barcode.strip()
                if row.barcode is not None
                else item.barcode
            )

            duplicate = (
                db.query(models.Item)
                .filter(
                    models.Item.barcode == barcode,
                    models.Item.id != item.id,
                )
                .first()
            )

            if duplicate:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate barcode: {barcode}",
                )

            purchase = (
                item.purchase_price
                if row.purchase_price is None
                else row.purchase_price
            )
            mrp = item.mrp if row.mrp is None else row.mrp
            sale = (
                item.sale_price
                if row.sale_price is None
                else row.sale_price
            )
            gst = (
                item.gst_percent
                if row.gst_percent is None
                else row.gst_percent
            )
            minimum_stock = (
                item.minimum_stock
                if row.minimum_stock is None
                else row.minimum_stock
            )
            expiry_alert_days = (
                item.expiry_alert_days
                if row.expiry_alert_days is None
                else row.expiry_alert_days
            )
            manufacturing_date = (
                item.manufacturing_date
                if row.manufacturing_date is None
                else normalize_date_value(row.manufacturing_date)
            )
            expiry_date = (
                item.expiry_date
                if row.expiry_date is None
                else normalize_date_value(row.expiry_date)
            )

            previous_stock = int(item.stock or 0)
            adjustment = int(row.stock_adjustment or 0)
            new_stock = previous_stock + adjustment

            validate_item_values(
                row.item_name
                if row.item_name is not None
                else item.item_name,
                barcode,
                purchase,
                mrp,
                sale,
                gst,
                new_stock,
                minimum_stock,
                manufacturing_date,
                expiry_date,
                expiry_alert_days,
            )

            item.item_name = (
                row.item_name.strip()
                if row.item_name is not None
                else item.item_name
            )
            item.barcode = barcode
            item.purchase_price = purchase
            item.mrp = mrp
            item.sale_price = sale
            item.gst_percent = gst
            item.minimum_stock = minimum_stock
            item.batch_number = (
                row.batch_number
                if row.batch_number is not None
                else item.batch_number
            )
            item.manufacturing_date = manufacturing_date
            item.expiry_date = expiry_date
            item.expiry_alert_days = expiry_alert_days

            if adjustment:
                reason = str(row.adjustment_reason or "").strip()
                if not reason:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Reason is required for {item.item_name}",
                    )

                item.stock = new_stock
                db.add(
                    models.StockAdjustment(
                        item_id=item.id,
                        previous_stock=previous_stock,
                        adjustment=adjustment,
                        new_stock=new_stock,
                        reason=reason,
                    )
                )
                add_inventory_movement(
                    db,
                    item_id=item.id,
                    movement_type="ADJUSTMENT",
                    quantity_change=adjustment,
                    previous_stock=previous_stock,
                    new_stock=new_stock,
                    reference_type="bulk_stock_adjustment",
                    reference_number=f"BULK-{item.id}",
                    reason=reason,
                )

            changed += 1

        db.commit()
        return {
            "message": f"{changed} products updated successfully",
            "updated": changed,
        }

    except Exception:
        db.rollback()
        raise


@app.post("/items/{item_id}/stock-adjustments")
def create_stock_adjustment(
    item_id: int,
    data: schemas.StockAdjustmentCreate,
    db: Session = Depends(get_db),
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    adjustment = int(data.adjustment or 0)
    reason = str(data.reason or "").strip()

    if adjustment == 0:
        raise HTTPException(
            status_code=400,
            detail="Stock adjustment cannot be zero",
        )

    if not reason:
        raise HTTPException(
            status_code=400,
            detail="Adjustment reason is required",
        )

    previous_stock = int(item.stock or 0)
    new_stock = previous_stock + adjustment

    if new_stock < 0:
        raise HTTPException(
            status_code=400,
            detail="Updated stock cannot be negative",
        )

    item.stock = new_stock

    history = models.StockAdjustment(
        item_id=item.id,
        previous_stock=previous_stock,
        adjustment=adjustment,
        new_stock=new_stock,
        reason=reason,
    )

    db.add(history)
    add_inventory_movement(
        db,
        item_id=item.id,
        movement_type="ADJUSTMENT",
        quantity_change=adjustment,
        previous_stock=previous_stock,
        new_stock=new_stock,
        reference_type="stock_adjustment",
        reference_number=f"ADJ-{item.id}",
        reason=reason,
    )
    db.commit()
    db.refresh(history)
    db.refresh(item)

    return {
        "message": "Stock adjusted successfully",
        "item": {
            "id": item.id,
            "item_name": item.item_name,
            "stock": item.stock,
        },
        "adjustment": {
            "id": history.id,
            "previous_stock": history.previous_stock,
            "adjustment": history.adjustment,
            "new_stock": history.new_stock,
            "reason": history.reason,
            "created_at": history.created_at.isoformat()
            if history.created_at
            else None,
        },
    }


@app.get("/items/{item_id}/stock-adjustments")
def get_stock_adjustment_history(
    item_id: int,
    db: Session = Depends(get_db),
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    records = (
        db.query(models.StockAdjustment)
        .filter(models.StockAdjustment.item_id == item_id)
        .order_by(
            models.StockAdjustment.created_at.desc(),
            models.StockAdjustment.id.desc(),
        )
        .all()
    )

    return {
        "item": {
            "id": item.id,
            "item_name": item.item_name,
            "barcode": item.barcode,
            "current_stock": int(item.stock or 0),
        },
        "history": [
            {
                "id": record.id,
                "previous_stock": record.previous_stock,
                "adjustment": record.adjustment,
                "new_stock": record.new_stock,
                "reason": record.reason,
                "created_at": record.created_at.isoformat()
                if record.created_at
                else None,
            }
            for record in records
        ],
    }


@app.put("/items/{item_id}")
def update_item(
    item_id: int,
    data: schemas.ItemUpdate,
    db: Session = Depends(get_db),
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    validate_item_values(
        data.item_name,
        data.barcode,
        data.purchase_price,
        data.mrp,
        data.sale_price,
        data.gst_percent,
        data.stock,
        data.minimum_stock,
        data.manufacturing_date,
        data.expiry_date,
        data.expiry_alert_days,
    )

    normalized_barcode = data.barcode.strip()

    duplicate = (
        db.query(models.Item)
        .filter(
            models.Item.barcode == normalized_barcode,
            models.Item.id != item_id,
        )
        .first()
    )

    if duplicate:
        raise HTTPException(status_code=400, detail="Barcode already exists")

    item_data = data.dict()
    item_data["item_name"] = data.item_name.strip()
    item_data["barcode"] = normalized_barcode
    item_data["manufacturing_date"] = normalize_date_value(
        data.manufacturing_date
    )
    item_data["expiry_date"] = normalize_date_value(data.expiry_date)

    for key, value in item_data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@app.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    used = (
        db.query(models.SaleItem)
        .filter(models.SaleItem.item_id == item_id)
        .first()
    )

    if used:
        raise HTTPException(
            status_code=400,
            detail="Item is used in sales and cannot be deleted",
        )

    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}


@app.post("/items/import")
def import_items(data: schemas.ItemImport, db: Session = Depends(get_db)):
    created = 0
    skipped = []
    failed = []

    try:
        for index, row in enumerate(data.items, start=2):
            try:
                validate_item_values(
                    row.item_name,
                    row.barcode,
                    row.purchase_price,
                    row.mrp,
                    row.sale_price,
                    row.gst_percent,
                    row.stock,
                    row.minimum_stock,
                    row.manufacturing_date,
                    row.expiry_date,
                    row.expiry_alert_days,
                )

                normalized_barcode = row.barcode.strip()

                existing = (
                    db.query(models.Item)
                    .filter(models.Item.barcode == normalized_barcode)
                    .first()
                )

                if existing:
                    skipped.append(normalized_barcode)
                    continue

                item_data = row.dict()
                item_data["item_name"] = row.item_name.strip()
                item_data["barcode"] = normalized_barcode
                item_data["manufacturing_date"] = normalize_date_value(
                    row.manufacturing_date
                )
                item_data["expiry_date"] = normalize_date_value(
                    row.expiry_date
                )

                db.add(models.Item(**item_data))
                created += 1

            except HTTPException as exc:
                failed.append(
                    {
                        "row": index,
                        "barcode": row.barcode,
                        "error": exc.detail,
                    }
                )

        db.commit()
        return {
            "message": f"{created} items imported",
            "created": created,
            "skipped": skipped,
            "failed": failed,
        }

    except Exception:
        db.rollback()
        raise



@app.get("/loyalty/settings")
def read_loyalty_settings(db: Session = Depends(get_db)):
    settings = get_loyalty_settings(db)

    return {
        "enabled": bool(settings.enabled),
        "earn_amount": round(to_float(settings.earn_amount), 2),
        "points_per_earn_amount": round(to_float(settings.points_per_earn_amount), 2),
        "point_value": round(to_float(settings.point_value), 2),
        "minimum_redeem_points": round(to_float(settings.minimum_redeem_points), 2),
        "max_redeem_percent": round(to_float(settings.max_redeem_percent), 2),
        "silver_threshold": round(to_float(settings.silver_threshold), 2),
        "gold_threshold": round(to_float(settings.gold_threshold), 2),
        "platinum_threshold": round(to_float(settings.platinum_threshold), 2),
    }


@app.put("/loyalty/settings")
def save_loyalty_settings(
    data: schemas.LoyaltySettingsUpdate,
    db: Session = Depends(get_db),
):
    settings = get_loyalty_settings(db)

    numeric_values = [
        data.earn_amount,
        data.points_per_earn_amount,
        data.point_value,
        data.minimum_redeem_points,
        data.max_redeem_percent,
        data.silver_threshold,
        data.gold_threshold,
        data.platinum_threshold,
    ]

    if any(to_float(value) < 0 for value in numeric_values):
        raise HTTPException(status_code=400, detail="Loyalty settings cannot be negative")

    if data.earn_amount <= 0:
        raise HTTPException(status_code=400, detail="Earn amount must be greater than zero")

    if data.point_value <= 0:
        raise HTTPException(status_code=400, detail="Point value must be greater than zero")

    if not 0 <= data.max_redeem_percent <= 100:
        raise HTTPException(status_code=400, detail="Maximum redemption percentage must be between 0 and 100")

    if not (
        data.silver_threshold <= data.gold_threshold <= data.platinum_threshold
    ):
        raise HTTPException(
            status_code=400,
            detail="Tier thresholds must be Silver ≤ Gold ≤ Platinum",
        )

    settings.enabled = 1 if data.enabled else 0
    settings.earn_amount = data.earn_amount
    settings.points_per_earn_amount = data.points_per_earn_amount
    settings.point_value = data.point_value
    settings.minimum_redeem_points = data.minimum_redeem_points
    settings.max_redeem_percent = data.max_redeem_percent
    settings.silver_threshold = data.silver_threshold
    settings.gold_threshold = data.gold_threshold
    settings.platinum_threshold = data.platinum_threshold

    db.commit()

    return {"message": "Loyalty settings updated successfully"}


@app.get("/customers/{customer_id}/loyalty")
def customer_loyalty_summary(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    settings = get_loyalty_settings(db)
    sales = (
        customer_sales_query(db, customer)
        .order_by(models.Sale.bill_date.desc(), models.Sale.id.desc())
        .all()
    )

    lifetime_spend = sum(to_float(row.final_amount) for row in sales)
    tier = loyalty_tier_for_spend(lifetime_spend, settings)

    if customer.loyalty_tier != tier:
        customer.loyalty_tier = tier
        db.commit()

    transactions = (
        db.query(models.LoyaltyTransaction)
        .filter(models.LoyaltyTransaction.customer_id == customer.id)
        .order_by(models.LoyaltyTransaction.created_at.desc(), models.LoyaltyTransaction.id.desc())
        .limit(50)
        .all()
    )

    next_tier = None
    amount_to_next_tier = 0.0

    if tier == "Regular":
        next_tier = "Silver"
        amount_to_next_tier = max(to_float(settings.silver_threshold) - lifetime_spend, 0)
    elif tier == "Silver":
        next_tier = "Gold"
        amount_to_next_tier = max(to_float(settings.gold_threshold) - lifetime_spend, 0)
    elif tier == "Gold":
        next_tier = "Platinum"
        amount_to_next_tier = max(to_float(settings.platinum_threshold) - lifetime_spend, 0)

    return {
        "customer_id": customer.id,
        "customer_name": customer.customer_name,
        "mobile": customer.mobile,
        "points": round(to_float(customer.loyalty_points), 2),
        "tier": tier,
        "member_since": customer.loyalty_member_since.isoformat() if customer.loyalty_member_since else None,
        "lifetime_spend": round(lifetime_spend, 2),
        "total_bills": len(sales),
        "last_purchase": sales[0].bill_date.isoformat() if sales else None,
        "next_tier": next_tier,
        "amount_to_next_tier": round(amount_to_next_tier, 2),
        "redemption_value": round(
            to_float(customer.loyalty_points) * to_float(settings.point_value),
            2,
        ),
        "transactions": [
            {
                "id": row.id,
                "sale_id": row.sale_id,
                "transaction_type": row.transaction_type,
                "points": round(to_float(row.points), 2),
                "balance_after": round(to_float(row.balance_after), 2),
                "note": row.note,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in transactions
        ],
    }


@app.post("/customers/{customer_id}/loyalty-adjustment")
def loyalty_adjustment(
    customer_id: int,
    data: schemas.LoyaltyAdjustmentCreate,
    db: Session = Depends(get_db),
):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    adjustment = to_float(data.points)

    if adjustment == 0:
        raise HTTPException(status_code=400, detail="Adjustment points cannot be zero")

    current = max(0.0, to_float(customer.loyalty_points))
    next_balance = current + adjustment

    if next_balance < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Adjustment cannot reduce balance below zero. Current balance: {current:.2f}",
        )

    customer.loyalty_points = next_balance

    db.add(
        models.LoyaltyTransaction(
            customer_id=customer.id,
            transaction_type="Adjustment",
            points=adjustment,
            balance_after=next_balance,
            note=data.note or "Manual loyalty adjustment",
        )
    )

    db.commit()

    return {
        "message": "Loyalty points adjusted successfully",
        "points": round(next_balance, 2),
    }


@app.get("/loyalty/dashboard")
def loyalty_dashboard(db: Session = Depends(get_db)):
    customers = db.query(models.Customer).order_by(models.Customer.customer_name.asc()).all()
    settings = get_loyalty_settings(db)

    rows = []

    for customer in customers:
        lifetime_spend = customer_lifetime_spend(db, customer)
        tier = loyalty_tier_for_spend(lifetime_spend, settings)

        rows.append({
            "id": customer.id,
            "customer_name": customer.customer_name,
            "mobile": customer.mobile,
            "points": round(to_float(customer.loyalty_points), 2),
            "tier": tier,
            "lifetime_spend": round(lifetime_spend, 2),
        })

    return {
        "members": len(customers),
        "points_outstanding": round(sum(row["points"] for row in rows), 2),
        "platinum_members": sum(1 for row in rows if row["tier"] == "Platinum"),
        "top_members": sorted(
            rows,
            key=lambda row: (row["lifetime_spend"], row["points"]),
            reverse=True,
        )[:10],
    }


@app.get("/customers/credit-ledger")
def customer_credit_ledger(db: Session = Depends(get_db)):
    customers = db.query(models.Customer).order_by(models.Customer.customer_name.asc()).all()
    result = []

    loyalty_settings = get_loyalty_settings(db)

    for customer in customers:
        lifetime_spend = customer_lifetime_spend(db, customer)
        current_loyalty_tier = loyalty_tier_for_spend(
            lifetime_spend,
            loyalty_settings,
        )

        if customer.loyalty_tier != current_loyalty_tier:
            customer.loyalty_tier = current_loyalty_tier

        sales_query = db.query(models.Sale).filter(models.Sale.payment_mode == "Credit")
        if customer.mobile:
            sales_query = sales_query.filter(models.Sale.customer_mobile == customer.mobile)
        else:
            sales_query = sales_query.filter(models.Sale.customer_name == customer.customer_name)

        credit_sales = sales_query.order_by(models.Sale.bill_date.desc(), models.Sale.id.desc()).all()
        gross_credit = sum(to_float(s.final_amount) for s in credit_sales)
        credit_sale_ids = [s.id for s in credit_sales]
        returned_credit = (
            sum(
                to_float(r.return_amount)
                for r in db.query(models.SalesReturn)
                .filter(models.SalesReturn.sale_id.in_(credit_sale_ids))
                .all()
            )
            if credit_sale_ids
            else 0.0
        )
        credit = max(gross_credit - returned_credit, 0)
        paid = sum(to_float(p.paid_amount) for p in customer.payments)
        outstanding = max(credit - paid, 0)
        latest_purchase = credit_sales[0].bill_date if credit_sales else None

        result.append({
            "id": customer.id,
            "customer_name": customer.customer_name,
            "mobile": customer.mobile,
            "address": customer.address,
            "loyalty_points": round(to_float(customer.loyalty_points), 2),
            "loyalty_tier": current_loyalty_tier,
            "loyalty_member_since": customer.loyalty_member_since.isoformat() if customer.loyalty_member_since else None,
            "purchase_date": latest_purchase.isoformat() if latest_purchase else None,
            "credit_amount": round(credit, 2),
            "paid_amount": round(paid, 2),
            "pending_amount": round(outstanding, 2),
            "credit_purchases": [{
                "id": sale.id,
                "invoice_no": sale.invoice_no,
                "purchase_date": sale.bill_date.isoformat() if sale.bill_date else None,
                "credit_amount": round(to_float(sale.final_amount), 2),
            } for sale in credit_sales],
            "payments": [{
                "id": payment.id,
                "paid_amount": round(to_float(payment.paid_amount), 2),
                "payment_mode": payment.payment_mode,
                "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
                "reference": getattr(payment, "reference", None),
                "note": payment.note,
            } for payment in sorted(
                customer.payments,
                key=lambda item: item.payment_date or datetime.min,
                reverse=True,
            )],
        })

    db.commit()
    return result


@app.post("/customer-payments")
def add_customer_payment(data: schemas.CustomerPaymentCreate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if data.paid_amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

    sales_query = db.query(models.Sale).filter(models.Sale.payment_mode == "Credit")
    if customer.mobile:
        sales_query = sales_query.filter(models.Sale.customer_mobile == customer.mobile)
    else:
        sales_query = sales_query.filter(models.Sale.customer_name == customer.customer_name)

    credit_sales_for_payment = sales_query.all()
    total_credit = sum(to_float(s.final_amount) for s in credit_sales_for_payment)
    credit_sale_ids = [s.id for s in credit_sales_for_payment]
    returned_credit = (
        sum(
            to_float(r.return_amount)
            for r in db.query(models.SalesReturn)
            .filter(models.SalesReturn.sale_id.in_(credit_sale_ids))
            .all()
        )
        if credit_sale_ids
        else 0.0
    )
    total_credit = max(total_credit - returned_credit, 0)
    total_paid = sum(to_float(p.paid_amount) for p in customer.payments)
    outstanding = max(total_credit - total_paid, 0)

    if outstanding <= 0:
        raise HTTPException(status_code=400, detail="This customer has no outstanding credit amount")
    if data.paid_amount > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Payment cannot exceed outstanding amount of {outstanding:.2f}",
        )

    payment_date = datetime.now()
    if data.payment_date:
        try:
            payment_date = datetime.strptime(data.payment_date, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid payment date") from exc

    payment = models.CustomerPayment(
        customer_id=data.customer_id,
        paid_amount=data.paid_amount,
        payment_mode=data.payment_mode,
        payment_date=payment_date,
        reference=data.reference,
        note=data.note,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return {
        "message": "Customer credit payment recorded successfully",
        "payment_id": payment.id,
        "paid_amount": round(to_float(payment.paid_amount), 2),
        "updated_paid_amount": round(total_paid + to_float(payment.paid_amount), 2),
        "updated_outstanding_amount": round(outstanding - to_float(payment.paid_amount), 2),
    }


@app.delete("/dealers/{dealer_id}")
def delete_dealer(dealer_id: int, db: Session = Depends(get_db)):
    dealer = db.query(models.Dealer).filter(models.Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    db.delete(dealer)
    db.commit()
    return {"message": "Dealer deleted successfully"}


@app.get("/dealers/{dealer_id}/payments")
def dealer_payment_history(dealer_id: int, db: Session = Depends(get_db)):
    dealer = db.query(models.Dealer).filter(models.Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return [{
        "id": p.id,
        "paid_amount": p.paid_amount,
        "payment_mode": p.payment_mode,
        "payment_date": p.payment_date.isoformat() if p.payment_date else None,
        "reference": getattr(p, "reference", None),
        "note": getattr(p, "note", None),
    } for p in sorted(dealer.payments, key=lambda x: x.payment_date or datetime.min, reverse=True)]




def _get_ai_settings(db: Session):
    row=db.query(models.AISettings).order_by(models.AISettings.id.asc()).first()
    if not row:
        row=models.AISettings(enabled=0,provider="openai",model="gpt-5-mini")
        db.add(row); db.commit(); db.refresh(row)
    return row

@app.get("/ai/settings")
def get_ai_settings(db: Session=Depends(get_db)):
    row=_get_ai_settings(db)
    key=decrypt_key(row.encrypted_api_key) if row.encrypted_api_key else ""
    return {
        "enabled":bool(row.enabled),"provider":row.provider,"model":row.model or "",
        "api_key_configured":bool(key),"api_key_masked":mask_key(key),
        "base_url":row.base_url or "http://localhost:11434","ollama_mode":row.ollama_mode or "local"
    }

@app.put("/ai/settings")
def save_ai_settings(data: schemas.AISettingsUpdate, db: Session=Depends(get_db)):
    provider=(data.provider or "").lower()
    if provider not in {"openai","gemini","claude","ollama"}:
        raise HTTPException(status_code=400,detail="Unsupported AI provider")
    row=_get_ai_settings(db)
    row.enabled=1 if data.enabled else 0
    row.provider=provider; row.model=data.model or None
    row.base_url=data.base_url or None; row.ollama_mode=data.ollama_mode or "local"
    if data.api_key is not None and data.api_key.strip():
        row.encrypted_api_key=encrypt_key(data.api_key.strip())
    db.commit()
    return {"message":"AI settings saved"}

@app.post("/ai/test")
def test_ai_connection(db: Session=Depends(get_db)):
    row=_get_ai_settings(db)
    test_provider(row)
    return {"message":f"{row.provider.title()} connection successful"}

@app.post("/ai/extract-purchase-bill")
async def ai_extract_purchase_bill(file: UploadFile=File(...), db: Session=Depends(get_db)):
    row=_get_ai_settings(db)
    if not row.enabled:
        raise HTTPException(status_code=400,detail="AI is disabled. Enable it in Settings → AI.")
    mime=(file.content_type or "").lower()
    if mime not in {"image/jpeg","image/png","application/pdf"}:
        raise HTTPException(status_code=400,detail="Only JPG, PNG and PDF bills are supported")
    raw=await file.read()
    if not raw: raise HTTPException(status_code=400,detail="Uploaded bill is empty")
    if len(raw)>20*1024*1024: raise HTTPException(status_code=400,detail="Bill file must be 20 MB or smaller")
    data=extract_bill(row,raw,mime)
    return {"provider":row.provider,"model":row.model,"extracted":data}

@app.get("/purchases")
def get_purchases(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Purchase)
        .order_by(models.Purchase.purchase_date.desc(), models.Purchase.id.desc())
        .all()
    )

    return [
        {
            "id": row.id,
            "dealer_id": row.dealer_id,
            "dealer_name": row.dealer.dealer_name if row.dealer else "-",
            "invoice_number": row.invoice_number,
            "purchase_date": row.purchase_date.strftime("%Y-%m-%d") if row.purchase_date else None,
            "subtotal": round(to_float(row.subtotal), 2),
            "gst_amount": round(to_float(row.gst_amount), 2),
            "discount_amount": round(to_float(row.discount_amount), 2),
            "freight_amount": round(to_float(row.freight_amount), 2),
            "round_off": round(to_float(row.round_off), 2),
            "total_amount": round(to_float(row.total_amount), 2),
            "paid_amount": round(to_float(row.paid_amount), 2),
            "outstanding_amount": round(to_float(row.outstanding_amount), 2),
            "payment_mode": row.payment_mode,
            "item_count": len(row.items),
            "note": row.note,
        }
        for row in rows
    ]


@app.get("/purchases/dashboard")
def purchase_dashboard(db: Session = Depends(get_db)):
    purchases = db.query(models.Purchase).all()
    returns = db.query(models.PurchaseReturn).all()

    purchase_total = sum(to_float(row.total_amount) for row in purchases)
    paid_total = sum(to_float(row.paid_amount) for row in purchases)
    outstanding_total = sum(to_float(row.outstanding_amount) for row in purchases)
    return_total = sum(to_float(row.return_amount) for row in returns)

    return {
        "purchase_count": len(purchases),
        "purchase_total": round(purchase_total, 2),
        "paid_total": round(paid_total, 2),
        "outstanding_total": round(outstanding_total, 2),
        "return_total": round(return_total, 2),
        "net_purchase": round(max(purchase_total - return_total, 0), 2),
    }


@app.get("/purchases/{purchase_id}")
def get_purchase_detail(purchase_id: int, db: Session = Depends(get_db)):
    purchase = (
        db.query(models.Purchase)
        .filter(models.Purchase.id == purchase_id)
        .first()
    )

    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    return {
        "id": purchase.id,
        "dealer_id": purchase.dealer_id,
        "dealer_name": purchase.dealer.dealer_name if purchase.dealer else "-",
        "invoice_number": purchase.invoice_number,
        "purchase_date": purchase.purchase_date.strftime("%Y-%m-%d") if purchase.purchase_date else None,
        "subtotal": round(to_float(purchase.subtotal), 2),
        "gst_amount": round(to_float(purchase.gst_amount), 2),
        "discount_amount": round(to_float(purchase.discount_amount), 2),
        "freight_amount": round(to_float(purchase.freight_amount), 2),
        "round_off": round(to_float(purchase.round_off), 2),
        "total_amount": round(to_float(purchase.total_amount), 2),
        "paid_amount": round(to_float(purchase.paid_amount), 2),
        "outstanding_amount": round(to_float(purchase.outstanding_amount), 2),
        "payment_mode": purchase.payment_mode,
        "note": purchase.note,
        "items": [
            {
                "id": row.id,
                "item_id": row.item_id,
                "item_name": row.item_name,
                "quantity": row.quantity,
                "returned_quantity": row.returned_quantity or 0,
                "available_to_return": max(
                    int(row.quantity or 0) - int(row.returned_quantity or 0),
                    0,
                ),
                "purchase_price": round(to_float(row.purchase_price), 2),
                "mrp": round(to_float(row.mrp), 2),
                "sale_price": round(to_float(row.sale_price), 2),
                "gst_percent": round(to_float(row.gst_percent), 2),
                "taxable_amount": round(to_float(row.taxable_amount), 2),
                "gst_amount": round(to_float(row.gst_amount), 2),
                "line_total": round(to_float(row.line_total), 2),
                "batch_number": row.batch_number,
                "manufacturing_date": row.manufacturing_date.isoformat() if row.manufacturing_date else None,
                "expiry_date": row.expiry_date.isoformat() if row.expiry_date else None,
                "margin_amount": round(
                    max(to_float(row.sale_price) - to_float(row.purchase_price), 0),
                    2,
                ),
                "margin_percent": round(
                    (
                        max(to_float(row.sale_price) - to_float(row.purchase_price), 0)
                        / to_float(row.sale_price)
                        * 100
                    )
                    if to_float(row.sale_price) > 0
                    else 0,
                    2,
                ),
            }
            for row in purchase.items
        ],
    }


@app.post("/purchases")
def create_purchase(data: schemas.PurchaseCreate, db: Session = Depends(get_db)):
    dealer = (
        db.query(models.Dealer)
        .filter(models.Dealer.id == data.dealer_id)
        .first()
    )

    if not dealer:
        raise HTTPException(status_code=404, detail="Supplier / dealer not found")

    if not str(data.invoice_number or "").strip():
        raise HTTPException(status_code=400, detail="Supplier invoice number is required")

    if not data.items:
        raise HTTPException(status_code=400, detail="Add at least one purchase item")

    duplicate = (
        db.query(models.Purchase)
        .filter(
            models.Purchase.dealer_id == data.dealer_id,
            models.Purchase.invoice_number == str(data.invoice_number).strip(),
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=400,
            detail="This supplier invoice number already exists for the selected supplier",
        )

    subtotal = 0.0
    gst_amount = 0.0
    purchase_lines = []

    for line in data.items:
        item = db.query(models.Item).filter(models.Item.id == line.item_id).first()

        if not item:
            raise HTTPException(status_code=404, detail=f"Item {line.item_id} not found")

        qty = int(line.quantity or 0)
        purchase_price = max(to_float(line.purchase_price), 0)

        if qty <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Quantity must be greater than zero for {item.item_name}",
            )

        if purchase_price <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Purchase price must be greater than zero for {item.item_name}",
            )

        gst_percent = max(
            0.0,
            to_float(line.gst_percent if line.gst_percent is not None else item.gst_percent),
        )
        taxable = purchase_price * qty
        line_gst = taxable * gst_percent / 100
        line_total = taxable + line_gst

        subtotal += taxable
        gst_amount += line_gst

        purchase_lines.append(
            {
                "item": item,
                "quantity": qty,
                "purchase_price": purchase_price,
                "mrp": to_float(line.mrp if line.mrp is not None else item.mrp),
                "sale_price": to_float(
                    line.sale_price if line.sale_price is not None else item.sale_price
                ),
                "gst_percent": gst_percent,
                "taxable_amount": taxable,
                "gst_amount": line_gst,
                "line_total": line_total,
                "batch_number": line.batch_number,
                "manufacturing_date": line.manufacturing_date,
                "expiry_date": line.expiry_date,
            }
        )

    discount = max(0.0, min(to_float(data.discount_amount), subtotal + gst_amount))
    freight = max(0.0, to_float(data.freight_amount))
    round_off = to_float(data.round_off)
    total_amount = max(subtotal + gst_amount - discount + freight + round_off, 0)

    paid_amount = max(0.0, min(to_float(data.paid_amount), total_amount))
    outstanding = max(total_amount - paid_amount, 0)

    purchase_date = datetime.combine(data.purchase_date, datetime.min.time())

    purchase = models.Purchase(
        dealer_id=dealer.id,
        invoice_number=str(data.invoice_number).strip(),
        purchase_date=purchase_date,
        subtotal=subtotal,
        gst_amount=gst_amount,
        discount_amount=discount,
        freight_amount=freight,
        round_off=round_off,
        total_amount=total_amount,
        paid_amount=paid_amount,
        outstanding_amount=outstanding,
        payment_mode=data.payment_mode or "Credit",
        note=data.note,
        created_at=purchase_date,
    )

    db.add(purchase)
    db.flush()

    for line in purchase_lines:
        item = line.pop("item")
        previous_stock = int(item.stock or 0)
        new_stock = previous_stock + int(line["quantity"])

        db.add(
            models.PurchaseItem(
                purchase_id=purchase.id,
                item_id=item.id,
                item_name=item.item_name,
                **line,
            )
        )

        item.stock = new_stock
        item.purchase_price = line["purchase_price"]

        if line["mrp"] > 0:
            item.mrp = line["mrp"]
        if line["sale_price"] > 0:
            item.sale_price = line["sale_price"]

        item.gst_percent = line["gst_percent"]

        if line["batch_number"]:
            item.batch_number = line["batch_number"]
        if line["manufacturing_date"]:
            item.manufacturing_date = line["manufacturing_date"]
        if line["expiry_date"]:
            item.expiry_date = line["expiry_date"]

        db.add(
            models.StockAdjustment(
                item_id=item.id,
                previous_stock=previous_stock,
                adjustment=int(line["quantity"]),
                new_stock=new_stock,
                reason=f"Purchase {purchase.invoice_number}",
            )
        )
        add_inventory_movement(
            db,
            item_id=item.id,
            movement_type="PURCHASE",
            quantity_change=int(line["quantity"]),
            previous_stock=previous_stock,
            new_stock=new_stock,
            reference_type="purchase",
            reference_id=purchase.id,
            reference_number=purchase.invoice_number,
            reason=f"Purchase {purchase.invoice_number}",
        )

    bill = models.DealerBill(
        dealer_id=dealer.id,
        bill_number=purchase.invoice_number,
        bill_amount=total_amount,
        bill_date=purchase_date,
        note=f"Purchase #{purchase.id}",
    )
    db.add(bill)

    if paid_amount > 0:
        db.add(
            models.DealerPayment(
                dealer_id=dealer.id,
                paid_amount=paid_amount,
                payment_mode=data.payment_mode or "Cash",
                payment_date=purchase_date,
                reference=purchase.invoice_number,
                note=f"Payment recorded with purchase #{purchase.id}",
            )
        )

    db.commit()
    db.refresh(purchase)

    return {
        "message": "Purchase saved and stock updated successfully",
        "purchase_id": purchase.id,
        "invoice_number": purchase.invoice_number,
        "total_amount": round(total_amount, 2),
        "paid_amount": round(paid_amount, 2),
        "outstanding_amount": round(outstanding, 2),
    }



@app.get("/sales/{sale_id}/return-detail")
def get_sale_return_detail(sale_id: int, db: Session = Depends(get_db)):
    sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return {
        "id": sale.id,
        "invoice_no": sale.invoice_no,
        "customer_name": sale.customer_name or "Walk-in Customer",
        "customer_mobile": sale.customer_mobile,
        "bill_date": sale.bill_date.strftime("%Y-%m-%d") if sale.bill_date else None,
        "payment_mode": sale.payment_mode,
        "final_amount": round(to_float(sale.final_amount), 2),
        "items": [
            {
                "id": row.id,
                "item_id": row.item_id,
                "item_name": row.item_name,
                "quantity": int(row.quantity or 0),
                "returned_quantity": int(getattr(row, "returned_quantity", 0) or 0),
                "available_to_return": max(
                    int(row.quantity or 0) - int(getattr(row, "returned_quantity", 0) or 0),
                    0,
                ),
                "rate": round(to_float(row.rate), 2),
                "gst_percent": round(to_float(row.gst_percent), 2),
                "amount": round(to_float(row.amount), 2),
            }
            for row in sale.items
        ],
    }


@app.post("/sales-returns")
def create_sales_return(data: schemas.SalesReturnCreate, db: Session = Depends(get_db)):
    sale_item = (
        db.query(models.SaleItem)
        .filter(models.SaleItem.id == data.sale_item_id)
        .first()
    )
    if not sale_item:
        raise HTTPException(status_code=404, detail="Sale item not found")

    sale = sale_item.sale
    item = db.query(models.Item).filter(models.Item.id == sale_item.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    quantity = int(data.quantity or 0)
    returned = int(getattr(sale_item, "returned_quantity", 0) or 0)
    available = max(int(sale_item.quantity or 0) - returned, 0)

    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Return quantity must be greater than zero")
    if quantity > available:
        raise HTTPException(
            status_code=400,
            detail=f"Only {available} unit(s) are available to return",
        )

    reason = str(data.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Return reason is required")

    refund_method = str(data.refund_method or "Cash").strip()
    if refund_method not in {"Cash", "Online", "Credit Note", "No Refund"}:
        raise HTTPException(status_code=400, detail="Invalid refund method")

    unit_total = to_float(sale_item.amount) / max(int(sale_item.quantity or 1), 1)
    gross_invoice_lines = sum(to_float(line.amount) for line in sale.items)
    invoice_factor = (
        min(max(to_float(sale.final_amount) / gross_invoice_lines, 0), 1)
        if gross_invoice_lines > 0
        else 1
    )
    return_amount = unit_total * quantity * invoice_factor

    previous_stock = int(item.stock or 0)
    new_stock = previous_stock + quantity
    item.stock = new_stock
    sale_item.returned_quantity = returned + quantity

    selected_return_date = (
        datetime.combine(data.return_date, datetime.min.time())
        if data.return_date
        else datetime.now()
    )

    row = models.SalesReturn(
        sale_id=sale.id,
        sale_item_id=sale_item.id,
        item_id=item.id,
        quantity=quantity,
        return_amount=return_amount,
        reason=reason,
        refund_method=refund_method,
        return_date=selected_return_date,
    )
    db.add(row)

    db.add(
        models.StockAdjustment(
            item_id=item.id,
            previous_stock=previous_stock,
            adjustment=quantity,
            new_stock=new_stock,
            reason=f"Sales return {sale.invoice_no}: {reason}",
        )
    )
    add_inventory_movement(
        db,
        item_id=item.id,
        movement_type="SALES_RETURN",
        quantity_change=quantity,
        previous_stock=previous_stock,
        new_stock=new_stock,
        reference_type="sales_return",
        reference_id=sale.id,
        reference_number=sale.invoice_no,
        reason=reason,
    )

    db.commit()
    db.refresh(row)

    return {
        "message": "Sales return saved and stock restored successfully",
        "return_id": row.id,
        "invoice_no": sale.invoice_no,
        "return_amount": round(return_amount, 2),
        "refund_method": refund_method,
        "new_stock": new_stock,
    }


@app.get("/sales-returns")
def get_sales_returns(db: Session = Depends(get_db)):
    rows = (
        db.query(models.SalesReturn)
        .order_by(models.SalesReturn.return_date.desc(), models.SalesReturn.id.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "sale_id": row.sale_id,
            "invoice_no": row.sale.invoice_no if row.sale else "-",
            "customer_name": row.sale.customer_name if row.sale and row.sale.customer_name else "Walk-in Customer",
            "item_id": row.item_id,
            "item_name": row.sale_item.item_name if row.sale_item else "-",
            "quantity": row.quantity,
            "return_amount": round(to_float(row.return_amount), 2),
            "reason": row.reason,
            "refund_method": row.refund_method,
            "return_date": row.return_date.strftime("%Y-%m-%d") if row.return_date else None,
        }
        for row in rows
    ]


@app.get("/inventory-movements")
def get_inventory_movements(
    item_id: int | None = None,
    movement_type: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.InventoryMovement)
    if item_id:
        query = query.filter(models.InventoryMovement.item_id == item_id)
    if movement_type and movement_type != "All":
        query = query.filter(models.InventoryMovement.movement_type == movement_type)

    rows = (
        query.order_by(
            models.InventoryMovement.created_at.desc(),
            models.InventoryMovement.id.desc(),
        )
        .limit(1000)
        .all()
    )

    return [
        {
            "id": row.id,
            "item_id": row.item_id,
            "item_name": row.item.item_name if row.item else "-",
            "barcode": row.item.barcode if row.item else "",
            "movement_type": row.movement_type,
            "quantity_change": row.quantity_change,
            "previous_stock": row.previous_stock,
            "new_stock": row.new_stock,
            "reference_type": row.reference_type,
            "reference_id": row.reference_id,
            "reference_number": row.reference_number,
            "reason": row.reason,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@app.get("/returns/dashboard")
def returns_dashboard(db: Session = Depends(get_db)):
    sales_returns = db.query(models.SalesReturn).all()
    purchase_returns = db.query(models.PurchaseReturn).all()
    adjustments = db.query(models.StockAdjustment).all()

    return {
        "sales_return_count": len(sales_returns),
        "sales_return_amount": round(sum(to_float(x.return_amount) for x in sales_returns), 2),
        "purchase_return_count": len(purchase_returns),
        "purchase_return_amount": round(sum(to_float(x.return_amount) for x in purchase_returns), 2),
        "stock_adjustment_count": len(adjustments),
        "movement_count": db.query(models.InventoryMovement).count(),
    }


@app.post("/purchase-returns")
def create_purchase_return(
    data: schemas.PurchaseReturnCreate,
    db: Session = Depends(get_db),
):
    purchase_item = (
        db.query(models.PurchaseItem)
        .filter(models.PurchaseItem.id == data.purchase_item_id)
        .first()
    )

    if not purchase_item:
        raise HTTPException(status_code=404, detail="Purchase item not found")

    purchase = purchase_item.purchase
    item = db.query(models.Item).filter(models.Item.id == purchase_item.item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    quantity = int(data.quantity or 0)
    available_to_return = max(
        int(purchase_item.quantity or 0) - int(purchase_item.returned_quantity or 0),
        0,
    )

    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Return quantity must be greater than zero")

    if quantity > available_to_return:
        raise HTTPException(
            status_code=400,
            detail=f"Only {available_to_return} unit(s) are available to return",
        )

    if quantity > int(item.stock or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Current stock is only {int(item.stock or 0)}. Cannot return {quantity}.",
        )

    per_unit_total = (
        to_float(purchase_item.line_total) / int(purchase_item.quantity or 1)
    )
    return_amount = per_unit_total * quantity

    previous_stock = int(item.stock or 0)
    new_stock = previous_stock - quantity

    item.stock = new_stock
    purchase_item.returned_quantity = int(purchase_item.returned_quantity or 0) + quantity

    selected_return_date = (
        datetime.combine(data.return_date, datetime.min.time())
        if data.return_date
        else datetime.now()
    )

    row = models.PurchaseReturn(
        purchase_id=purchase.id,
        purchase_item_id=purchase_item.id,
        dealer_id=purchase.dealer_id,
        item_id=item.id,
        quantity=quantity,
        return_amount=return_amount,
        reason=data.reason,
        return_date=selected_return_date,
    )
    db.add(row)

    db.add(
        models.StockAdjustment(
            item_id=item.id,
            previous_stock=previous_stock,
            adjustment=-quantity,
            new_stock=new_stock,
            reason=f"Purchase return {purchase.invoice_number}",
        )
    )
    add_inventory_movement(
        db,
        item_id=item.id,
        movement_type="PURCHASE_RETURN",
        quantity_change=-quantity,
        previous_stock=previous_stock,
        new_stock=new_stock,
        reference_type="purchase_return",
        reference_id=purchase.id,
        reference_number=purchase.invoice_number,
        reason=data.reason or "Purchase return",
    )

    purchase.outstanding_amount = max(
        to_float(purchase.outstanding_amount) - return_amount,
        0,
    )

    # Reduce the supplier bill by the returned value so dealer ledger remains aligned.
    bill = (
        db.query(models.DealerBill)
        .filter(
            models.DealerBill.dealer_id == purchase.dealer_id,
            models.DealerBill.bill_number == purchase.invoice_number,
        )
        .order_by(models.DealerBill.id.desc())
        .first()
    )
    if bill:
        bill.bill_amount = max(to_float(bill.bill_amount) - return_amount, 0)

    db.commit()
    db.refresh(row)

    return {
        "message": "Purchase return saved and stock reduced successfully",
        "return_id": row.id,
        "return_amount": round(return_amount, 2),
        "new_stock": new_stock,
    }


@app.get("/purchase-returns")
def get_purchase_returns(db: Session = Depends(get_db)):
    rows = (
        db.query(models.PurchaseReturn)
        .order_by(models.PurchaseReturn.return_date.desc())
        .all()
    )

    return [
        {
            "id": row.id,
            "purchase_id": row.purchase_id,
            "purchase_item_id": row.purchase_item_id,
            "dealer_id": row.dealer_id,
            "dealer_name": row.purchase.dealer.dealer_name if row.purchase and row.purchase.dealer else "-",
            "invoice_number": row.purchase.invoice_number if row.purchase else "-",
            "item_id": row.item_id,
            "item_name": (
                row.purchase_item.item_name
                if row.purchase_item
                else "-"
            ),
            "quantity": row.quantity,
            "return_amount": round(to_float(row.return_amount), 2),
            "reason": row.reason,
            "return_date": row.return_date.strftime("%Y-%m-%d") if row.return_date else None,
        }
        for row in rows
    ]


@app.get("/reports/profit-summary")
def profit_summary(db: Session = Depends(get_db)):
    sale_items = db.query(models.SaleItem).all()

    sales_value = sum(
        to_float(row.rate) * int(row.quantity or 0)
        for row in sale_items
    )
    cost_value = sum(
        to_float(row.cost_price) * int(row.quantity or 0)
        for row in sale_items
    )
    gross_profit = sum(to_float(row.profit_amount) for row in sale_items)

    return {
        "sales_value": round(sales_value, 2),
        "cost_value": round(cost_value, 2),
        "gross_profit": round(gross_profit, 2),
        "margin_percent": round(
            gross_profit / sales_value * 100 if sales_value > 0 else 0,
            2,
        ),
    }


@app.post("/expenses")
def add_expense(data: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    expense = models.Expense(
        expense_name=data.expense_name,
        category=data.category,
        amount=data.amount,
        payment_mode=data.payment_mode,
        note=data.note,
    )
    if data.expense_date:
        try:
            expense.expense_date = datetime.strptime(data.expense_date, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid expense date") from exc
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@app.get("/expenses")
def get_expenses(from_date: str | None = None, to_date: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Expense)
    if from_date:
        query = query.filter(models.Expense.expense_date >= datetime.strptime(from_date, "%Y-%m-%d"))
    if to_date:
        query = query.filter(models.Expense.expense_date <= datetime.strptime(to_date + " 23:59:59", "%Y-%m-%d %H:%M:%S"))
    rows = query.order_by(models.Expense.expense_date.desc(), models.Expense.id.desc()).all()
    return rows


@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted successfully"}


@app.get("/settings/{user_id}")
def get_settings(
    user_id: str,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this account")

    user = db.query(models.User).filter(models.User.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "business_name": user.business_name,
        "user_id": user.user_id,
        "email": user.email,
        "mobile": user.mobile,
        "gst_number": getattr(user, "gst_number", ""),
        "address": getattr(user, "address", ""),
    }


@app.put("/settings/{user_id}")
def update_settings(
    user_id: str,
    data: schemas.SettingsUpdate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this account")

    user = db.query(models.User).filter(models.User.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    setattr(user, "business_name", data.business_name)
    setattr(user, "email", data.email)
    setattr(user, "mobile", data.mobile)
    setattr(user, "gst_number", data.gst_number)
    setattr(user, "address", data.address)

    db.commit()

    return {"message": "Settings updated successfully"}


@app.put("/settings/{user_id}/username")
def update_username(
    user_id: str,
    data: schemas.UsernameUpdate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this account")

    user = db.query(models.User).filter(models.User.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(models.User).filter(models.User.user_id == data.new_user_id).first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    setattr(user, "user_id", data.new_user_id)
    db.commit()

    return {"message": "Username updated successfully"}


@app.put("/settings/{user_id}/password")
def update_password(
    user_id: str,
    data: schemas.PasswordUpdate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this account")

    user = db.query(models.User).filter(models.User.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(data.old_password, getattr(user, "password", "")):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    setattr(user, "password", hash_password(data.new_password))
    db.commit()

    return {"message": "Password updated successfully"}
    