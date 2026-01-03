"""
Venta service for business logic related to sales.
Handles calculations, validation, stock checks, and debt management.
"""
from typing import List, Optional
from decimal import Decimal
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import Venta, VentaItem, Product, Client, VentaType
from services.stock_service import validate_stock_disponible, get_product_stock
from utils.logging import get_logger
from utils.exceptions import NotFoundError, ValidationError, BusinessRuleError
from utils.timezone import now_lima

logger = get_logger("venta_service")


class CalculatedVentaItem:
    """Result of venta item calculations."""
    
    def __init__(
        self,
        quantity_kg: float,
        quantity_javas: float,
        conversion_factor: float,
        price_per_kg: Decimal,
        subtotal: Decimal
    ):
        self.quantity_kg = quantity_kg
        self.quantity_javas = quantity_javas
        self.conversion_factor = conversion_factor
        self.price_per_kg = price_per_kg
        self.subtotal = subtotal


def calculate_venta_item(
    quantity_kg: float,
    conversion_factor: float,
    price_per_kg: float
) -> CalculatedVentaItem:
    """
    Calculate values for a venta item.
    
    This is the SINGLE SOURCE OF TRUTH for venta item calculations.
    All quantities are in KG, conversions to javas for stock are internal.
    
    Args:
        quantity_kg: Quantity in kilograms
        conversion_factor: KG per java for the product
        price_per_kg: Sale price per KG
    
    Returns:
        CalculatedVentaItem with calculated values
    
    Raises:
        ValidationError: If inputs are invalid
    """
    if quantity_kg <= 0:
        raise ValidationError("La cantidad en KG debe ser mayor a 0", field="quantity_kg")
    if conversion_factor <= 0:
        raise ValidationError("El factor de conversión debe ser mayor a 0", field="conversion_factor")
    if price_per_kg <= 0:
        raise ValidationError("El precio por KG debe ser mayor a 0", field="price_per_kg")
    
    # Calculate javas for stock tracking
    quantity_javas = quantity_kg / conversion_factor
    
    # Calculate subtotal
    subtotal = Decimal(str(quantity_kg)) * Decimal(str(price_per_kg))
    
    return CalculatedVentaItem(
        quantity_kg=quantity_kg,
        quantity_javas=quantity_javas,
        conversion_factor=conversion_factor,
        price_per_kg=Decimal(str(price_per_kg)),
        subtotal=subtotal
    )


async def create_venta(
    db: AsyncSession,
    user_id: int,
    venta_type: VentaType,
    items_data: List[dict],
    client_id: Optional[int] = None
) -> Venta:
    """
    Create a new sale.
    
    Args:
        db: Database session
        user_id: ID of the user creating the sale
        venta_type: CAJA (cash) or PEDIDO (credit)
        items_data: List of item dictionaries with:
            - product_id: int
            - quantity_kg: float
            - price_per_kg: float
        client_id: Required for PEDIDO type
    
    Returns:
        Created Venta with items
    
    Raises:
        ValidationError: If data is invalid
        NotFoundError: If product/client doesn't exist
        StockInsuficienteError: If not enough stock
    """
    logger.info(f"Creating venta type {venta_type.value} by user {user_id}")
    
    # Validate PEDIDO requires client
    if venta_type == VentaType.PEDIDO and not client_id:
        raise ValidationError("Las ventas a crédito requieren un cliente", field="client_id")
    
    # Validate at least one item
    if not items_data or len(items_data) == 0:
        raise ValidationError("Debe incluir al menos un producto", field="items")
    
    # Get client if PEDIDO
    client = None
    if client_id:
        client_result = await db.execute(select(Client).where(Client.id == client_id))
        client = client_result.scalars().first()
        if not client:
            raise NotFoundError("Cliente", client_id)
    
    # Create venta
    venta = Venta(
        date=now_lima(),
        type=venta_type,
        client_id=client_id,
        user_id=user_id,
        total_amount=Decimal("0.00"),
        is_printed=False
    )
    db.add(venta)
    await db.flush()
    
    total_amount = Decimal("0.00")
    
    # Process each item
    for idx, item_data in enumerate(items_data):
        product_id = item_data.get("product_id")
        if not product_id:
            raise ValidationError(f"Producto requerido en item {idx + 1}", field="product_id")
        
        # Get product
        product_result = await db.execute(select(Product).where(Product.id == product_id))
        product = product_result.scalars().first()
        if not product:
            raise NotFoundError("Producto", product_id)
        
        quantity_kg = float(item_data.get("quantity_kg", 0))
        price_per_kg = float(item_data.get("price_per_kg", 0))
        
        # Validate stock
        await validate_stock_disponible(db, product_id, quantity_kg)
        
        # Calculate item
        calculated = calculate_venta_item(
            quantity_kg=quantity_kg,
            conversion_factor=product.conversion_factor,
            price_per_kg=price_per_kg
        )
        
        # Create item
        item = VentaItem(
            venta_id=venta.id,
            product_id=product_id,
            quantity_kg=calculated.quantity_kg,
            quantity_javas=calculated.quantity_javas,
            conversion_factor=calculated.conversion_factor,
            price_per_kg=calculated.price_per_kg,
            subtotal=calculated.subtotal
        )
        db.add(item)
        
        total_amount += calculated.subtotal
        logger.debug(f"Added item: {product.name} - {quantity_kg}kg @ {price_per_kg}/kg = {calculated.subtotal}")
    
    # Update total
    venta.total_amount = total_amount
    
    # Update client debt for PEDIDO
    if venta_type == VentaType.PEDIDO and client:
        client.current_debt += total_amount
        logger.info(f"Updated client {client.name} debt: +{total_amount} = {client.current_debt}")
    
    await db.commit()
    await db.refresh(venta)
    
    # Load relationships
    result = await db.execute(
        select(Venta)
        .options(
            selectinload(Venta.items).selectinload(VentaItem.product),
            selectinload(Venta.client),
            selectinload(Venta.user)
        )
        .where(Venta.id == venta.id)
    )
    venta = result.scalars().first()
    
    logger.info(f"Created venta {venta.id} with {len(venta.items)} items, total: {total_amount}")
    return venta


