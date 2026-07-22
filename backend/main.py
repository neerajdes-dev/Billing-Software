from datetime import datetime
from typing import Any
import os

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect

from database import Base, engine, SessionLocal
import models
import schemas
from security import hash_password, verify_password


Base.metadata.create_all(bind=engine)

# Lightweight migration support for existing Sprint 3 databases.
def ensure_column(table: str, column: str, definition: str):
    inspector = inspect(engine)
    existing = {item["name"] for item in inspector.get_columns(table)}
    if column not in existing:
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))

ensure_column("sales", "bill_date", "TIMESTAMP")
ensure_column("dealer_payments", "reference", "VARCHAR")
ensure_column("dealer_payments", "note", "VARCHAR")
ensure_column("customer_payments", "reference", "VARCHAR")

app = FastAPI(
    title=os.getenv("APP_NAME", "Resolvent Billing Software API"),
    version="1.0.0-staging" if os.getenv("APP_ENV") == "staging" else "1.0.0",
)


def get_cors_origins():
    raw_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return [origin.strip().rstrip("/") for origin in raw_origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
    return {
        "message": "Resolvent Billing Software API Running",
        "environment": os.getenv("APP_ENV", "development"),
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "billing-api"}


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
    subtotal = 0
    gst_amount = 0
    sale_items = []
    
    for product in data.products:
        item = db.query(models.Item).filter(models.Item.id == product.item_id).first()

        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        # determine current stock for this item
        current_stock = int(getattr(item, "stock", 0) or 0)

        if current_stock < product.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock not available for {item.item_name}",
            )

        base_amount = float(getattr(item, "sale_price", 0)) * product.quantity
        item_gst = base_amount * float(getattr(item, "gst_percent", 0)) / 100
        line_total = base_amount + item_gst

        subtotal += base_amount
        gst_amount += item_gst
        
        setattr(item, "stock", current_stock - product.quantity)

        sale_items.append(
            {
                "item_id": item.id,
                "item_name": item.item_name,
                "quantity": product.quantity,
                "rate": item.sale_price,
                "gst_percent": item.gst_percent,
                "amount": line_total,
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
        gst_amount=gst_amount,
        final_amount=final_amount,
        payment_mode=data.payment_mode,
        bill_date=selected_bill_date,
        created_at=selected_bill_date,
    )

    db.add(sale)
    db.commit()
    db.refresh(sale)

    for si in sale_items:
        db.add(models.SaleItem(sale_id=sale.id, **si))

    db.commit()

    return {
        "message": "Bill generated successfully",
        "invoice_no": sale.invoice_no,
        "sale_id": sale.id,
        "customer_name": sale.customer_name,
        "customer_mobile": sale.customer_mobile,
        "subtotal": subtotal,
        "gst_amount": gst_amount,
        "final_amount": final_amount,
        "payment_mode": sale.payment_mode,
        "bill_date": sale.bill_date.strftime("%Y-%m-%d") if sale.bill_date else None,
        "items": sale_items,
    }


@app.get("/sales")
def get_sales(db: Session = Depends(get_db)):
    return db.query(models.Sale).order_by(models.Sale.id.desc()).all()


@app.post("/dealers")
def add_dealer(data: schemas.DealerCreate, db: Session = Depends(get_db)):
    payload = data.dict(exclude={"bill_date"})
    dealer = models.Dealer(**payload)
    if data.bill_date:
        try:
            dealer.bill_date = datetime.strptime(data.bill_date, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid bill date") from exc
    db.add(dealer)
    db.commit()
    db.refresh(dealer)
    return dealer


@app.get("/dealers")
def get_dealers(db: Session = Depends(get_db)):
    dealers = db.query(models.Dealer).order_by(models.Dealer.id.desc()).all()

    result = []

    for dealer in dealers:
        paid_amount = sum(float(p.paid_amount) for p in dealer.payments)
        bill_amount = getattr(dealer, "bill_amount", 0) or 0
        pending_amount = float(bill_amount) - paid_amount

        result.append(
            {
                "id": dealer.id,
                "dealer_name": dealer.dealer_name,
                "mobile": dealer.mobile,
                "address": dealer.address,
                "bill_amount": dealer.bill_amount,
                "paid_amount": paid_amount,
                "bill_date": (
                    dealer.bill_date.strftime("%Y-%m-%d")
                    if hasattr(dealer, "bill_date") and dealer.bill_date is not None
                    else ""),
                "pending_amount": pending_amount,
            }
        )

    return result


@app.post("/dealer-payments")
def add_dealer_payment(data: schemas.DealerPaymentCreate, db: Session = Depends(get_db)):
    dealer = db.query(models.Dealer).filter(models.Dealer.id == data.dealer_id).first()
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    if data.paid_amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")
    already_paid = sum(to_float(p.paid_amount) for p in dealer.payments)
    outstanding = max(to_float(dealer.bill_amount) - already_paid, 0)
    if data.paid_amount > outstanding:
        raise HTTPException(status_code=400, detail="Payment cannot exceed dealer outstanding amount")
    payment_date = datetime.now()
    if data.payment_date:
        try:
            payment_date = datetime.strptime(data.payment_date, "%Y-%m-%d")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid payment date") from exc
    payment = models.DealerPayment(
        dealer_id=data.dealer_id, paid_amount=data.paid_amount,
        payment_mode=data.payment_mode, payment_date=payment_date,
        reference=data.reference, note=data.note
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
            "sale_price": item.sale_price,
            "gst_percent": item.gst_percent,
            "stock": item.stock,
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


@app.put("/items/{item_id}")
def update_item(item_id: int, data: schemas.ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    duplicate = db.query(models.Item).filter(models.Item.barcode == data.barcode, models.Item.id != item_id).first()
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
        raise HTTPException(status_code=400, detail="Item is used in sales and cannot be deleted")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}


@app.post("/items/import")
def import_items(data: schemas.ItemImport, db: Session = Depends(get_db)):
    created, skipped = 0, []
    for row in data.items:
        existing = db.query(models.Item).filter(models.Item.barcode == row.barcode).first()
        if existing:
            skipped.append(row.barcode)
            continue
        db.add(models.Item(**row.dict()))
        created += 1
    db.commit()
    return {"message": f"{created} items imported", "created": created, "skipped": skipped}


@app.get("/customers/credit-ledger")
def customer_credit_ledger(db: Session = Depends(get_db)):
    customers = db.query(models.Customer).order_by(models.Customer.customer_name.asc()).all()
    result = []

    for customer in customers:
        sales_query = db.query(models.Sale).filter(models.Sale.payment_mode == "Credit")
        if customer.mobile:
            sales_query = sales_query.filter(models.Sale.customer_mobile == customer.mobile)
        else:
            sales_query = sales_query.filter(models.Sale.customer_name == customer.customer_name)

        credit_sales = sales_query.order_by(models.Sale.bill_date.desc(), models.Sale.id.desc()).all()
        credit = sum(to_float(s.final_amount) for s in credit_sales)
        paid = sum(to_float(p.paid_amount) for p in customer.payments)
        outstanding = max(credit - paid, 0)
        latest_purchase = credit_sales[0].bill_date if credit_sales else None

        result.append({
            "id": customer.id,
            "customer_name": customer.customer_name,
            "mobile": customer.mobile,
            "address": customer.address,
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

    total_credit = sum(to_float(s.final_amount) for s in sales_query.all())
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
    