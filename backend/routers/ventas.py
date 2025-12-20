from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, date as date_type
from decimal import Decimal
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import User, UserRole, Venta, VentaItem, Client, Product, VentaType, Ingreso
from schemas import VentaCreate, VentaOut
from auth import get_current_user, RoleChecker

router = APIRouter(prefix="/ventas", tags=["Ventas"])

allow_admin = RoleChecker([UserRole.ADMIN])
allow_vendedor = RoleChecker([UserRole.ADMIN, UserRole.VENDEDOR])


async def get_stock_map(db: AsyncSession) -> dict:
    """Calculate available stock for all products (in javas)"""
    # Get total ingresos per product
    ingresos_query = select(
        Ingreso.product_id,
        func.sum(Ingreso.total_javas).label("total_in")
    ).group_by(Ingreso.product_id)
    ingresos_result = await db.execute(ingresos_query)
    ingresos_map = {row.product_id: float(row.total_in or 0) for row in ingresos_result}
    
    # Get total sold per product
    sold_query = select(
        VentaItem.product_id,
        func.sum(VentaItem.quantity_javas).label("total_out")
    ).group_by(VentaItem.product_id)
    sold_result = await db.execute(sold_query)
    sold_map = {row.product_id: float(row.total_out or 0) for row in sold_result}
    
    # Calculate available stock
    all_product_ids = set(ingresos_map.keys()) | set(sold_map.keys())
    stock_map = {}
    for pid in all_product_ids:
        stock_map[pid] = ingresos_map.get(pid, 0) - sold_map.get(pid, 0)
    
    return stock_map


@router.post("", response_model=VentaOut)
async def create_venta(
    venta_in: VentaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_vendedor)
):
    # 1. Get current stock for validation
    stock_map = await get_stock_map(db)
    
    # 2. Get all products needed for conversion factors
    product_ids = [item.product_id for item in venta_in.items]
    products_result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in products_result.scalars().all()}
    
    # 3. Calculate total amount and prepare items with unit conversion
    total_amount = Decimal("0.0")
    venta_items_data = []
    
    for item in venta_in.items:
        product = products.get(item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        
        # Convert KG to JAVA if needed
        unit = getattr(item, 'unit', 'JAVA') or 'JAVA'
        quantity_original = item.quantity_javas  # This is the user-entered quantity
        
        if unit == 'KG':
            # Convert KG to javas using product's conversion factor
            conversion_factor = product.conversion_factor or 20.0
            quantity_javas = quantity_original / conversion_factor
        else:
            quantity_javas = quantity_original
        
        # Validate stock
        available_stock = stock_map.get(item.product_id, 0)
        if quantity_javas > available_stock:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para {product.name}. Disponible: {available_stock:.2f} javas, Solicitado: {quantity_javas:.2f} javas"
            )
        
        item_total = Decimal(str(quantity_javas)) * item.unit_sale_price
        total_amount += item_total
        
        venta_items_data.append({
            "product_id": item.product_id,
            "quantity_javas": quantity_javas,
            "quantity_original": quantity_original,
            "unit": unit,
            "unit_sale_price": item.unit_sale_price
        })
        
        # Update stock map for subsequent items of same product
        stock_map[item.product_id] = available_stock - quantity_javas
    
    # 4. Handle Client and Previous Debt
    previous_debt = None
    client = None
    if venta_in.client_id:
        result = await db.execute(select(Client).where(Client.id == venta_in.client_id))
        client = result.scalars().first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        previous_debt = client.current_debt

    # 5. Create Venta Header
    db_venta = Venta(
        type=venta_in.type,
        client_id=venta_in.client_id,
        user_id=current_user.id,
        is_printed=venta_in.is_printed,
        total_amount=total_amount
    )
    db.add(db_venta)
    await db.flush()  # Get ID

    # 6. Create Items
    for item_data in venta_items_data:
        db_item = VentaItem(
            venta_id=db_venta.id,
            product_id=item_data["product_id"],
            quantity_javas=item_data["quantity_javas"],
            quantity_original=item_data["quantity_original"],
            unit=item_data["unit"],
            unit_sale_price=item_data["unit_sale_price"]
        )
        db.add(db_item)

    # 7. Debt Logic (IF type == 'PEDIDO')
    if venta_in.type == VentaType.PEDIDO and client:
        client.current_debt += total_amount
        print(f"MOCK: Sending WhatsApp Ticket to {client.whatsapp_number} with Total: {total_amount}")

    await db.commit()
    
    # Re-fetch the venta with items loaded eagerly
    result = await db.execute(
        select(Venta).options(selectinload(Venta.items)).where(Venta.id == db_venta.id)
    )
    db_venta = result.scalars().first()
    
    # Prepare response with previous_debt
    response = VentaOut.from_orm(db_venta)
    response.previous_debt = previous_debt
    return response

