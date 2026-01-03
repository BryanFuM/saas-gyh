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
    ingreso_items = relationship("IngresoItem", back_populates="product")


class IngresoLote(Base):
    """
    Lote de ingreso de mercadería.
    Representa un camión que llega con uno o más proveedores.
    """
    __tablename__ = "ingreso_lotes"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), server_default=func.now())
    truck_id = Column(String, index=True, nullable=False)  # Placa del camión
    
    # Relación con items (uno por proveedor-producto)
    items = relationship("IngresoItem", back_populates="lote", cascade="all, delete-orphan")


class IngresoItem(Base):
    """
    Item de ingreso por proveedor y producto.
    Un lote puede tener múltiples items (un proveedor puede traer varios productos).
    """
    __tablename__ = "ingreso_items"

    id = Column(Integer, primary_key=True, index=True)
    ingreso_lote_id = Column(Integer, ForeignKey("ingreso_lotes.id"), nullable=False)
    supplier_name = Column(String, nullable=False)  # Nombre del proveedor
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    # Cantidades
    total_kg = Column(Float, nullable=False)
    conversion_factor = Column(Float, default=20.0, nullable=False)  # kg por java
    total_javas = Column(Float, nullable=False)  # Calculado: total_kg / conversion_factor
    
    # Costos (siempre almacenados por java para consistencia)
    cost_per_java = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)  # Calculado: cost_per_java * total_javas
    
    # Relaciones
    lote = relationship("IngresoLote", back_populates="items")
    product = relationship("Product", back_populates="ingreso_items")


# Modelo legacy - mantener para migración si es necesario
class Ingreso(Base):
    """DEPRECATED: Usar IngresoLote e IngresoItem en su lugar."""
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
    """
    Item de una venta.
    Todas las cantidades se manejan en KG, la conversión a javas se hace internamente.
    """
    __tablename__ = "venta_items"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    # Cantidad en KG (entrada del usuario)
    quantity_kg = Column(Float, nullable=False)
    # Cantidad en javas (calculado para stock)
    quantity_javas = Column(Float, nullable=False)
    # Factor de conversión usado (para trazabilidad)
    conversion_factor = Column(Float, nullable=False)
    # Precio por KG
    price_per_kg = Column(Numeric(10, 2), nullable=False)
    # Subtotal (quantity_kg * price_per_kg)
    subtotal = Column(Numeric(10, 2), nullable=False)

    venta = relationship("Venta", back_populates="items")
    product = relationship("Product", back_populates="venta_items")

class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), server_default=func.now())
    physical_count = Column(Float, nullable=False)
    system_expected_count = Column(Float, nullable=False)
    difference = Column(Float, nullable=False)
