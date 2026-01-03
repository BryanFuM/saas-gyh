"""
Custom exceptions for centralized error handling.
All business logic errors should use these exceptions.
"""
from typing import Optional, Dict, Any


class AppException(Exception):
    """
    Base exception for all application errors.
    
    Attributes:
        code: Error code for client identification
        message: Human-readable error message (in Spanish)
        status_code: HTTP status code to return
        details: Optional additional error details
    """
    
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for JSON response."""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details
            }
        }


class NotFoundError(AppException):
    """Resource not found exception."""
    
    def __init__(self, resource: str, identifier: Any = None):
        message = f"{resource} no encontrado"
        if identifier:
            message = f"{resource} con ID {identifier} no encontrado"
        super().__init__(
            code="NOT_FOUND",
            message=message,
            status_code=404
        )


class ValidationError(AppException):
    """Data validation error exception."""
    
    def __init__(self, message: str, field: Optional[str] = None):
        details = {"field": field} if field else {}
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=422,
            details=details
        )


class StockInsuficienteError(AppException):
    """Insufficient stock for operation."""
    
    def __init__(self, product_name: str, available: float, requested: float):
        super().__init__(
            code="STOCK_INSUFICIENTE",
            message=f"Stock insuficiente de {product_name}. Disponible: {available:.2f} kg, Solicitado: {requested:.2f} kg",
            status_code=400,
            details={
                "product": product_name,
                "available_kg": available,
                "requested_kg": requested
            }
        )


class AuthenticationError(AppException):
    """Authentication failed exception."""
    
    def __init__(self, message: str = "Credenciales inválidas"):
        super().__init__(
            code="AUTHENTICATION_ERROR",
            message=message,
            status_code=401
        )


class AuthorizationError(AppException):
    """Authorization/permission denied exception."""
    
    def __init__(self, message: str = "No tienes permisos para realizar esta acción"):
        super().__init__(
            code="AUTHORIZATION_ERROR",
            message=message,
            status_code=403
        )


class DuplicateError(AppException):
    """Duplicate resource exception."""
    
    def __init__(self, resource: str, field: str, value: Any):
        super().__init__(
            code="DUPLICATE_ERROR",
            message=f"Ya existe un {resource} con {field}: {value}",
            status_code=409,
            details={
                "resource": resource,
                "field": field,
                "value": value
            }
        )


class BusinessRuleError(AppException):
    """Business rule violation exception."""
    
    def __init__(self, message: str, rule: Optional[str] = None):
        details = {"rule": rule} if rule else {}
        super().__init__(
            code="BUSINESS_RULE_ERROR",
            message=message,
            status_code=400,
            details=details
        )
