from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import User, UserRole, Ingreso, Product, InventorySnapshot
from schemas import IngresoCreate, IngresoOut, InventorySnapshotCreate, InventorySnapshotOut, StockOut
from auth import get_current_user, RoleChecker

router = APIRouter(prefix="/ingresos", tags=["Ingresos & Stock"])

allow_admin_or_inventor = RoleChecker([UserRole.ADMIN, UserRole.INVENTOR])
allow_admin = RoleChecker([UserRole.ADMIN])

@router.post("", response_model=IngresoOut)
async def create_ingreso(
    ingreso: IngresoCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin_or_inventor)
):
    # Calculate total_javas if not provided
    if ingreso.total_javas is None:
        total_javas = ingreso.total_kg / ingreso.conversion_factor
    else:
        total_javas = ingreso.total_javas

    db_ingreso = Ingreso(
        truck_id=ingreso.truck_id,
        supplier_name=ingreso.supplier_name,
        product_id=ingreso.product_id,
        total_kg=ingreso.total_kg,
        conversion_factor=ingreso.conversion_factor,
        total_javas=total_javas,
        unit_cost_price=ingreso.unit_cost_price
    )
    db.add(db_ingreso)
    await db.commit()
    await db.refresh(db_ingreso)
    return db_ingreso

@router.get("", response_model=List[IngresoOut])
async def get_ingresos(
    truck_id: Optional[str] = None,
    date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_admin)
):
    query = select(Ingreso)
    if truck_id:
        query = query.where(Ingreso.truck_id == truck_id)
    if date:
        # Filter by date (ignoring time if needed, but here we use exact or range)
        # For simplicity, let's assume exact match or start of day
        query = query.where(func.date(Ingreso.date) == date.date())
    
    result = await db.execute(query)
    return result.scalars().all()

from models import User, UserRole, Ingreso, Product, InventorySnapshot, VentaItem
# ... (existing code)
@router.get("/stock", response_model=List[StockOut])
async def get_stock(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Get Total Inbound Javas per product
    inbound_query = (
        select(
            Product.id,
            Product.name,
            func.sum(Ingreso.total_javas).label("total_inbound")
        )
        .join(Ingreso, Product.id == Ingreso.product_id)
        .group_by(Product.id, Product.name)
    )
    inbound_result = await db.execute(inbound_query)
    inbound_data = {row[0]: {"name": row[1], "inbound": row[2] or 0.0} for row in inbound_result.all()}

    # 2. Get Total Sold Javas per product
    sold_query = (
        select(
            VentaItem.product_id,
            func.sum(VentaItem.quantity_javas).label("total_sold")
        )
        .group_by(VentaItem.product_id)
    )
    sold_result = await db.execute(sold_query)
    sold_data = {row[0]: row[1] or 0.0 for row in sold_result.all()}

    # 3. Calculate Stock
    stock_list = []
    for product_id, data in inbound_data.items():
        sold = sold_data.get(product_id, 0.0)
        stock_list.append(StockOut(
            product_id=product_id,
            product_name=data["name"],
            total_javas_available=data["inbound"] - sold
        ))
    
    return stock_list

@router.post("/inventory/snapshot", response_model=InventorySnapshotOut, tags=["Inventory"])
async def create_inventory_snapshot(
    snapshot: InventorySnapshotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_admin_or_inventor)
):
    db_snapshot = InventorySnapshot(**snapshot.dict())
    db.add(db_snapshot)
    await db.commit()
    await db.refresh(db_snapshot)
    return db_snapshot
