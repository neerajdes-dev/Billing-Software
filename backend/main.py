import os
from datetime import datetime
from typing import Any

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import Base, engine, SessionLocal
import models
import schemas
from security import hash_password, verify_password


Base.metadata.create_all(bind=engine)


def run_database_migrations():
    migration_statements = [
        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS email VARCHAR",
        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS gst_number VARCHAR",
        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bill_amount DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS bill_date TIMESTAMP",
        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE dealer_payments ADD COLUMN IF NOT EXISTS reference VARCHAR",
        "ALTER TABLE dealer_payments ADD COLUMN IF NOT EXISTS note VARCHAR",
        "ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS reference VARCHAR",
        "ALTER TABLE items ADD COLUMN IF NOT EXISTS mrp DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS bill_date TIMESTAMP",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_mrp DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_saving DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS mrp DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS saving DOUBLE PRECISION DEFAULT 0",
        """
    CREATE TABLE IF NOT EXISTS dealer_bills (
        id SERIAL PRIMARY KEY,
        dealer_id INTEGER NOT NULL,
        bill_number VARCHAR,
        bill_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        bill_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        note VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_dealer_bills_dealer
            FOREIGN KEY (dealer_id)
            REFERENCES dealers(id)
            ON DELETE CASCADE
    )
    """,
    ]
    with engine.begin() as connection:
        for statement in migration_statements:
            connection.execute(text(statement))

    print("Database migrations completed successfully")


run_database_migrations()

app = FastAPI(title="Resolvent Billing Software API")

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_invoice_no():
    return "INV-" + datetime.now().strftime("%Y%m%d%H%M%S")


def to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


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
    database_info = (
        db.execute(
            text(
                """
            SELECT
                current_database() AS database_name,
                current_schema() AS schema_name
            """
            )
        )
        .mappings()
        .first()
    )

    dealer_columns = (
        db.execute(
            text(
                """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'dealers'
            ORDER BY ordinal_position
            """
            )
        )
        .mappings()
        .all()
    )

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

    return {
        "message": "Login successful",
        "user_id": user.user_id,
        "business_name": user.business_name,
        "email": user.email,
        "mobile": user.mobile,
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
    existing = db.query(models.Item).filter(models.Item.barcode == data.barcode).first()

    if existing:
        raise HTTPException(status_code=400, detail="Barcode already exists")

    item = models.Item(**data.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.get("/items")
def get_items(db: Session = Depends(get_db)):
    return db.query(models.Item).order_by(models.Item.id.desc()).all()


@app.get("/items/barcode/{barcode}")
def get_item_by_barcode(barcode: str, db: Session = Depends(get_db)):
    item = db.query(models.Item).filter(models.Item.barcode == barcode).first()

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

    for product in data.products:
        item = db.query(models.Item).filter(models.Item.id == product.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        current_stock = int(item.stock or 0)
        if current_stock < product.quantity:
            raise HTTPException(
                status_code=400, detail=f"Stock not available for {item.item_name}"
            )

        rate = to_float(item.sale_price)
        mrp = max(to_float(item.mrp), rate)
        qty = int(product.quantity)
        base_amount = rate * qty
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
                "gst_percent": item.gst_percent,
                "amount": line_total,
                "saving": saving,
            }
        )

    final_amount = subtotal + gst_amount
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
        final_amount=final_amount,
        payment_mode=data.payment_mode,
        bill_date=selected_bill_date,
        created_at=selected_bill_date,
    )
    db.add(sale)
    db.flush()
    for row in sale_items:
        db.add(models.SaleItem(sale_id=sale.id, **row))
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
        "final_amount": round(final_amount, 2),
        "payment_mode": sale.payment_mode,
        "bill_date": sale.bill_date.strftime("%Y-%m-%d") if sale.bill_date else None,
        "items": sale_items,
    }


@app.get("/sales")
def get_sales(db: Session = Depends(get_db)):
    return db.query(models.Sale).order_by(models.Sale.id.desc()).all()