async def get_ventas(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    venta_type: Optional[VentaType] = None,
    user_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
) -> List[Venta]:
    """
    Get list of ventas with filters.
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum records to return
        venta_type: Filter by type (CAJA/PEDIDO)
        user_id: Filter by user
        date_from: Filter from date
        date_to: Filter to date
    
    Returns:
        List of Venta with items loaded
    """
    query = (
        select(Venta)
        .options(
            selectinload(Venta.items).selectinload(VentaItem.product),
            selectinload(Venta.client),
            selectinload(Venta.user)
        )
    )
    
    if venta_type:
        query = query.where(Venta.type == venta_type)
    
    if user_id:
        query = query.where(Venta.user_id == user_id)
    
    query = query.order_by(Venta.date.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_venta(db: AsyncSession, venta_id: int) -> Venta:
    """
    Get a single venta by ID.
    
    Args:
        db: Database session
        venta_id: Venta ID
    
    Returns:
        Venta with items
    
    Raises:
        NotFoundError: If venta doesn't exist
    """
    result = await db.execute(
        select(Venta)
        .options(
            selectinload(Venta.items).selectinload(VentaItem.product),
            selectinload(Venta.client),
            selectinload(Venta.user)
        )
        .where(Venta.id == venta_id)
    )
    venta = result.scalars().first()
    
    if not venta:
        raise NotFoundError("Venta", venta_id)
    
    return venta


async def delete_venta(db: AsyncSession, venta_id: int) -> bool:
    """
    Delete a venta and revert client debt if applicable.
    
    Args:
        db: Database session
        venta_id: Venta ID
    
    Returns:
        True if deleted
    
    Raises:
        NotFoundError: If venta doesn't exist
    """
    venta = await get_venta(db, venta_id)
    
    # Revert debt for PEDIDO
    if venta.type == VentaType.PEDIDO and venta.client:
        venta.client.current_debt -= venta.total_amount
        if venta.client.current_debt < 0:
            venta.client.current_debt = Decimal("0.00")
        logger.info(f"Reverted client {venta.client.name} debt: -{venta.total_amount}")
    
    await db.delete(venta)
    await db.commit()
    
    logger.info(f"Deleted venta {venta_id}")
    return True


async def update_venta(
    db: AsyncSession,
    venta_id: int,
    items_data: List[dict],
    client_id: Optional[int] = None
) -> Venta:
    """
    Update an existing venta.
    
    Args:
        db: Database session
        venta_id: Venta ID
        items_data: New items data
        client_id: New client ID (for PEDIDO)
    
    Returns:
        Updated Venta
    
    Raises:
        NotFoundError: If venta doesn't exist
        ValidationError: If data is invalid
    """
    venta = await get_venta(db, venta_id)
    old_total = venta.total_amount
    old_client = venta.client
    
    # Validate at least one item
    if not items_data or len(items_data) == 0:
        raise ValidationError("Debe incluir al menos un producto", field="items")
    
    # Handle client change for PEDIDO
    if venta.type == VentaType.PEDIDO:
        if not client_id:
            raise ValidationError("Las ventas a crédito requieren un cliente", field="client_id")
        
        # Revert old client debt
        if old_client:
            old_client.current_debt -= old_total
            if old_client.current_debt < 0:
                old_client.current_debt = Decimal("0.00")
    
    # Update client
    if client_id and client_id != venta.client_id:
        client_result = await db.execute(select(Client).where(Client.id == client_id))
        new_client = client_result.scalars().first()
        if not new_client:
            raise NotFoundError("Cliente", client_id)
        venta.client_id = client_id
        venta.client = new_client
    
    # Delete old items
    for item in venta.items:
        await db.delete(item)
    
    # Process new items
    total_amount = Decimal("0.00")
    
    for idx, item_data in enumerate(items_data):
        product_id = item_data.get("product_id")
        if not product_id:
            raise ValidationError(f"Producto requerido en item {idx + 1}", field="product_id")
        
        product_result = await db.execute(select(Product).where(Product.id == product_id))
        product = product_result.scalars().first()
        if not product:
            raise NotFoundError("Producto", product_id)
        
        quantity_kg = float(item_data.get("quantity_kg", 0))
        price_per_kg = float(item_data.get("price_per_kg", 0))
        
        calculated = calculate_venta_item(
            quantity_kg=quantity_kg,
            conversion_factor=product.conversion_factor,
            price_per_kg=price_per_kg
        )
        
        item = VentaItem(
            venta_id=venta.id,
            product_id=product_id,
            quantity_kg=calculated.quantity_kg,
            quantity_javas=calculated.quantity_javas,
            conversion_factor=calculated.conversion_factor,
            price_per_kg=calculated.price_per_kg,
            subtotal=calculated.subtotal
        )
        db.add(item)
        
        total_amount += calculated.subtotal
    
    venta.total_amount = total_amount
    venta.date = now_lima()
    
    # Update new client debt
    if venta.type == VentaType.PEDIDO and venta.client:
        venta.client.current_debt += total_amount
    
    await db.commit()
    return await get_venta(db, venta_id)
