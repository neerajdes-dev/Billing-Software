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
    purchase_price: float
    mrp: float
    sale_price: float
    gst_percent: float = 0
    stock: int
class ItemUpdate(ItemCreate):
    pass
class ItemImport(BaseModel):
    items: List[ItemCreate]
class BulkItemUpdateRow(BaseModel):
    id: int
    item_name: str | None = None
    barcode: str | None = None
    purchase_price: float | None = None
    mrp: float | None = None
    sale_price: float | None = None
    gst_percent: float | None = None
    stock_adjustment: int = 0
    adjustment_reason: str = "Bulk update"
class BulkItemUpdate(BaseModel):
    items: List[BulkItemUpdateRow]
class SaleProduct(BaseModel):
    item_id: int
    quantity: int
class SaleCreate(BaseModel):
    customer_name: str | None = None
    customer_mobile: str | None = None
    payment_mode: str
    bill_date: str | None = None
    notes: str | None = None
    products: List[SaleProduct]
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
    remarks: Optional[str] = None
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
