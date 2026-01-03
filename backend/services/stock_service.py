"""
Stock service for centralized stock calculations.
Single source of truth for all stock-related operations.
"""
from typing import Dict, List, Optional
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Product, IngresoItem, VentaItem
from utils.logging import get_logger
from utils.exceptions import StockInsuficienteError, NotFoundError

logger = get_logger("stock_service")


class StockInfo:
    """Stock information for a product."""
    
    def __init__(
        self,
        product_id: int,
        product_name: str,
        total_ingreso_kg: float,
        total_ingreso_javas: float,
        total_vendido_kg: float,
        total_vendido_javas: float,
        costo_promedio_java: float
    ):
        self.product_id = product_id
        self.product_name = product_name
        self.total_ingreso_kg = total_ingreso_kg
        self.total_ingreso_javas = total_ingreso_javas
        self.total_vendido_kg = total_vendido_kg
        self.total_vendido_javas = total_vendido_javas
        self.costo_promedio_java = costo_promedio_java
    
    @property
    def stock_disponible_kg(self) -> float:
        """Stock disponible en KG."""
        return max(0, self.total_ingreso_kg - self.total_vendido_kg)
    
    @property
    def stock_disponible_javas(self) -> float:
        """Stock disponible en javas."""
        return max(0, self.total_ingreso_javas - self.total_vendido_javas)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "product_id": self.product_id,
            "product_name": self.product_name,
            "total_ingreso_kg": round(self.total_ingreso_kg, 2),
            "total_ingreso_javas": round(self.total_ingreso_javas, 2),
            "total_vendido_kg": round(self.total_vendido_kg, 2),
            "total_vendido_javas": round(self.total_vendido_javas, 2),
            "stock_disponible_kg": round(self.stock_disponible_kg, 2),
            "stock_disponible_javas": round(self.stock_disponible_javas, 2),
            "costo_promedio_java": round(self.costo_promedio_java, 2)
        }


async def get_stock_by_product(db: AsyncSession) -> Dict[int, StockInfo]:
    """
    Calculate stock for all products.
    
    Returns:
        Dictionary mapping product_id to StockInfo
    """
    logger.debug("Calculating stock for all products")
    
    # Get all products
    products_result = await db.execute(select(Product))
    products = {p.id: p for p in products_result.scalars().all()}
    
    # Calculate total ingreso per product
    ingreso_query = select(
        IngresoItem.product_id,
        func.sum(IngresoItem.total_kg).label("total_kg"),
        func.sum(IngresoItem.total_javas).label("total_javas"),
        func.sum(IngresoItem.total_cost).label("total_cost")
    ).group_by(IngresoItem.product_id)
    
    ingreso_result = await db.execute(ingreso_query)
    ingresos = {row.product_id: row for row in ingreso_result.all()}
    
    # Calculate total vendido per product
    venta_query = select(
        VentaItem.product_id,
        func.sum(VentaItem.quantity_kg).label("total_kg"),
        func.sum(VentaItem.quantity_javas).label("total_javas")
    ).group_by(VentaItem.product_id)
    
    venta_result = await db.execute(venta_query)
    ventas = {row.product_id: row for row in venta_result.all()}
    
    # Build stock info for each product
    stock_map: Dict[int, StockInfo] = {}
    
    for product_id, product in products.items():
        ingreso_data = ingresos.get(product_id)
        venta_data = ventas.get(product_id)
        
        total_ingreso_kg = float(ingreso_data.total_kg or 0) if ingreso_data else 0
        total_ingreso_javas = float(ingreso_data.total_javas or 0) if ingreso_data else 0
        total_cost = float(ingreso_data.total_cost or 0) if ingreso_data else 0
        
        total_vendido_kg = float(venta_data.total_kg or 0) if venta_data else 0
        total_vendido_javas = float(venta_data.total_javas or 0) if venta_data else 0
        
        # Calculate weighted average cost per java
        costo_promedio = total_cost / total_ingreso_javas if total_ingreso_javas > 0 else 0
        
        stock_map[product_id] = StockInfo(
            product_id=product_id,
            product_name=product.name,
            total_ingreso_kg=total_ingreso_kg,
            total_ingreso_javas=total_ingreso_javas,
            total_vendido_kg=total_vendido_kg,
            total_vendido_javas=total_vendido_javas,
            costo_promedio_java=costo_promedio
        )
    
    logger.debug(f"Stock calculated for {len(stock_map)} products")
    return stock_map


async def get_product_stock(db: AsyncSession, product_id: int) -> StockInfo:
    """
    Get stock for a specific product.
    
    Args:
        db: Database session
        product_id: Product ID
    
    Returns:
        StockInfo for the product
    
    Raises:
        NotFoundError: If product doesn't exist
    """
    stock_map = await get_stock_by_product(db)
    
    if product_id not in stock_map:
        raise NotFoundError("Producto", product_id)
    
    return stock_map[product_id]


async def validate_stock_disponible(
    db: AsyncSession, 
    product_id: int, 
    cantidad_kg: float
) -> bool:
    """
    Validate if there's enough stock for a sale.
    
    Args:
        db: Database session
        product_id: Product ID
        cantidad_kg: Requested quantity in KG
    
    Returns:
        True if stock is available
    
    Raises:
        StockInsuficienteError: If not enough stock
    """
    stock_info = await get_product_stock(db, product_id)
    
    if stock_info.stock_disponible_kg < cantidad_kg:
        raise StockInsuficienteError(
            product_name=stock_info.product_name,
            available=stock_info.stock_disponible_kg,
            requested=cantidad_kg
        )
    
    return True


async def get_costo_promedio(db: AsyncSession, product_id: int) -> float:
    """
    Get weighted average cost per java for a product.
    
    Args:
        db: Database session
        product_id: Product ID
    
    Returns:
        Average cost per java, or 0 if no ingresos
    """
    stock_info = await get_product_stock(db, product_id)
    return stock_info.costo_promedio_java
