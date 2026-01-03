"""
Ingreso service for business logic related to merchandise entry.
Handles calculations, validation, and persistence of ingreso lotes.
"""
from typing import List, Optional
from decimal import Decimal
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import IngresoLote, IngresoItem, Product
from utils.logging import get_logger
from utils.exceptions import NotFoundError, ValidationError
from utils.timezone import now_lima

logger = get_logger("ingreso_service")


class CalculatedItem:
    """Result of item cost calculations."""
    
    def __init__(
        self,
        total_javas: float,
        cost_per_java: float,
        total_cost: float
    ):
        self.total_javas = total_javas
        self.cost_per_java = cost_per_java
        self.total_cost = total_cost
    
    def to_dict(self) -> dict:
        return {
            "total_javas": round(self.total_javas, 2),
            "cost_per_java": round(self.cost_per_java, 2),
            "total_cost": round(self.total_cost, 2)
        }


def calculate_item_costs(
    total_kg: float,
    conversion_factor: float,
    cost_price_input: float,
    cost_price_mode: str  # "KG" or "JAVA"
) -> CalculatedItem:
    """
    Calculate costs for an ingreso item.
    
    This is the SINGLE SOURCE OF TRUTH for ingreso calculations.
    All calculations are done here, not in frontend.
    
    Args:
        total_kg: Total kilograms
        conversion_factor: KG per java
        cost_price_input: Price input from user
        cost_price_mode: "KG" for price per kg, "JAVA" for price per java
    
    Returns:
        CalculatedItem with calculated values
    
    Raises:
        ValidationError: If inputs are invalid
    """
    # Validate inputs
    if total_kg <= 0:
        raise ValidationError("El total en KG debe ser mayor a 0", field="total_kg")
    if conversion_factor <= 0:
        raise ValidationError("El factor de conversión debe ser mayor a 0", field="conversion_factor")
    if cost_price_input <= 0:
        raise ValidationError("El precio de costo debe ser mayor a 0", field="cost_price_input")
    if cost_price_mode not in ("KG", "JAVA"):
        raise ValidationError("Modo de precio debe ser 'KG' o 'JAVA'", field="cost_price_mode")
    
    # Calculate total javas
    total_javas = total_kg / conversion_factor
    
    # Normalize cost to price per java
    if cost_price_mode == "KG":
        # Convert price/kg to price/java
        # price/java = price/kg * kg/java = price/kg * conversion_factor
        cost_per_java = cost_price_input * conversion_factor
    else:
        # Already price per java
        cost_per_java = cost_price_input
    
    # Calculate total cost
    total_cost = cost_per_java * total_javas
    
    logger.debug(
        f"Calculated: {total_kg}kg / {conversion_factor} = {total_javas:.2f} javas, "
        f"cost/java: {cost_per_java:.2f}, total: {total_cost:.2f}"
    )
    
    return CalculatedItem(
        total_javas=total_javas,
        cost_per_java=cost_per_java,
        total_cost=total_cost
    )


