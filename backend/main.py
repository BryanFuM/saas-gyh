from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import timedelta

from database import engine, Base, get_db, AsyncSessionLocal
from models import User, UserRole, Client, Product, ProductType, ProductQuality, ClientPayment
from schemas import (
    Token, UserOut, UserCreate, ClientOut, ClientCreate, ClientUpdate, ProductOut, ProductCreate, ProductUpdate,
    ProductTypeOut, ProductTypeCreate, ProductQualityOut, ProductQualityCreate,
    ClientPaymentOut, ClientPaymentCreate
)
from auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    RoleChecker,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    verify_password,
    get_password_hash
)
from routers import ingresos, ventas

app = FastAPI(title="Agroinversiones Beto API", redirect_slashes=False)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingresos.router)
app.include_router(ventas.router)

# Create tables on startup and seed admin user
@app.on_event("startup")
async def startup():
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
            print("✅ Admin user created: admin / admin123")

@app.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserOut)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# RBAC Checkers (must be defined before usage)
allow_admin = RoleChecker([UserRole.ADMIN])
allow_vendedor = RoleChecker([UserRole.ADMIN, UserRole.VENDEDOR])
allow_inventor = RoleChecker([UserRole.ADMIN, UserRole.INVENTOR])

# User Management (Admin only)
@app.get("/users", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    result = await db.execute(select(User))
    return result.scalars().all()

@app.post("/users", response_model=UserOut)
async def create_user(user_data: UserCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
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

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    # Prevent deleting yourself
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    await db.delete(user)
    await db.commit()
    return {"message": "Usuario eliminado"}

@app.get("/clients", response_model=list[ClientOut])
async def get_clients(db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_vendedor)):
    result = await db.execute(select(Client))
    return result.scalars().all()

@app.post("/clients", response_model=ClientOut)
async def create_client(client: ClientCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_vendedor)):
    db_client = Client(**client.dict())
    db.add(db_client)
    await db.commit()
    await db.refresh(db_client)
    return db_client

@app.get("/products", response_model=list[ProductOut])
async def get_products(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Product))
    return result.scalars().all()

@app.post("/products", response_model=ProductOut)
async def create_product(product: ProductCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    db_product = Product(**product.dict())
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product

@app.put("/products/{product_id}", response_model=ProductOut)
async def update_product(product_id: int, product: ProductUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
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

@app.delete("/products/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_admin)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalars().first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await db.delete(db_product)
    await db.commit()
    return {"message": "Product deleted successfully"}

@app.put("/clients/{client_id}", response_model=ClientOut)
async def update_client(client_id: int, client: ClientUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_vendedor)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    db_client = result.scalars().first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_data = client.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_client, key, value)
    
    await db.commit()
    await db.refresh(db_client)
    return db_client

@app.get("/clients/{client_id}", response_model=ClientOut)
async def get_client(client_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(allow_vendedor)):
    result = await db.execute(select(Client).where(Client.id == client_id))
    db_client = result.scalars().first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    return db_client

# Client Payments (Abonos)
@app.post("/clients/{client_id}/payments", response_model=ClientPaymentOut)
async def create_payment(
    client_id: int, 
    payment: ClientPaymentCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_vendedor)
):
    # Get client
    result = await db.execute(select(Client).where(Client.id == client_id))
    db_client = result.scalars().first()
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")
    
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

@app.get("/clients/{client_id}/payments", response_model=list[ClientPaymentOut])
async def get_client_payments(
    client_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_vendedor)
):
    result = await db.execute(select(ClientPayment).where(ClientPayment.client_id == client_id))
    return result.scalars().all()

# Product Types (Configuración)
@app.get("/config/product-types", response_model=list[ProductTypeOut])
async def get_product_types(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ProductType))
    return result.scalars().all()

@app.post("/config/product-types", response_model=ProductTypeOut)
async def create_product_type(
    product_type: ProductTypeCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin)
):
    db_type = ProductType(**product_type.dict())
    db.add(db_type)
    await db.commit()
    await db.refresh(db_type)
    return db_type

@app.delete("/config/product-types/{type_id}")
async def delete_product_type(
    type_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin)
):
    result = await db.execute(select(ProductType).where(ProductType.id == type_id))
    db_type = result.scalars().first()
    if not db_type:
        raise HTTPException(status_code=404, detail="Product type not found")
    await db.delete(db_type)
    await db.commit()
    return {"message": "Product type deleted"}

# Product Qualities (Configuración)
@app.get("/config/product-qualities", response_model=list[ProductQualityOut])
async def get_product_qualities(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ProductQuality))
    return result.scalars().all()

@app.post("/config/product-qualities", response_model=ProductQualityOut)
async def create_product_quality(
    product_quality: ProductQualityCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin)
):
    db_quality = ProductQuality(**product_quality.dict())
    db.add(db_quality)
    await db.commit()
    await db.refresh(db_quality)
    return db_quality

@app.delete("/config/product-qualities/{quality_id}")
async def delete_product_quality(
    quality_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(allow_admin)
):
    result = await db.execute(select(ProductQuality).where(ProductQuality.id == quality_id))
    db_quality = result.scalars().first()
    if not db_quality:
        raise HTTPException(status_code=404, detail="Product quality not found")
    await db.delete(db_quality)
    await db.commit()
    return {"message": "Product quality deleted"}

# Initial setup endpoint to create an admin user (for testing)
@app.post("/setup-admin", status_code=status.HTTP_201_CREATED)
async def setup_admin(db: AsyncSession = Depends(get_db)):
    # Check if admin exists
    result = await db.execute(select(User).where(User.username == "admin"))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Admin already exists")
    
    admin_user = User(
        username="admin",
        password_hash=get_password_hash("adminpassword"),
        role=UserRole.ADMIN
    )
    db.add(admin_user)
    await db.commit()
    return {"message": "Admin user created"}
