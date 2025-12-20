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
from models import User, UserRole, Venta, VentaItem, Client, Product, VentaType
from schemas import VentaCreate, VentaOut
from auth import get_current_user, RoleChecker

router = APIRouter(prefix="/ventas", tags=["Ventas"])

allow_admin = RoleChecker([UserRole.ADMIN])
allow_vendedor = RoleChecker([UserRole.ADMIN, UserRole.VENDEDOR])

@router.post("", response_model=VentaOut)
async def create_venta(
    venta_in: VentaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_vendedor)
):
    # 1. Calculate total amount and prepare items
    total_amount = Decimal("0.0")
    venta_items = []
    
    # 2. Handle Client and Previous Debt
    previous_debt = None
    client = None
    if venta_in.client_id:
        result = await db.execute(select(Client).where(Client.id == venta_in.client_id))
        client = result.scalars().first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        previous_debt = client.current_debt

    # 3. Create Venta Header
    db_venta = Venta(
        type=venta_in.type,
        client_id=venta_in.client_id,
        user_id=current_user.id,
        is_printed=venta_in.is_printed,
        total_amount=0 # Will update after items
    )
    db.add(db_venta)
    await db.flush() # Get ID

    # 4. Process Items
    for item in venta_in.items:
        item_total = Decimal(str(item.quantity_javas)) * item.unit_sale_price
        total_amount += item_total
        
        db_item = VentaItem(
            venta_id=db_venta.id,
            product_id=item.product_id,
            quantity_javas=item.quantity_javas,
            unit_sale_price=item.unit_sale_price
        )
        db.add(db_item)
        venta_items.append(db_item)

    db_venta.total_amount = total_amount

    # 5. Debt Logic (IF type == 'PEDIDO')
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
        if client_id:
            query = query.where(Venta.client_id == client_id)
        if type:
            query = query.where(Venta.type == type)

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
    result = await db.execute(select(Venta).where(Venta.id == venta_id))
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

    # 4. Update Header and Items (Delete old items, add new ones)
    # In a real app, we might update items individually, but here we replace for simplicity
    await db.execute(VentaItem.__table__.delete().where(VentaItem.venta_id == venta_id))
    
    total_amount = Decimal("0.0")
    for item in venta_in.items:
        item_total = Decimal(str(item.quantity_javas)) * item.unit_sale_price
        total_amount += item_total
        db_item = VentaItem(
            venta_id=db_venta.id,
            product_id=item.product_id,
            quantity_javas=item.quantity_javas,
            unit_sale_price=item.unit_sale_price
        )
        db.add(db_item)

    db_venta.type = venta_in.type
    db_venta.client_id = venta_in.client_id
    db_venta.is_printed = venta_in.is_printed
    db_venta.total_amount = total_amount

    # 5. Apply New Debt
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
    current_user: User = Depends(allow_admin)
):
    result = await db.execute(select(Venta).where(Venta.id == venta_id))
    db_venta = result.scalars().first()
    if not db_venta:
        raise HTTPException(status_code=404, detail="Venta not found")

    # Reversal Logic (Debt)
    if db_venta.type == VentaType.PEDIDO and db_venta.client_id:
        res_client = await db.execute(select(Client).where(Client.id == db_venta.client_id))
        client = res_client.scalars().first()
        if client:
            client.current_debt -= db_venta.total_amount

    await db.delete(db_venta)
    await db.commit()
    return None
