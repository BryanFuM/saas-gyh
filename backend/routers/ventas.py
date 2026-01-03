"""
Ventas router for sales endpoints.
Handles all sales operations with KG-only units.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import date as date_type
from decimal import Decimal

from database import get_db
from models import User, UserRole, Venta, VentaItem, Client, VentaType
from schemas import VentaCreate, VentaUpdate, VentaOut, VentaItemOut
from auth import get_current_user, RoleChecker
from services import venta_service
from utils.logging import get_logger

router = APIRouter(prefix="/ventas", tags=["Ventas"])

logger = get_logger("routers.ventas")

allow_admin = RoleChecker([UserRole.ADMIN])
allow_vendedor = RoleChecker([UserRole.ADMIN, UserRole.VENDEDOR])


def _format_venta_response(venta: Venta) -> dict:
    """Format Venta to response dict with related data."""
    items = []
    for item in venta.items:
        items.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else None,
            "quantity_kg": item.quantity_kg,
            "quantity_javas": item.quantity_javas,
            "conversion_factor": item.conversion_factor,
            "price_per_kg": item.price_per_kg,
            "subtotal": item.subtotal
        })
    
    previous_debt = None
    new_debt = None
    if venta.client:
        # Calculate previous debt (current - this sale's amount for PEDIDO)
        if venta.type == VentaType.PEDIDO:
            previous_debt = venta.client.current_debt - venta.total_amount
            new_debt = venta.client.current_debt
    
    return {
        "id": venta.id,
        "date": venta.date,
        "type": venta.type,
        "client_id": venta.client_id,
        "client_name": venta.client.name if venta.client else None,
        "user_id": venta.user_id,
        "user_name": venta.user.username if venta.user else None,
        "total_amount": venta.total_amount,
        "is_printed": venta.is_printed,
        "items": items,
        "previous_debt": previous_debt,
        "new_debt": new_debt
    }


@router.post("", response_model=VentaOut)
async def create_venta(
    venta_in: VentaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_vendedor)
):
    """
    Crear una nueva venta.
    
    - **type**: CAJA (contado) o PEDIDO (crédito)
    - **client_id**: Requerido para PEDIDO
    - **items**: Lista de productos con cantidad en KG y precio por KG
    
    El sistema valida stock disponible antes de crear la venta.
    Para ventas PEDIDO, se actualiza la deuda del cliente.
    """
    logger.info(f"User {current_user.username} creating {venta_in.type.value} sale")
    
    # Convert Pydantic models to dicts for service
    items_data = [
        {
            "product_id": item.product_id,
            "quantity_kg": float(item.quantity_kg),
            "price_per_kg": float(item.price_per_kg)
        }
        for item in venta_in.items
    ]
    
    venta = await venta_service.create_venta(
        db=db,
        user_id=current_user.id,
        venta_type=venta_in.type,
        items_data=items_data,
        client_id=venta_in.client_id
    )
    
    return _format_venta_response(venta)


@router.get("", response_model=List[VentaOut])
async def get_ventas(
    date: Optional[date_type] = Query(None, description="Filtrar por fecha exacta"),
    start_date: Optional[date_type] = Query(None, description="Fecha de inicio"),
    end_date: Optional[date_type] = Query(None, description="Fecha de fin"),
    client_id: Optional[int] = Query(None, description="Filtrar por cliente"),
    type: Optional[VentaType] = Query(None, description="Filtrar por tipo (CAJA/PEDIDO)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Listar ventas con filtros.
    
    - Vendedores: Solo ven sus ventas del día actual
    - Administradores: Ven todas las ventas con filtros opcionales
    """
    query = (
        select(Venta)
        .options(
            selectinload(Venta.items).selectinload(VentaItem.product),
            selectinload(Venta.client),
            selectinload(Venta.user)
        )
    )
    
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
    
    query = query.order_by(Venta.date.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    ventas = result.scalars().all()
    
    return [_format_venta_response(v) for v in ventas]


@router.get("/{venta_id}", response_model=VentaOut)
async def get_venta(
    venta_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener detalle de una venta específica."""
    venta = await venta_service.get_venta(db, venta_id)
    
    # RBAC: Check access
    if current_user.role == UserRole.VENDEDOR:
        today = date_type.today()
        if venta.user_id != current_user.id or venta.date.date() != today:
            raise HTTPException(
                status_code=403,
                detail="No tienes permiso para ver esta venta"
            )
    
    return _format_venta_response(venta)


@router.put("/{venta_id}", response_model=VentaOut)
async def update_venta(
    venta_id: int,
    venta_in: VentaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Actualizar una venta existente.
    
    - Vendedores: Solo pueden editar sus ventas del día
    - Administradores: Pueden editar cualquier venta
    """
    # Get existing sale for RBAC check
    existing = await venta_service.get_venta(db, venta_id)
    
    # RBAC Check
    is_admin = current_user.role == UserRole.ADMIN
    is_today = existing.date.date() == date_type.today()
    is_own = existing.user_id == current_user.id
    
    if not is_admin and not (is_today and is_own):
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para editar esta venta"
        )
    
    # Convert items to dicts
    items_data = [
        {
            "product_id": item.product_id,
            "quantity_kg": float(item.quantity_kg),
            "price_per_kg": float(item.price_per_kg)
        }
        for item in venta_in.items
    ]
    
    venta = await venta_service.update_venta(
        db=db,
        venta_id=venta_id,
        items_data=items_data,
        client_id=venta_in.client_id
    )
    
    return _format_venta_response(venta)


@router.delete("/{venta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_venta(
    venta_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Eliminar una venta.
    
    - Vendedores: Solo pueden eliminar sus ventas del día
    - Administradores: Pueden eliminar cualquier venta
    
    Para ventas PEDIDO, la deuda del cliente se revierte.
    """
    # Get existing sale for RBAC check
    existing = await venta_service.get_venta(db, venta_id)
    
    # RBAC Check
    is_admin = current_user.role == UserRole.ADMIN
    is_today = existing.date.date() == date_type.today()
    is_own = existing.user_id == current_user.id
    
    if not is_admin and not (is_today and is_own):
        raise HTTPException(
            status_code=403,
            detail="Solo los administradores pueden eliminar ventas de días anteriores"
        )
    
    await venta_service.delete_venta(db, venta_id)
    return None


@router.patch("/{venta_id}/print")
async def mark_as_printed(
    venta_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_vendedor)
):
    """Marcar una venta como impresa."""
    venta = await venta_service.get_venta(db, venta_id)
    venta.is_printed = True
    await db.commit()
    return {"message": "Venta marcada como impresa"}
