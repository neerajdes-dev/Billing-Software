from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    business_name = Column(String, nullable=False)
    user_id = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    mobile = Column(String)
    logo = Column(String)
    gst_number = Column(String)
    address = Column(String)
    created_at = Column(DateTime, default=datetime.now)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, nullable=False)
    mobile = Column(String)
    address = Column(String)
    loyalty_points = Column(Float, default=0)
    loyalty_tier = Column(String, default="Regular")
    loyalty_member_since = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)
    payments = relationship("CustomerPayment", back_populates="customer", cascade="all, delete-orphan")
    loyalty_transactions = relationship(
        "LoyaltyTransaction",
        back_populates="customer",
        cascade="all, delete-orphan",
    )

class CustomerPayment(Base):
    __tablename__ = "customer_payments"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    paid_amount = Column(Float, nullable=False)
    payment_mode = Column(String, nullable=False, default="Cash")
    payment_date = Column(DateTime, default=datetime.now)
    reference = Column(String)
    note = Column(String)
    customer = relationship("Customer", back_populates="payments")


class LoyaltySettings(Base):
    __tablename__ = "loyalty_settings"
    id = Column(Integer, primary_key=True, index=True)
    enabled = Column(Integer, nullable=False, default=1)
    earn_amount = Column(Float, nullable=False, default=100)
    points_per_earn_amount = Column(Float, nullable=False, default=1)
    point_value = Column(Float, nullable=False, default=1)
    minimum_redeem_points = Column(Float, nullable=False, default=10)
    max_redeem_percent = Column(Float, nullable=False, default=20)
    silver_threshold = Column(Float, nullable=False, default=10000)
    gold_threshold = Column(Float, nullable=False, default=25000)
    platinum_threshold = Column(Float, nullable=False, default=50000)
    created_at = Column(DateTime, default=datetime.now)


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True)
    transaction_type = Column(String, nullable=False)
    points = Column(Float, nullable=False, default=0)
    balance_after = Column(Float, nullable=False, default=0)
    note = Column(String)
    created_at = Column(DateTime, default=datetime.now)
    customer = relationship("Customer", back_populates="loyalty_transactions")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String, nullable=False)
    barcode = Column(String, unique=True, nullable=False, index=True)
    purchase_price = Column(Float, nullable=False, default=0)
    mrp = Column(Float, nullable=False, default=0)
    sale_price = Column(Float, nullable=False, default=0)
    gst_percent = Column(Float, nullable=False, default=0)
    stock = Column(Integer, nullable=False, default=0)

    minimum_stock = Column(Integer, nullable=False, default=5)
    batch_number = Column(String)
    manufacturing_date = Column(Date)
    expiry_date = Column(Date)
    expiry_alert_days = Column(Integer, nullable=False, default=30)

    created_at = Column(DateTime, default=datetime.now)
    stock_adjustments = relationship(
        "StockAdjustment",
        back_populates="item",
        cascade="all, delete-orphan",
    )
    purchase_items = relationship("PurchaseItem", back_populates="item")


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    previous_stock = Column(Integer, nullable=False)
    adjustment = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)
    reason = Column(String, nullable=False, default="Bulk update")
    created_at = Column(DateTime, default=datetime.now)
    item = relationship("Item", back_populates="stock_adjustments")

class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String, unique=True)
    customer_name = Column(String)
    customer_mobile = Column(String)
    subtotal = Column(Float, default=0)
    total_mrp = Column(Float, default=0)
    total_saving = Column(Float, default=0)
    gst_amount = Column(Float, default=0)
    final_amount = Column(Float, default=0)
    payment_mode = Column(String, nullable=False)
    discount_amount = Column(Float, default=0)
    cash_amount = Column(Float, default=0)
    online_amount = Column(Float, default=0)
    credit_amount = Column(Float, default=0)
    amount_received = Column(Float, default=0)
    change_return = Column(Float, default=0)
    loyalty_points_earned = Column(Float, default=0)
    loyalty_points_redeemed = Column(Float, default=0)
    loyalty_discount = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.now)
    bill_date = Column(DateTime, default=datetime.now)
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

