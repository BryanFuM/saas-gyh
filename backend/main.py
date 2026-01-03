"""
GyH API - Main application module.
FastAPI application with CORS, exception handlers, and route configuration.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import timedelta

from config import settings
from database import engine, Base, get_db, AsyncSessionLocal
from models import User, UserRole, Client, Product, ProductType, ProductQuality, ClientPayment
from schemas import (
    Token, TokenRefresh, UserOut, UserCreate, ClientOut, ClientCreate, ClientUpdate, 
    ProductOut, ProductCreate, ProductUpdate,
    ProductTypeOut, ProductTypeCreate, ProductQualityOut, ProductQualityCreate,
    ClientPaymentOut, ClientPaymentCreate
)
from auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    get_current_user,
    RoleChecker,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    verify_password,
    get_password_hash
)
from routers import ingresos, ventas
from utils.exceptions import AppException
from utils.logging import logger

# OpenAPI Tags for documentation
tags_metadata = [
    {"name": "Auth", "description": "Autenticación y manejo de tokens"},
    {"name": "Users", "description": "Gestión de usuarios (solo Admin)"},
    {"name": "Clients", "description": "Gestión de clientes y pagos"},
    {"name": "Products", "description": "Gestión de productos"},
    {"name": "Config", "description": "Configuración de tipos y calidades"},
    {"name": "Ingresos", "description": "Ingreso de mercadería"},
    {"name": "Ventas", "description": "Registro de ventas"},
]


# ============================================================================
# Lifespan Handler (replaces deprecated on_event)
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and create default admin user on startup."""
    logger.info("Starting GyH API...")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create default admin user if no users exist
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        if not result.scalars().first():
            import bcrypt
            hashed_pw = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            admin_user = User(
                username="admin",
                password_hash=hashed_pw,
                role=UserRole.ADMIN
            )
            db.add(admin_user)
            await db.commit()
            logger.info("✅ Admin user created: admin / admin123")
    
    logger.info("✅ GyH API started successfully")
    
    yield  # Application runs
    
    # Cleanup on shutdown (if needed)
    logger.info("Shutting down GyH API...")


app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION,
    openapi_tags=tags_metadata,
    lifespan=lifespan,
    redirect_slashes=False
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Exception Handlers
# ============================================================================

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom application exceptions with consistent format."""
    logger.warning(f"AppException: {exc.code} - {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict()
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation errors with Spanish messages."""
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })
    
    logger.warning(f"Validation error: {errors}")
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Error de validación en los datos enviados",
                "details": {"errors": errors}
            }
        }
    )


# Include routers
app.include_router(ingresos.router, tags=["Ingresos"])
app.include_router(ventas.router, tags=["Ventas"])


# ============================================================================
# Authentication Endpoints
# ============================================================================

@app.post("/login", response_model=Token, tags=["Auth"])
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user and return access + refresh tokens.
    
    - **username**: User's username
    - **password**: User's password
    
    Returns access_token (30 min) and refresh_token (7 days).
    """
    user = await authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create tokens
    token_data = {"sub": user.username, "role": user.role.value if hasattr(user.role, 'value') else user.role}
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data={"sub": user.username})
    
    logger.info(f"User logged in: {user.username}")
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@app.post("/auth/refresh", response_model=Token, tags=["Auth"])
async def refresh_access_token(
    token_data: TokenRefresh,
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using a valid refresh token.
    
    - **refresh_token**: Valid refresh token from login
    
    Returns new access_token and refresh_token.
    """
    payload = verify_refresh_token(token_data.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de actualización inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )
    
    # Verify user still exists
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    
    # Create new tokens
    token_data_new = {"sub": user.username, "role": user.role.value if hasattr(user.role, 'value') else user.role}
    access_token = create_access_token(data=token_data_new)
    refresh_token = create_refresh_token(data={"sub": user.username})
    
    logger.info(f"Token refreshed for user: {user.username}")
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@app.get("/users/me", response_model=UserOut, tags=["Auth"])
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# RBAC Checkers (must be defined before usage)
allow_admin = RoleChecker([UserRole.ADMIN])
allow_vendedor = RoleChecker([UserRole.ADMIN, UserRole.VENDEDOR])
allow_inventor = RoleChecker([UserRole.ADMIN, UserRole.INVENTOR])


