"""Pydantic models for The Elegant Exchange - Back of Haus."""
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, EmailStr, ConfigDict


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ----- Users -----
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["owner", "staff"] = "staff"


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


# ----- Consignors -----
class ConsignorCreate(BaseModel):
    full_name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    payout_method: Literal["Cash", "Check", "Zelle", "Venmo", "Store Credit"] = "Cash"
    payout_details: Optional[str] = ""
    notes: Optional[str] = ""


class ConsignorUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    payout_method: Optional[str] = None
    payout_details: Optional[str] = None
    notes: Optional[str] = None


# ----- Inventory -----
class InventoryItemCreate(BaseModel):
    consignor_id: str
    description: str
    category: str
    size: Optional[str] = ""
    condition: Optional[str] = ""
    asking_price: float
    date_in: Optional[str] = None  # ISO date


class InventoryItemUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    size: Optional[str] = None
    condition: Optional[str] = None
    asking_price: Optional[float] = None
    status: Optional[str] = None
    sale_price: Optional[float] = None


class BulkAction(BaseModel):
    item_ids: List[str]
    action: Literal["sold", "donated", "returned", "active"]


# ----- Sales -----
class SaleCreate(BaseModel):
    item_id: str
    sale_price: float
    sale_date: Optional[str] = None
    notes: Optional[str] = ""


# ----- Payouts -----
class PayoutCreate(BaseModel):
    consignor_id: str
    amount: float
    method: Literal["Cash", "Check", "Zelle", "Venmo", "Store Credit"]
    notes: Optional[str] = ""