@app.post("/dealers")
def add_dealer(data: schemas.DealerCreate, db: Session = Depends(get_db)):
    dealer = models.Dealer(
        dealer_name=data.dealer_name,
        mobile=data.mobile,
        email=data.email,
        gst_number=data.gst_number,
        address=data.address,
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
        result.append(
            {
                "id": dealer.id,
                "dealer_name": dealer.dealer_name,
                "mobile": dealer.mobile,
                "email": dealer.email,
                "gst_number": dealer.gst_number,
                "address": dealer.address,
                "bill_amount": round(bill_total, 2),
                "paid_amount": round(paid, 2),
                "pending_amount": round(max(bill_total - paid, 0), 2),
                "bill_count": len(dealer.bills),
            }
        )
    return result


@app.post("/dealer-bills")
def add_dealer_bill(data: schemas.DealerBillCreate, db: Session = Depends(get_db)):
    dealer = db.query(models.Dealer).filter(models.Dealer.id == data.dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    if data.bill_amount <= 0:
        raise HTTPException(
            status_code=400, detail="Bill amount must be greater than zero"
        )
    bill_date = datetime.now()
    if data.bill_date:
        try:
            bill_date = datetime.strptime(data.bill_date, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid bill date") from exc
    bill = models.DealerBill(
        dealer_id=data.dealer_id,
        bill_number=data.bill_number,
        bill_amount=data.bill_amount,
        bill_date=bill_date,
        note=data.note,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return {"message": "Dealer bill saved", "id": bill.id}


@app.get("/dealers/{dealer_id}/ledger")
def dealer_ledger(dealer_id: int, db: Session = Depends(get_db)):
    dealer = db.query(models.Dealer).filter(models.Dealer.id == dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    bills = [
        {
            "id": b.id,
            "bill_number": b.bill_number,
            "bill_amount": b.bill_amount,
            "bill_date": b.bill_date.isoformat() if b.bill_date else None,
            "note": b.note,
        }
        for b in sorted(
            dealer.bills, key=lambda x: x.bill_date or datetime.min, reverse=True
        )
    ]
    if not bills and to_float(dealer.bill_amount) > 0:
        bills = [
            {
                "id": None,
                "bill_number": "Legacy bill",
                "bill_amount": dealer.bill_amount,
                "bill_date": dealer.bill_date.isoformat() if dealer.bill_date else None,
                "note": "Migrated existing bill",
            }
        ]
    payments = [
        {
            "id": p.id,
            "paid_amount": p.paid_amount,
            "payment_mode": p.payment_mode,
            "payment_date": p.payment_date.isoformat() if p.payment_date else None,
            "reference": p.reference,
            "note": p.note,
        }
        for p in sorted(
            dealer.payments, key=lambda x: x.payment_date or datetime.min, reverse=True
        )
    ]
    total_bills = sum(to_float(x["bill_amount"]) for x in bills)
    total_paid = sum(to_float(x["paid_amount"]) for x in payments)
    return {
        "dealer": {
            "id": dealer.id,
            "dealer_name": dealer.dealer_name,
            "mobile": dealer.mobile,
            "email": dealer.email,
            "gst_number": dealer.gst_number,
            "address": dealer.address,
        },
        "summary": {
            "total_bills": round(total_bills, 2),
            "total_paid": round(total_paid, 2),
            "outstanding": round(max(total_bills - total_paid, 0), 2),
        },
        "bills": bills,
        "payments": payments,
    }


@app.put("/dealer-bills/{bill_id}")
def update_dealer_bill(
    bill_id: int, data: schemas.DealerBillUpdate, db: Session = Depends(get_db)
):
    bill = db.query(models.DealerBill).filter(models.DealerBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Dealer bill not found")
    if data.bill_amount <= 0:
        raise HTTPException(
            status_code=400, detail="Bill amount must be greater than zero"
        )
    bill.bill_number = data.bill_number
    bill.bill_amount = data.bill_amount
    bill.note = data.note
    if data.bill_date:
        try:
            bill.bill_date = datetime.strptime(data.bill_date, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid bill date") from exc
    db.commit()
    return {"message": "Dealer bill updated"}


@app.delete("/dealer-bills/{bill_id}")
def delete_dealer_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(models.DealerBill).filter(models.DealerBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Dealer bill not found")
    db.delete(bill)
    db.commit()
    return {"message": "Dealer bill deleted"}


@app.post("/dealer-payments")
def add_dealer_payment(
    data: schemas.DealerPaymentCreate, db: Session = Depends(get_db)
):
    dealer = db.query(models.Dealer).filter(models.Dealer.id == data.dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    total_bills = sum(to_float(b.bill_amount) for b in dealer.bills) or to_float(
        dealer.bill_amount
    )
    paid = sum(to_float(p.paid_amount) for p in dealer.payments)
    outstanding = max(total_bills - paid, 0)
    if data.paid_amount <= 0:
        raise HTTPException(
            status_code=400, detail="Payment amount must be greater than zero"
        )
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
    payment = models.DealerPayment(
        dealer_id=data.dealer_id,
        paid_amount=data.paid_amount,
        payment_mode=data.payment_mode,
        payment_date=payment_date,
        reference=data.reference,
        note=data.note,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return {"message": "Dealer payment added successfully", "payment_id": payment.id}


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
        }
        for item in items
    ]


@app.get("/reports/sales")
def sales_report(
    from_date: str | None = None,
    to_date: str | None = None,
    payment_mode: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Sale)
    try:
        if from_date:
            query = query.filter(
                models.Sale.bill_date >= datetime.strptime(from_date, "%Y-%m-%d")
            )
        if to_date:
            query = query.filter(
                models.Sale.bill_date
                <= datetime.strptime(to_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid report date") from exc
    if payment_mode and payment_mode != "All":
        query = query.filter(models.Sale.payment_mode == payment_mode)
    sales = query.order_by(models.Sale.bill_date.desc(), models.Sale.id.desc()).all()

    def total_for(mode=None):
        return sum(
            to_float(s.final_amount)
            for s in sales
            if mode is None or s.payment_mode == mode
        )

    rows = [
        {
            "id": s.id,
            "invoice_no": s.invoice_no,
            "customer_name": s.customer_name,
            "customer_mobile": s.customer_mobile,
            "payment_mode": s.payment_mode,
            "subtotal": s.subtotal,
            "gst_amount": s.gst_amount,
            "final_amount": s.final_amount,
            "bill_date": (s.bill_date or s.created_at).strftime("%Y-%m-%d")
            if (s.bill_date or s.created_at)
            else None,
        }
        for s in sales
    ]
    return {
        "total_sales": total_for(),
        "cash_sales": total_for("Cash"),
        "online_sales": total_for("Online"),
        "credit_sales": total_for("Credit"),
        "total_gst": sum(to_float(s.gst_amount) for s in sales),
        "total_bills": len(sales),
        "sales": rows,
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
            raise HTTPException(
                status_code=400, detail="Invalid from_date format"
            ) from exc
        query = query.filter(models.Sale.created_at >= start_date)

    if to_date:
        try:
            end_date = datetime.strptime(to_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
        except ValueError as exc:
            raise HTTPException(
                status_code=400, detail="Invalid to_date format"
            ) from exc
        query = query.filter(models.Sale.created_at <= end_date)

    sales = query.order_by(models.Sale.created_at.asc()).all()

    total_sales = sum(to_float(s.final_amount) for s in sales)
    cash_sales = sum(
        to_float(s.final_amount)
        for s in sales
        if getattr(s, "payment_mode", None) == "Cash"
    )
    online_sales = sum(
        to_float(s.final_amount)
        for s in sales
        if getattr(s, "payment_mode", None) == "Online"
    )
    credit_sales = sum(
        to_float(s.final_amount)
        for s in sales
        if getattr(s, "payment_mode", None) == "Credit"
    )
    customer_payments = db.query(models.CustomerPayment).all()
    customer_credit_outstanding = max(
        credit_sales
        - sum(to_float(payment.paid_amount) for payment in customer_payments),
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
        "low_stock_count": db.query(models.Item)
        .filter(models.Item.stock <= 10)
        .count(),
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
def bulk_update_items(data: schemas.BulkItemUpdate, db: Session = Depends(get_db)):
    changed = 0
    for row in data.items:
        item = db.query(models.Item).filter(models.Item.id == row.id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {row.id} not found")
        barcode = row.barcode if row.barcode is not None else item.barcode
        duplicate = (
            db.query(models.Item)
            .filter(models.Item.barcode == barcode, models.Item.id != item.id)
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=400, detail=f"Duplicate barcode: {barcode}")
        purchase = (
            item.purchase_price if row.purchase_price is None else row.purchase_price
        )
        mrp = item.mrp if row.mrp is None else row.mrp
        sale = item.sale_price if row.sale_price is None else row.sale_price
        gst = item.gst_percent if row.gst_percent is None else row.gst_percent
        if min(purchase, mrp, sale, gst) < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Negative value not allowed for {item.item_name}",
            )
        if sale > mrp:
            raise HTTPException(
                status_code=400,
                detail=f"Sales price cannot exceed MRP for {item.item_name}",
            )
        previous = int(item.stock or 0)
        adjustment = int(row.stock_adjustment or 0)
        new_stock = previous + adjustment
        if new_stock < 0:
            raise HTTPException(
                status_code=400, detail=f"Stock cannot be negative for {item.item_name}"
            )
        item.item_name = row.item_name if row.item_name is not None else item.item_name
        item.barcode = barcode
        item.purchase_price = purchase
        item.mrp = mrp
        item.sale_price = sale
        item.gst_percent = gst
        if adjustment:
            item.stock = new_stock
            db.add(
                models.StockAdjustment(
                    item_id=item.id,
                    previous_stock=previous,
                    adjustment=adjustment,
                    new_stock=new_stock,
                    reason=row.adjustment_reason or "Bulk update",
                )
            )
        changed += 1
    db.commit()
    return {"message": f"{changed} products updated successfully", "updated": changed}


@app.put("/items/{item_id}")
def update_item(item_id: int, data: schemas.ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    duplicate = (
        db.query(models.Item)
        .filter(models.Item.barcode == data.barcode, models.Item.id != item_id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Barcode already exists")
    for key, value in data.dict().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    used = db.query(models.SaleItem).filter(models.SaleItem.item_id == item_id).first()
    if used:
        raise HTTPException(
            status_code=400, detail="Item is used in sales and cannot be deleted"
        )
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}


@app.post("/items/import")
def import_items(data: schemas.ItemImport, db: Session = Depends(get_db)):
    created, skipped = 0, []
    for row in data.items:
        existing = (
            db.query(models.Item).filter(models.Item.barcode == row.barcode).first()
        )
        if existing:
            skipped.append(row.barcode)
            continue
        db.add(models.Item(**row.dict()))
        created += 1
    db.commit()
    return {
        "message": f"{created} items imported",
        "created": created,
        "skipped": skipped,
    }


@app.get("/customers/credit-ledger")
def customer_credit_ledger(db: Session = Depends(get_db)):
    customers = (
        db.query(models.Customer).order_by(models.Customer.customer_name.asc()).all()
    )
    result = []

    for customer in customers:
        sales_query = db.query(models.Sale).filter(models.Sale.payment_mode == "Credit")
        if customer.mobile:
            sales_query = sales_query.filter(
                models.Sale.customer_mobile == customer.mobile
            )
        else:
            sales_query = sales_query.filter(
                models.Sale.customer_name == customer.customer_name
            )

        credit_sales = sales_query.order_by(
            models.Sale.bill_date.desc(), models.Sale.id.desc()
        ).all()
        credit = sum(to_float(s.final_amount) for s in credit_sales)
        paid = sum(to_float(p.paid_amount) for p in customer.payments)
        outstanding = max(credit - paid, 0)
        latest_purchase = credit_sales[0].bill_date if credit_sales else None

        result.append(
            {
                "id": customer.id,
                "customer_name": customer.customer_name,
                "mobile": customer.mobile,
                "address": customer.address,
                "purchase_date": latest_purchase.isoformat()
                if latest_purchase
                else None,
                "credit_amount": round(credit, 2),
                "paid_amount": round(paid, 2),
                "pending_amount": round(outstanding, 2),
                "credit_purchases": [
                    {
                        "id": sale.id,
                        "invoice_no": sale.invoice_no,
                        "purchase_date": sale.bill_date.isoformat()
                        if sale.bill_date
                        else None,
                        "credit_amount": round(to_float(sale.final_amount), 2),
                    }
                    for sale in credit_sales
                ],
                "payments": [
                    {
                        "id": payment.id,
                        "paid_amount": round(to_float(payment.paid_amount), 2),
                        "payment_mode": payment.payment_mode,
                        "payment_date": payment.payment_date.isoformat()
                        if payment.payment_date
                        else None,
                        "reference": getattr(payment, "reference", None),
                        "note": payment.note,
                    }
                    for payment in sorted(
                        customer.payments,
                        key=lambda item: item.payment_date or datetime.min,
                        reverse=True,
                    )
                ],
            }
        )

    return result


@app.post("/customer-payments")
def add_customer_payment(
    data: schemas.CustomerPaymentCreate, db: Session = Depends(get_db)
):
    customer = (
        db.query(models.Customer).filter(models.Customer.id == data.customer_id).first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if data.paid_amount <= 0:
        raise HTTPException(
            status_code=400, detail="Payment amount must be greater than zero"
        )

    sales_query = db.query(models.Sale).filter(models.Sale.payment_mode == "Credit")
    if customer.mobile:
        sales_query = sales_query.filter(models.Sale.customer_mobile == customer.mobile)
    else:
        sales_query = sales_query.filter(
            models.Sale.customer_name == customer.customer_name
        )

    total_credit = sum(to_float(s.final_amount) for s in sales_query.all())
    total_paid = sum(to_float(p.paid_amount) for p in customer.payments)
    outstanding = max(total_credit - total_paid, 0)

    if outstanding <= 0:
        raise HTTPException(
            status_code=400, detail="This customer has no outstanding credit amount"
        )
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
        "updated_outstanding_amount": round(
            outstanding - to_float(payment.paid_amount), 2
        ),
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
    return [
        {
            "id": p.id,
            "paid_amount": p.paid_amount,
            "payment_mode": p.payment_mode,
            "payment_date": p.payment_date.isoformat() if p.payment_date else None,
            "reference": getattr(p, "reference", None),
            "note": getattr(p, "note", None),
        }
        for p in sorted(
            dealer.payments, key=lambda x: x.payment_date or datetime.min, reverse=True
        )
    ]


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
def get_expenses(
    from_date: str | None = None,
    to_date: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Expense)
    if from_date:
        query = query.filter(
            models.Expense.expense_date >= datetime.strptime(from_date, "%Y-%m-%d")
        )
    if to_date:
        query = query.filter(
            models.Expense.expense_date
            <= datetime.strptime(to_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
        )
    rows = query.order_by(
        models.Expense.expense_date.desc(), models.Expense.id.desc()
    ).all()
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
def get_settings(user_id: str, db: Session = Depends(get_db)):
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
    user_id: str, data: schemas.SettingsUpdate, db: Session = Depends(get_db)
):
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
    user_id: str, data: schemas.UsernameUpdate, db: Session = Depends(get_db)
):
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
    user_id: str, data: schemas.PasswordUpdate, db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(data.old_password, getattr(user, "password", "")):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    setattr(user, "password", hash_password(data.new_password))
    db.commit()

    return {"message": "Password updated successfully"}
