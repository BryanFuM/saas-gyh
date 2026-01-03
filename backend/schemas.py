from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from models import UserRole, VentaType

# Auth Schemas
class Token(BaseModel):
    """Response model for login endpoint with access and refresh tokens."""
    access_token: str
    refresh_token: str
    token_type: str


class TokenRefresh(BaseModel):
    """Request model for token refresh endpoint."""
    refresh_token: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole = UserRole.VENDEDOR

class UserOut(BaseModel):
    id: int
    username: str
    role: UserRole

    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)

# Product Type & Quality Schemas
class ProductTypeBase(BaseModel):
    name: str

class ProductTypeCreate(ProductTypeBase):
    pass

class ProductTypeOut(ProductTypeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class ProductQualityBase(BaseModel):
    name: str

class ProductQualityCreate(ProductQualityBase):
    pass

class ProductQualityOut(ProductQualityBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# Product Schemas
class ProductBase(BaseModel):
    name: str
    type: str
    quality: str
    conversion_factor: float = 20.0  # kg per java

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    quality: Optional[str] = None
    conversion_factor: Optional[float] = None

class ProductOut(ProductBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# Ingreso Schemas (New multi-supplier model)
class IngresoItemCreate(BaseModel):
    """Input for a single item in an ingreso lote."""
    supplier_name: str = Field(..., min_length=2, max_length=100, description="Nombre del proveedor")
    product_id: int = Field(..., gt=0, description="ID del producto")
    total_kg: float = Field(..., gt=0, description="Total en kilogramos")
    conversion_factor: float = Field(default=20.0, gt=0, description="Factor de conversión kg/java")
    cost_price_input: float = Field(..., gt=0, description="Precio de costo ingresado")
    cost_price_mode: str = Field(default="JAVA", pattern="^(KG|JAVA)$", description="Modo de precio: 'KG' o 'JAVA'")


class IngresoItemOut(BaseModel):
    """Output for a single item in an ingreso lote."""
    id: int
    supplier_name: str
    product_id: int
    product_name: Optional[str] = None
    total_kg: float
    conversion_factor: float
    total_javas: float
    cost_per_java: float
    total_cost: float
    
    model_config = ConfigDict(from_attributes=True)


class IngresoLoteCreate(BaseModel):
    """Input for creating an ingreso lote with multiple suppliers."""
    truck_id: str = Field(..., min_length=3, max_length=20, description="Placa del camión")
    date: Optional[datetime] = Field(default=None, description="Fecha de ingreso (opcional)")
    items: List[IngresoItemCreate] = Field(..., min_length=1, description="Items del ingreso (mínimo 1)")


class IngresoLoteOut(BaseModel):
    """Output for an ingreso lote with all items."""
    id: int
    date: datetime
    truck_id: str
    items: List[IngresoItemOut]
    total_kg: Optional[float] = None
    total_javas: Optional[float] = None
    total_cost: Optional[float] = None
    
    model_config = ConfigDict(from_attributes=True)


# Legacy Ingreso Schemas (for backwards compatibility during transition)
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

class IngresoOut(BaseModel):
    """Output schema for legacy ingreso - not inheriting to avoid field override issues."""
    id: int
    truck_id: str
    supplier_name: str
    product_id: int
    total_kg: float
    conversion_factor: float
    total_javas: float
    unit_cost_price: float
    date: datetime

    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)

class StockOut(BaseModel):
    product_id: int
    product_name: str
    total_javas_available: float

# Venta Schemas (Simplified to KG only)
class VentaItemCreate(BaseModel):
    """Input for a sale item. All quantities in KG."""
    product_id: int = Field(..., gt=0, description="ID del producto")
    quantity_kg: float = Field(..., gt=0, description="Cantidad en kilogramos")
    price_per_kg: Decimal = Field(..., gt=0, description="Precio por kilogramo")


class VentaItemOut(BaseModel):
    """Output for a sale item."""
    id: int
    product_id: int
    product_name: Optional[str] = None
    quantity_kg: float
    quantity_javas: float
    conversion_factor: float
    price_per_kg: Decimal
    subtotal: Decimal
    
    model_config = ConfigDict(from_attributes=True)


class VentaCreate(BaseModel):
    """Input for creating a sale."""
    type: VentaType = Field(..., description="Tipo de venta: CAJA o PEDIDO")
    client_id: Optional[int] = Field(default=None, description="ID del cliente (requerido para PEDIDO)")
    items: List[VentaItemCreate] = Field(..., min_length=1, description="Items de la venta")


class VentaUpdate(BaseModel):
    """Input for updating a sale."""
    client_id: Optional[int] = None
    items: List[VentaItemCreate] = Field(..., min_length=1)


class VentaOut(BaseModel):
    """Output for a sale with all details."""
    id: int
    date: datetime
    type: VentaType
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    user_id: int
    user_name: Optional[str] = None
    total_amount: Decimal
    is_printed: bool
    items: List[VentaItemOut]
    previous_debt: Optional[Decimal] = None
    new_debt: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)


# Legacy Venta Schemas (for backwards compatibility)
class VentaItemBase(BaseModel):
    product_id: int
    quantity_javas: float
    unit_sale_price: Decimal
    unit: str = "JAVA"
    quantity_original: Optional[float] = None

class VentaBase(BaseModel):
    type: VentaType
    client_id: Optional[int] = None
    is_printed: bool = False