@router.get("", response_model=List[VentaOut])
async def get_ventas(
    date: Optional[date_type] = None,
    start_date: Optional[date_type] = None,
    end_date: Optional[date_type] = None,
    client_id: Optional[int] = None,
    type: Optional[VentaType] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Venta).options(selectinload(Venta.items))
    
    # RBAC Security
    if current_user.role == UserRole.VENDEDOR:
        # Only today and own sales
        today = date_type.today()
        query = query.where(
            and_(
                func.date(Venta.date) == today,
                Venta.user_id == current_user.id
            )
        )
    else:
        # ADMIN filters
        if date:
            query = query.where(func.date(Venta.date) == date)
        elif start_date and end_date:
            query = query.where(
                and_(
                    func.date(Venta.date) >= start_date,
                    func.date(Venta.date) <= end_date
                )
            )
        elif start_date:
            query = query.where(func.date(Venta.date) >= start_date)
        elif end_date:
            query = query.where(func.date(Venta.date) <= end_date)
            
        if client_id:
            query = query.where(Venta.client_id == client_id)
        if type:
            query = query.where(Venta.type == type)
    
    # Order by date descending (most recent first)
    query = query.order_by(Venta.date.desc())

    result = await db.execute(query)
    return result.scalars().all()

@router.put("/{venta_id}", response_model=VentaOut)
async def update_venta(
    venta_id: int,
    venta_in: VentaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Get existing sale
    result = await db.execute(select(Venta).options(selectinload(Venta.items)).where(Venta.id == venta_id))
    db_venta = result.scalars().first()
    if not db_venta:
        raise HTTPException(status_code=404, detail="Venta not found")

    # 2. RBAC Check
    is_admin = current_user.role == UserRole.ADMIN
    is_today = db_venta.date.date() == date_type.today()
    
    if not is_admin and not (current_user.role == UserRole.VENDEDOR and is_today):
        raise HTTPException(status_code=403, detail="Not authorized to edit this sale")

    # 3. Reversal Logic (Debt)
    if db_venta.type == VentaType.PEDIDO and db_venta.client_id:
        res_client = await db.execute(select(Client).where(Client.id == db_venta.client_id))
        old_client = res_client.scalars().first()
        if old_client:
            old_client.current_debt -= db_venta.total_amount

    # 4. Get products for conversion
    product_ids = [item.product_id for item in venta_in.items]
    products_result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = {p.id: p for p in products_result.scalars().all()}

    # 5. Delete old items and add new ones
    await db.execute(VentaItem.__table__.delete().where(VentaItem.venta_id == venta_id))
    
    total_amount = Decimal("0.0")
    for item in venta_in.items:
        product = products.get(item.product_id)
        
        unit = getattr(item, 'unit', 'JAVA') or 'JAVA'
        quantity_original = item.quantity_javas
        
        if unit == 'KG' and product:
            conversion_factor = product.conversion_factor or 20.0
            quantity_javas = quantity_original / conversion_factor
        else:
            quantity_javas = quantity_original
        
        item_total = Decimal(str(quantity_javas)) * item.unit_sale_price
        total_amount += item_total
        
        db_item = VentaItem(
            venta_id=db_venta.id,
            product_id=item.product_id,
            quantity_javas=quantity_javas,
            quantity_original=quantity_original,
            unit=unit,
            unit_sale_price=item.unit_sale_price
        )
        db.add(db_item)

    db_venta.type = venta_in.type
    db_venta.client_id = venta_in.client_id
    db_venta.is_printed = venta_in.is_printed
    db_venta.total_amount = total_amount

    # 6. Apply New Debt
    if venta_in.type == VentaType.PEDIDO and venta_in.client_id:
        res_new_client = await db.execute(select(Client).where(Client.id == venta_in.client_id))
        new_client = res_new_client.scalars().first()
        if new_client:
            new_client.current_debt += total_amount

    await db.commit()
    
    # Re-fetch with items loaded eagerly
    result = await db.execute(
        select(Venta).options(selectinload(Venta.items)).where(Venta.id == db_venta.id)
    )
    db_venta = result.scalars().first()
    return db_venta


@router.delete("/{venta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_venta(
    venta_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Venta).where(Venta.id == venta_id))
    db_venta = result.scalars().first()
    if not db_venta:
        raise HTTPException(status_code=404, detail="Venta not found")

    # RBAC: Admin can delete any sale, Vendedor can only delete today's own sales
    is_admin = current_user.role == UserRole.ADMIN
    is_today = db_venta.date.date() == date_type.today()
    is_own_sale = db_venta.user_id == current_user.id
    
    if not is_admin and not (is_today and is_own_sale):
        raise HTTPException(
            status_code=403, 
            detail="Solo los administradores pueden eliminar ventas de días anteriores"
        )

    # Reversal Logic (Debt) - only for PEDIDO type
    if db_venta.type == VentaType.PEDIDO and db_venta.client_id:
        res_client = await db.execute(select(Client).where(Client.id == db_venta.client_id))
        client = res_client.scalars().first()
        if client:
            client.current_debt -= db_venta.total_amount

    await db.delete(db_venta)
    await db.commit()
    return None