# ============================================================================
# User Management Endpoints (Admin only)
# ============================================================================

@app.get("/users", response_model=list[UserOut], tags=["Users"])
async def list_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    """Lista todos los usuarios del sistema (solo Admin)."""
    result = await db.execute(select(User))
    return result.scalars().all()


@app.post("/users", response_model=UserOut, tags=["Users"])
async def create_user(user_data: UserCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    """Crear nuevo usuario (solo Admin)."""
    # Check if username already exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        hashed_password=hashed_password,
        role=user_data.role
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


@app.delete("/users/{user_id}", tags=["Users"])
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    """Eliminar usuario (solo Admin). No puedes eliminarte a ti mismo."""
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    await db.delete(user)
    await db.commit()
    return {"message": "Usuario eliminado"}


# ============================================================================
# Client Endpoints
# ============================================================================

@app.get("/clients", response_model=list[ClientOut], tags=["Clients"])
async def get_clients(db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_vendedor)):
    """Lista todos los clientes."""
    result = await db.execute(select(Client))
    return result.scalars().all()


@app.post("/clients", response_model=ClientOut, tags=["Clients"])
async def create_client(client: ClientCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_vendedor)):
    """Crear nuevo cliente."""
    db_client = Client(**client.dict())
    db.add(db_client)
    await db.commit()
    await db.refresh(db_client)
    return db_client


# ============================================================================
# Product Endpoints
# ============================================================================

@app.get("/products", response_model=list[ProductOut], tags=["Products"])
async def get_products(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lista todos los productos."""
    result = await db.execute(select(Product))
    return result.scalars().all()


@app.post("/products", response_model=ProductOut, tags=["Products"])
async def create_product(product: ProductCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    """Crear nuevo producto (solo Admin)."""
    db_product = Product(**product.dict())
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product


@app.put("/products/{product_id}", response_model=ProductOut, tags=["Products"])
async def update_product(product_id: int, product: ProductUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    """Actualizar producto existente (solo Admin)."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalars().first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
    
    await db.commit()
    await db.refresh(db_product)
    return db_product


@app.delete("/products/{product_id}", tags=["Products"])
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    """Eliminar producto (solo Admin)."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalars().first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    await db.delete(db_product)
    await db.commit()
    return {"message": "Producto eliminado"}


@app.put("/clients/{client_id}", response_model=ClientOut, tags=["Clients"])
async def update_client(client_id: int, client: ClientUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_vendedor)):
    """Actualizar cliente existente."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    db_client = result.scalars().first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    update_data = client.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_client, key, value)
    
    await db.commit()
    await db.refresh(db_client)
    return db_client


@app.get("/clients/{client_id}", response_model=ClientOut, tags=["Clients"])
async def get_client(client_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_vendedor)):
    """Obtener cliente por ID."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    db_client = result.scalars().first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return db_client


# ============================================================================
# Client Payments (Abonos)
# ============================================================================

@app.post("/clients/{client_id}/payments", response_model=ClientPaymentOut, tags=["Clients"])
async def create_payment(
    client_id: int, 
    payment: ClientPaymentCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_vendedor)
):
    """Registrar pago/abono de cliente."""
    result = await db.execute(select(Client).where(Client.id == client_id))
    db_client = result.scalars().first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Create payment record
    db_payment = ClientPayment(
        client_id=client_id,
        amount=payment.amount,
        notes=payment.notes
    )
    db.add(db_payment)
    
    # Reduce client debt
    db_client.current_debt -= payment.amount
    if db_client.current_debt < 0:
        db_client.current_debt = 0
    
    await db.commit()
    await db.refresh(db_payment)
    return db_payment


@app.get("/clients/{client_id}/payments", response_model=list[ClientPaymentOut], tags=["Clients"])
async def get_client_payments(
    client_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_vendedor)
):
    """Obtener historial de pagos de un cliente."""
    result = await db.execute(select(ClientPayment).where(ClientPayment.client_id == client_id))
    return result.scalars().all()


# ============================================================================
# Configuration Endpoints
# ============================================================================

@app.get("/config/product-types", response_model=list[ProductTypeOut], tags=["Config"])
async def get_product_types(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lista todos los tipos de productos."""
    result = await db.execute(select(ProductType))
    return result.scalars().all()