async def create_ingreso_lote(
    db: AsyncSession,
    truck_id: str,
    items_data: List[dict],
    date: Optional[str] = None
) -> IngresoLote:
    """
    Create a new ingreso lote with items.
    
    Args:
        db: Database session
        truck_id: Truck plate identifier
        items_data: List of item dictionaries with:
            - supplier_name: str
            - product_id: int
            - total_kg: float
            - conversion_factor: float
            - cost_price_input: float
            - cost_price_mode: str ("KG" or "JAVA")
        date: Optional date string (defaults to now in Lima timezone)
    
    Returns:
        Created IngresoLote with items
    
    Raises:
        ValidationError: If data is invalid
        NotFoundError: If product doesn't exist
    """
    logger.info(f"Creating ingreso lote for truck: {truck_id}")
    
    # Validate truck_id
    if not truck_id or len(truck_id.strip()) < 3:
        raise ValidationError("La placa del camión debe tener al menos 3 caracteres", field="truck_id")
    
    # Validate at least one item
    if not items_data or len(items_data) == 0:
        raise ValidationError("Debe incluir al menos un proveedor/producto", field="items")
    
    # Create lote
    lote = IngresoLote(
        truck_id=truck_id.strip().upper(),
        date=now_lima()
    )
    db.add(lote)
    await db.flush()  # Get the ID
    
    # Process each item
    for idx, item_data in enumerate(items_data):
        # Validate required fields
        supplier_name = item_data.get("supplier_name", "").strip()
        if not supplier_name:
            raise ValidationError(f"Proveedor requerido en item {idx + 1}", field="supplier_name")
        
        product_id = item_data.get("product_id")
        if not product_id:
            raise ValidationError(f"Producto requerido en item {idx + 1}", field="product_id")
        
        # Verify product exists
        product_result = await db.execute(select(Product).where(Product.id == product_id))
        product = product_result.scalars().first()
        if not product:
            raise NotFoundError("Producto", product_id)
        
        # Calculate costs
        calculated = calculate_item_costs(
            total_kg=float(item_data.get("total_kg", 0)),
            conversion_factor=float(item_data.get("conversion_factor", product.conversion_factor)),
            cost_price_input=float(item_data.get("cost_price_input", 0)),
            cost_price_mode=item_data.get("cost_price_mode", "JAVA")
        )
        
        # Create item
        item = IngresoItem(
            ingreso_lote_id=lote.id,
            supplier_name=supplier_name,
            product_id=product_id,
            total_kg=float(item_data["total_kg"]),
            conversion_factor=float(item_data.get("conversion_factor", product.conversion_factor)),
            total_javas=calculated.total_javas,
            cost_per_java=calculated.cost_per_java,
            total_cost=calculated.total_cost
        )
        db.add(item)
        
        logger.debug(f"Added item: {supplier_name} - {product.name} - {calculated.total_javas:.2f} javas")
    
    await db.commit()
    await db.refresh(lote)
    
    # Load items relationship
    result = await db.execute(
        select(IngresoLote)
        .options(selectinload(IngresoLote.items).selectinload(IngresoItem.product))
        .where(IngresoLote.id == lote.id)
    )
    lote = result.scalars().first()
    
    logger.info(f"Created ingreso lote {lote.id} with {len(lote.items)} items")
    return lote


async def get_ingreso_lotes(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50
) -> List[IngresoLote]:
    """
    Get list of ingreso lotes with their items.
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum records to return
    
    Returns:
        List of IngresoLote with items loaded
    """
    result = await db.execute(
        select(IngresoLote)
        .options(selectinload(IngresoLote.items).selectinload(IngresoItem.product))
        .order_by(IngresoLote.date.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


async def get_ingreso_lote(db: AsyncSession, lote_id: int) -> IngresoLote:
    """
    Get a single ingreso lote by ID.
    
    Args:
        db: Database session
        lote_id: Lote ID
    
    Returns:
        IngresoLote with items
    
    Raises:
        NotFoundError: If lote doesn't exist
    """
    result = await db.execute(
        select(IngresoLote)
        .options(selectinload(IngresoLote.items).selectinload(IngresoItem.product))
        .where(IngresoLote.id == lote_id)
    )
    lote = result.scalars().first()
    
    if not lote:
        raise NotFoundError("Lote de ingreso", lote_id)
    
    return lote


async def delete_ingreso_lote(db: AsyncSession, lote_id: int) -> bool:
    """
    Delete an ingreso lote and its items.
    
    Args:
        db: Database session
        lote_id: Lote ID
    
    Returns:
        True if deleted
    
    Raises:
        NotFoundError: If lote doesn't exist
    """
    lote = await get_ingreso_lote(db, lote_id)
    
    await db.delete(lote)
    await db.commit()
    
    logger.info(f"Deleted ingreso lote {lote_id}")
    return True
