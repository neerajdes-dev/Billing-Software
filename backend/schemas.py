from datetime import date
from pydantic import BaseModel
from typing import List
from pydantic import BaseModel
from typing import Optional

class SignupRequest(BaseModel):
    business_name: str
    user_id: str
    password: str
    email: str
    mobile: str | None = None
    logo: str | None = None
class LoginRequest(BaseModel):
    user_id: str
    password: str
class CustomerCreate(BaseModel):
    customer_name: str
    mobile: str | None = None
    address: str | None = None
class CustomerPaymentCreate(BaseModel):
    customer_id: int
    paid_amount: float
    payment_mode: str = "Cash"
    payment_date: str | None = None
    reference: str | None = None
    note: str | None = None
class ItemCreate(BaseModel):
    item_name: str
    barcode: str
    purchase_price: float = 0
    mrp: float = 0
    sale_price: float = 0
    gst_percent: float = 0
    stock: int = 0
    minimum_stock: int = 5
    batch_number: Optional[str] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    expiry_alert_days: int = 30


class ItemUpdate(ItemCreate):
    pass


class ItemImport(BaseModel):
    items: List[ItemCreate]


class BulkItemUpdateRow(BaseModel):
    id: int
    item_name: Optional[str] = None
    barcode: Optional[str] = None
    purchase_price: Optional[float] = None
    mrp: Optional[float] = None
    sale_price: Optional[float] = None
    gst_percent: Optional[float] = None
    minimum_stock: Optional[int] = None
    batch_number: Optional[str] = None
    manufacturing_date: Optional[date] = None
    expiry_date: Optional[date] = None
    expiry_alert_days: Optional[int] = None
    stock_adjustment: int = 0
    adjustment_reason: str = "Bulk update"


class BulkItemUpdate(BaseModel):
    items: List[BulkItemUpdateRow]


class StockAdjustmentCreate(BaseModel):
    adjustment: int
    reason: str


class SaleProduct(BaseModel):
    item_id: int
    quantity: int
class SaleCreate(BaseModel):
    customer_id: int | None = None
    customer_name: str | None = None
    customer_mobile: str | None = None
    payment_mode: str
    bill_date: str | None = None
    notes: str | None = None
    discount_amount: float = 0
    cash_amount: float = 0
    online_amount: float = 0
    credit_amount: float = 0
    amount_received: float = 0
    loyalty_points_to_redeem: float = 0
    products: List[SaleProduct]

class LoyaltySettingsUpdate(BaseModel):
    enabled: bool = True
    earn_amount: float = 100
    points_per_earn_amount: float = 1
    point_value: float = 1
    minimum_redeem_points: float = 10
    max_redeem_percent: float = 20
    silver_threshold: float = 10000
    gold_threshold: float = 25000
    platinum_threshold: float = 50000


class LoyaltyAdjustmentCreate(BaseModel):
    points: float
    note: str | None = None


class DealerCreate(BaseModel):
    dealer_name: str
    mobile: str
    email: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
class DealerBillCreate(BaseModel):
    dealer_id: int
    bill_amount: float
    bill_date: date
    bill_number: Optional[str] = None
    note: Optional[str] = None
class DealerBillUpdate(BaseModel):
    bill_number: str | None = None
    bill_amount: float
    bill_date: str | None = None
    note: str | None = None
class DealerPaymentCreate(BaseModel):
    dealer_id: int
    paid_amount: float
    payment_mode: str
    payment_date: str | None = None
    reference: str | None = None
    note: str | None = None

class PurchaseLineCreate(BaseModel):
    item_id: int
    quantity: int
    purchase_price: float
    mrp: float | None = None
    sale_price: float | None = None
    gst_percent: float | None = None
    batch_number: str | None = None
    manufacturing_date: date | None = None
    expiry_date: date | None = None


class PurchaseCreate(BaseModel):
    dealer_id: int
    invoice_number: str
    purchase_date: date
    discount_amount: float = 0
    freight_amount: float = 0
    round_off: float = 0
    paid_amount: float = 0
    payment_mode: str = "Credit"
    note: str | None = None
    items: List[PurchaseLineCreate]


class PurchaseReturnCreate(BaseModel):
    purchase_item_id: int
    quantity: int
    reason: str | None = None
    return_date: date | None = None


class ExpenseCreate(BaseModel):
    expense_name: str
    category: str = "Miscellaneous"
    amount: float
    payment_mode: str = "Cash"
    expense_date: str | None = None
    note: str | None = None
class SettingsUpdate(BaseModel):
    business_name: str | None = None
    email: str | None = None
    mobile: str | None = None
    gst_number: str | None = None
    address: str | None = None
class UsernameUpdate(BaseModel):
    new_user_id: str
class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str