@app.post("/config/product-types", response_model=ProductTypeOut, tags=["Config"])
async def create_product_type(
    product_type: ProductTypeCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin)
):
    """Crear nuevo tipo de producto (solo Admin)."""
    db_type = ProductType(**product_type.dict())
    db.add(db_type)
    await db.commit()
    await db.refresh(db_type)
    return db_type


@app.delete("/config/product-types/{type_id}", tags=["Config"])
async def delete_product_type(
    type_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin)
):
    """Eliminar tipo de producto (solo Admin)."""
    result = await db.execute(select(ProductType).where(ProductType.id == type_id))
    db_type = result.scalars().first()
    if not db_type:
        raise HTTPException(status_code=404, detail="Tipo de producto no encontrado")
    await db.delete(db_type)
    await db.commit()
    return {"message": "Tipo de producto eliminado"}


@app.get("/config/product-types/{type_id}/usage-count", tags=["Config"])
async def get_product_type_usage_count(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener cantidad de productos que usan este tipo."""
    result = await db.execute(select(ProductType).where(ProductType.id == type_id))
    db_type = result.scalars().first()
    if not db_type:
        raise HTTPException(status_code=404, detail="Tipo de producto no encontrado")
    
    # Count products using this type name
    count_result = await db.execute(select(Product).where(Product.type == db_type.name))
    count = len(count_result.scalars().all())
    return {"count": count}

# Product Qualities (Configuración)
@app.get("/config/product-qualities", response_model=list[ProductQualityOut], tags=["Config"])
async def get_product_qualities(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Lista todas las calidades de productos disponibles."""
    result = await db.execute(select(ProductQuality))
    return result.scalars().all()


@app.post("/config/product-qualities", response_model=ProductQualityOut, tags=["Config"])
async def create_product_quality(
    product_quality: ProductQualityCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin)
):
    """Crear nueva calidad de producto (solo Admin)."""
    db_quality = ProductQuality(**product_quality.dict())
    db.add(db_quality)
    await db.commit()
    await db.refresh(db_quality)
    return db_quality


@app.delete("/config/product-qualities/{quality_id}", tags=["Config"])
async def delete_product_quality(
    quality_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin)
):
    """Eliminar calidad de producto (solo Admin)."""
    result = await db.execute(select(ProductQuality).where(ProductQuality.id == quality_id))
    db_quality = result.scalars().first()
    if not db_quality:
        raise HTTPException(status_code=404, detail="Calidad de producto no encontrada")
    await db.delete(db_quality)
    await db.commit()
    return {"message": "Calidad de producto eliminada"}


@app.get("/config/product-qualities/{quality_id}/usage-count", tags=["Config"])
async def get_product_quality_usage_count(
    quality_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtener cantidad de productos que usan esta calidad."""
    result = await db.execute(select(ProductQuality).where(ProductQuality.id == quality_id))
    db_quality = result.scalars().first()
    if not db_quality:
        raise HTTPException(status_code=404, detail="Calidad de producto no encontrada")
    
    # Count products using this quality name
    count_result = await db.execute(select(Product).where(Product.quality == db_quality.name))
    count = len(count_result.scalars().all())
    return {"count": count}