class SaleItem(Base):
    __tablename__ = "sale_items"
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"))
    item_id = Column(Integer, ForeignKey("items.id"))
    item_name = Column(String)
    quantity = Column(Integer)
    mrp = Column(Float, default=0)
    rate = Column(Float)
    cost_price = Column(Float, default=0)
    profit_amount = Column(Float, default=0)
    gst_percent = Column(Float)
    amount = Column(Float)
    saving = Column(Float, default=0)
    sale = relationship("Sale", back_populates="items")

class Dealer(Base):
    __tablename__ = "dealers"
    id = Column(Integer, primary_key=True, index=True)
    dealer_name = Column(String, nullable=False)
    mobile = Column(String)
    email = Column(String)
    gst_number = Column(String)
    address = Column(String)
    created_at = Column(DateTime, default=datetime.now)
    # legacy fields retained so existing deployments remain compatible
    bill_amount = Column(Float, default=0)
    bill_date = Column(DateTime, default=datetime.now)
    bills = relationship("DealerBill", back_populates="dealer", cascade="all, delete-orphan")
    payments = relationship("DealerPayment", back_populates="dealer", cascade="all, delete-orphan")
    purchases = relationship("Purchase", back_populates="dealer", cascade="all, delete-orphan")

class DealerBill(Base):
    __tablename__ = "dealer_bills"
    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=False)
    bill_number = Column(String)
    bill_amount = Column(Float, nullable=False)
    bill_date = Column(DateTime, default=datetime.now)
    note = Column(String)
    created_at = Column(DateTime, default=datetime.now)
    dealer = relationship("Dealer", back_populates="bills")

class DealerPayment(Base):
    __tablename__ = "dealer_payments"
    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"))
    paid_amount = Column(Float, nullable=False)
    payment_mode = Column(String, nullable=False)
    payment_date = Column(DateTime, default=datetime.now)
    reference = Column(String)
    note = Column(String)
    dealer = relationship("Dealer", back_populates="payments")


class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=False)
    invoice_number = Column(String, nullable=False)
    purchase_date = Column(DateTime, default=datetime.now)
    subtotal = Column(Float, default=0)
    gst_amount = Column(Float, default=0)
    discount_amount = Column(Float, default=0)
    freight_amount = Column(Float, default=0)
    round_off = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    paid_amount = Column(Float, default=0)
    outstanding_amount = Column(Float, default=0)
    payment_mode = Column(String, default="Credit")
    note = Column(String)
    created_at = Column(DateTime, default=datetime.now)

    dealer = relationship("Dealer", back_populates="purchases")
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")
    returns = relationship("PurchaseReturn", back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"
    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    item_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    purchase_price = Column(Float, nullable=False, default=0)
    mrp = Column(Float, default=0)
    sale_price = Column(Float, default=0)
    gst_percent = Column(Float, default=0)
    taxable_amount = Column(Float, default=0)
    gst_amount = Column(Float, default=0)
    line_total = Column(Float, default=0)
    batch_number = Column(String)
    manufacturing_date = Column(Date)
    expiry_date = Column(Date)
    returned_quantity = Column(Integer, default=0)

    purchase = relationship("Purchase", back_populates="items")
    item = relationship("Item", back_populates="purchase_items")


class PurchaseReturn(Base):
    __tablename__ = "purchase_returns"
    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False)
    purchase_item_id = Column(Integer, ForeignKey("purchase_items.id"), nullable=False)
    dealer_id = Column(Integer, ForeignKey("dealers.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    return_amount = Column(Float, nullable=False, default=0)
    reason = Column(String)
    return_date = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)

    purchase = relationship("Purchase", back_populates="returns")
    purchase_item = relationship("PurchaseItem")


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    expense_name = Column(String, nullable=False)
    category = Column(String, nullable=False, default="Miscellaneous")
    amount = Column(Float, nullable=False)
    payment_mode = Column(String, nullable=False, default="Cash")
    expense_date = Column(DateTime, default=datetime.now)
    note = Column(String)
    created_at = Column(DateTime, default=datetime.now)


class AISettings(Base):
    __tablename__ = "ai_settings"
    id = Column(Integer, primary_key=True, index=True)
    enabled = Column(Integer, nullable=False, default=0)
    provider = Column(String, nullable=False, default="openai")
    model = Column(String)
    encrypted_api_key = Column(String)
    base_url = Column(String)
    ollama_mode = Column(String, default="local")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
