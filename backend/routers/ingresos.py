"""
Ingresos router for merchandise entry endpoints.
Handles ingreso lotes with multiple suppliers per truck.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from database import get_db
from models import User, UserRole, InventorySnapshot
from schemas import (
    IngresoLoteCreate, IngresoLoteOut, IngresoItemOut,
    InventorySnapshotCreate, InventorySnapshotOut, StockOut
)
from auth import get_current_user, RoleChecker
from services import ingreso_service, stock_service
from utils.exceptions import AppException
from utils.logging import get_logger

router = APIRouter(prefix="/ingresos", tags=["Ingresos"])

logger = get_logger("routers.ingresos")

# RBAC
allow_admin_or_inventor = RoleChecker([UserRole.ADMIN, UserRole.INVENTOR])
allow_admin = RoleChecker([UserRole.ADMIN])


def _format_lote_response(lote) -> dict:
    """Format IngresoLote to response dict with calculated totals."""
    items = []
    total_kg = 0.0
    total_javas = 0.0
    total_cost = 0.0
    
    for item in lote.items:
        items.append({
            "id": item.id,
            "supplier_name": item.supplier_name,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else None,
            "total_kg": item.total_kg,
            "conversion_factor": item.conversion_factor,
            "total_javas": item.total_javas,
            "cost_per_java": item.cost_per_java,
            "total_cost": item.total_cost
        })
        total_kg += item.total_kg
        total_javas += item.total_javas
        total_cost += item.total_cost
    
    return {
        "id": lote.id,
        "date": lote.date,
        "truck_id": lote.truck_id,
        "items": items,
        "total_kg": round(total_kg, 2),
        "total_javas": round(total_javas, 2),
        "total_cost": round(total_cost, 2)
    }


@router.post("", response_model=IngresoLoteOut)
async def create_ingreso_lote(
    ingreso: IngresoLoteCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin_or_inventor)
):
    """
    Crear un nuevo lote de ingreso de mercadería.
    
    Un lote puede contener múltiples proveedores, cada uno con su producto.
    
    - **truck_id**: Placa del camión
    - **items**: Lista de items (proveedor + producto + cantidades + costos)
    """
    logger.info(f"User {current_user.username} creating ingreso lote for truck {ingreso.truck_id}")
    
    # Convert Pydantic models to dicts for service
    items_data = [item.model_dump() for item in ingreso.items]
    
    lote = await ingreso_service.create_ingreso_lote(
        db=db,
        truck_id=ingreso.truck_id,
        items_data=items_data,
        date=ingreso.date.isoformat() if ingreso.date else None
    )
    
    return _format_lote_response(lote)


@router.get("", response_model=List[IngresoLoteOut])
async def get_ingresos(
    skip: int = Query(0, ge=0, description="Registros a saltar"),
    limit: int = Query(50, ge=1, le=100, description="Límite de registros"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_admin)
):
    """
    Listar lotes de ingreso de mercadería.
    
    Solo accesible para administradores.
    """
    lotes = await ingreso_service.get_ingreso_lotes(db, skip=skip, limit=limit)
    return [_format_lote_response(lote) for lote in lotes]


# ============================================================================
# Stock endpoints (MUST be before /{lote_id} to avoid path conflicts)
# ============================================================================

@router.get("/stock/disponible", response_model=List[StockOut])
async def get_stock(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener stock disponible de todos los productos.
    
    Calcula: ingresos totales - ventas totales por producto.
    """
    stock_map = await stock_service.get_stock_by_product(db)
    
    return [
        StockOut(
            product_id=info.product_id,
            product_name=info.product_name,
            total_javas_available=info.stock_disponible_javas
        )
        for info in stock_map.values()
    ]


@router.get("/stock/detalle")
async def get_stock_detail(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener stock detallado con información de costos.
    
    Incluye: stock en KG, javas, y costo promedio por java.
    """
    stock_map = await stock_service.get_stock_by_product(db)
    
    return [info.to_dict() for info in stock_map.values()]


# ============================================================================
# Individual lote endpoints
# ============================================================================

@router.get("/{lote_id}", response_model=IngresoLoteOut)
async def get_ingreso_lote(
    lote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_admin)
):
    """
    Obtener detalle de un lote de ingreso específico.
    """
    lote = await ingreso_service.get_ingreso_lote(db, lote_id)
    return _format_lote_response(lote)


@router.delete("/{lote_id}")
async def delete_ingreso_lote(
    lote_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_admin)
):
    """
    Eliminar un lote de ingreso y todos sus items.
    
    **Advertencia**: Esto afectará el cálculo de stock.
    """
    await ingreso_service.delete_ingreso_lote(db, lote_id)
    return {"message": "Lote de ingreso eliminado"}


@router.post("/inventory/snapshot", response_model=InventorySnapshotOut, tags=["Inventory"])
async def create_inventory_snapshot(
    snapshot: InventorySnapshotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(allow_admin_or_inventor)
):
    """
    Crear un snapshot de inventario físico.
    
    Usado para comparar inventario físico con el sistema.
    """
    db_snapshot = InventorySnapshot(**snapshot.model_dump())
    db.add(db_snapshot)
    await db.commit()
    await db.refresh(db_snapshot)
    return db_snapshot
