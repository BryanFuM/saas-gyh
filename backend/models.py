import enum
from sqlalchemy import Column, Integer, String, Float, Enum, Numeric, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    VENDEDOR = "VENDEDOR"
    INVENTOR = "INVENTOR"

class VentaType(str, enum.Enum):
    CAJA = "CAJA"
    PEDIDO = "PEDIDO"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VENDEDOR, nullable=False)
    
    ventas = relationship("Venta", back_populates="user")

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    whatsapp_number = Column(String, nullable=True)
    current_debt = Column(Numeric(10, 2), default=0.0, nullable=False)
    
    ventas = relationship("Venta", back_populates="client")
    payments = relationship("ClientPayment", back_populates="client")

class ClientPayment(Base):
    """Registro de pagos/abonos de clientes para reducir deuda"""
    __tablename__ = "client_payments"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(String, nullable=True)
    
    client = relationship("Client", back_populates="payments")

class ProductType(Base):
    """Tipos de producto configurables (ej: Kion, Cúrcuma, etc.)"""
    __tablename__ = "product_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

class ProductQuality(Base):
    """Calidades de producto configurables (ej: Primera, Segunda, etc.)"""
    __tablename__ = "product_qualities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False) # e.g., Kion
    quality = Column(String, nullable=False) # e.g., Primera, Segunda
    conversion_factor = Column(Float, default=20.0, server_default="20.0", nullable=False)  # kg per java
    
    venta_items = relationship("VentaItem", back_populates="product")
    ingresos = relationship("Ingreso", back_populates="product")

class Ingreso(Base):
    __tablename__ = "ingresos"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), server_default=func.now())
    truck_id = Column(String, index=True, nullable=False)
    supplier_name = Column(String, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    total_kg = Column(Float, nullable=False)
    conversion_factor = Column(Float, default=20.0, nullable=False)
    total_javas = Column(Float, nullable=False)
    unit_cost_price = Column(Float, nullable=False)  # Always stored per Java
    
    product = relationship("Product", back_populates="ingresos")

class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), server_default=func.now())
    type = Column(Enum(VentaType), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_amount = Column(Numeric(10, 2), default=0.0, nullable=False)
    is_printed = Column(Boolean, default=False)

    user = relationship("User", back_populates="ventas")
    client = relationship("Client", back_populates="ventas")
    items = relationship("VentaItem", back_populates="venta", cascade="all, delete-orphan")

class VentaItem(Base):
    __tablename__ = "venta_items"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity_javas = Column(Float, nullable=False)  # Always stored in javas (calculated if unit is KG)
    quantity_original = Column(Float, nullable=True)  # Original quantity entered by user
    unit = Column(String, default="JAVA", server_default="JAVA", nullable=False)  # JAVA or KG
    unit_sale_price = Column(Numeric(10, 2), nullable=False)

    venta = relationship("Venta", back_populates="items")
    product = relationship("Product", back_populates="venta_items")

class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), server_default=func.now())
    physical_count = Column(Float, nullable=False)
    system_expected_count = Column(Float, nullable=False)
    difference = Column(Float, nullable=False)
