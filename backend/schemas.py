from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from models import UserRole, VentaType

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    role: UserRole

    class Config:
        from_attributes = True

# Client Schemas
class ClientBase(BaseModel):
    name: str
    whatsapp_number: Optional[str] = None
    current_debt: Decimal = Field(default=Decimal("0.0"))

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    current_debt: Optional[Decimal] = None

class ClientOut(ClientBase):
    id: int

    class Config:
        from_attributes = True

# Client Payment Schemas
class ClientPaymentCreate(BaseModel):
    amount: Decimal
    notes: Optional[str] = None

class ClientPaymentOut(BaseModel):
    id: int
    client_id: int
    amount: Decimal
    date: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True

# Product Type & Quality Schemas
class ProductTypeBase(BaseModel):
    name: str

class ProductTypeCreate(ProductTypeBase):
    pass

class ProductTypeOut(ProductTypeBase):
    id: int

    class Config:
        from_attributes = True

class ProductQualityBase(BaseModel):
    name: str

class ProductQualityCreate(ProductQualityBase):
    pass

class ProductQualityOut(ProductQualityBase):
    id: int

    class Config:
        from_attributes = True

# Product Schemas
class ProductBase(BaseModel):
    name: str
    type: str
    quality: str

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    quality: Optional[str] = None

class ProductOut(ProductBase):
    id: int

    class Config:
        from_attributes = True

# Ingreso Schemas
class IngresoBase(BaseModel):
    truck_id: str
    supplier_name: str
    product_id: int
    total_kg: float
    conversion_factor: float = 20.0
    total_javas: Optional[float] = None
    unit_cost_price: float

class IngresoCreate(IngresoBase):
    pass

class IngresoOut(IngresoBase):
    id: int
    date: datetime
    total_javas: float

    class Config:
        from_attributes = True

# Inventory Snapshot Schemas
class InventorySnapshotBase(BaseModel):
    physical_count: float
    system_expected_count: float
    difference: float

class InventorySnapshotCreate(InventorySnapshotBase):
    pass

class InventorySnapshotOut(InventorySnapshotBase):
    id: int
    date: datetime

    class Config:
        from_attributes = True

class StockOut(BaseModel):
    product_id: int
    product_name: str
    total_javas_available: float

# Venta Schemas
class VentaItemBase(BaseModel):
    product_id: int
    quantity_javas: float
    unit_sale_price: Decimal

class VentaItemCreate(VentaItemBase):
    pass

class VentaItemOut(VentaItemBase):
    id: int
    
    class Config:
        from_attributes = True

class VentaBase(BaseModel):
    type: VentaType
    client_id: Optional[int] = None
    is_printed: bool = False

class VentaCreate(VentaBase):
    items: List[VentaItemCreate]

class VentaOut(VentaBase):
    id: int
    date: datetime
    user_id: int
    total_amount: Decimal
    items: List[VentaItemOut]
    previous_debt: Optional[Decimal] = None

    class Config:
        from_attributes = True
