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
    consignor_id: Optional[str] = None  # external boutique ID (e.g. 2XXX); auto if omitted
    expiry_action: Optional[str] = ""  # donate / pick-up / freeform notes
    date_of_drop_off: Optional[str] = ""  # YYYY-MM-DD when parseable
    import_flags: Optional[List[str]] = None


class ConsignorUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    payout_method: Optional[str] = None
    payout_details: Optional[str] = None
    notes: Optional[str] = None
    expiry_action: Optional[str] = None
    date_of_drop_off: Optional[str] = None
    import_flags: Optional[List[str]] = None


class ConsignorImportRowIssue(BaseModel):
    row: int
    reason: str
    matched_id: Optional[str] = None


class ConsignorImportFlagged(BaseModel):
    row: int
    consignor_id: str
    flags: List[str]


class ConsignorImportResult(BaseModel):
    created: int
    skipped: int
    flagged: int
    errors: List[ConsignorImportRowIssue]
    created_ids: List[str]
    skipped_rows: List[ConsignorImportRowIssue]
    flagged_rows: List[ConsignorImportFlagged]


class InventoryImportRowIssue(BaseModel):
    row: int
    reason: str
    matched_id: Optional[str] = None


class InventoryImportFlagged(BaseModel):
    row: int
    item_id: str
    consignor_id: str
    flags: List[str]


class InventoryImportResult(BaseModel):
    created: int
    skipped: int
    flagged: int
    consignors_created: int
    errors: List[InventoryImportRowIssue]
    created_ids: List[str]
    skipped_rows: List[InventoryImportRowIssue]
    flagged_rows: List[InventoryImportFlagged]
    created_consignor_ids: List[str]


# ----- Inventory -----
class InventoryItemCreate(BaseModel):
    consignor_id: str
    description: str
    category: str = "Other"
    size: Optional[str] = ""
    condition: Optional[str] = ""
    asking_price: float
    date_in: Optional[str] = None  # ISO date
    rack: Optional[str] = ""
    color: Optional[str] = ""
    text_id: Optional[str] = ""
    media: Optional[List[str]] = None


class InventoryItemUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    size: Optional[str] = None
    condition: Optional[str] = None
    asking_price: Optional[float] = None
    status: Optional[str] = None
    sale_price: Optional[float] = None
    rack: Optional[str] = None
    color: Optional[str] = None
    text_id: Optional[str] = None
    media: Optional[List[str]] = None
    import_flags: Optional[List[str]] = None


class BulkAction(BaseModel):
    item_ids: List[str]
    action: Literal["sold", "donated", "returned", "active"]


ConfidenceLevel = Literal["high", "medium", "low"]


class ScanAssistResult(BaseModel):
    """AI suggestions from item + tag photos. Never auto-saves inventory."""

    consignor_id: Optional[str] = ""
    text_id: Optional[str] = ""
    description: Optional[str] = ""
    category: Optional[str] = "Other"
    size: Optional[str] = ""
    condition: Optional[str] = ""
    color: Optional[str] = ""
    rack: Optional[str] = ""
    asking_price: Optional[float] = None
    date_in: Optional[str] = ""
    confidence: dict[str, ConfidenceLevel] = Field(default_factory=dict)
    notes: Optional[str] = ""


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
