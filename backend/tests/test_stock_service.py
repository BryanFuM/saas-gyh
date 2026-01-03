"""
Tests for stock service.
"""
import pytest


class TestStockInfo:
    """Test cases for StockInfo class."""
    
    def test_stock_disponible_kg(self):
        """Test stock_disponible_kg property."""
        from services.stock_service import StockInfo
        
        info = StockInfo(
            product_id=1,
            product_name="Test Product",
            total_ingreso_kg=100.0,
            total_ingreso_javas=5.0,
            total_vendido_kg=30.0,
            total_vendido_javas=1.5,
            costo_promedio_java=50.0
        )
        
        assert info.stock_disponible_kg == 70.0  # 100 - 30
        assert info.stock_disponible_javas == 3.5  # 5 - 1.5
    
    def test_stock_never_negative(self):
        """Test that stock is never negative."""
        from services.stock_service import StockInfo
        
        info = StockInfo(
            product_id=1,
            product_name="Test Product",
            total_ingreso_kg=50.0,
            total_ingreso_javas=2.5,
            total_vendido_kg=100.0,  # More than ingreso
            total_vendido_javas=5.0,
            costo_promedio_java=50.0
        )
        
        assert info.stock_disponible_kg == 0  # Should be 0, not negative
        assert info.stock_disponible_javas == 0
    
    def test_to_dict(self):
        """Test to_dict method."""
        from services.stock_service import StockInfo
        
        info = StockInfo(
            product_id=1,
            product_name="Test Product",
            total_ingreso_kg=100.123,
            total_ingreso_javas=5.006,
            total_vendido_kg=30.0,
            total_vendido_javas=1.5,
            costo_promedio_java=50.555
        )
        
        result = info.to_dict()
        
        assert result["product_id"] == 1
        assert result["product_name"] == "Test Product"
        assert result["total_ingreso_kg"] == 100.12  # Rounded
        assert result["total_ingreso_javas"] == 5.01  # Rounded
        assert result["stock_disponible_kg"] == 70.12  # Rounded
        assert result["costo_promedio_java"] == 50.55  # Rounded (floor)
