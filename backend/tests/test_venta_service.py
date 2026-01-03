"""
Tests for venta service calculations.
"""
import pytest
from decimal import Decimal
from services.venta_service import calculate_venta_item, CalculatedVentaItem
from utils.exceptions import ValidationError


class TestCalculateVentaItem:
    """Test cases for calculate_venta_item function."""
    
    def test_basic_calculation(self):
        """Test basic venta item calculation."""
        result = calculate_venta_item(
            quantity_kg=50.0,
            conversion_factor=20.0,
            price_per_kg=10.0
        )
        
        assert isinstance(result, CalculatedVentaItem)
        assert result.quantity_kg == 50.0
        assert result.quantity_javas == 2.5  # 50 / 20
        assert result.conversion_factor == 20.0
        assert result.price_per_kg == Decimal("10.0")
        assert result.subtotal == Decimal("500.0")  # 50 * 10
    
    def test_different_conversion_factor(self):
        """Test with different conversion factor."""
        result = calculate_venta_item(
            quantity_kg=100.0,
            conversion_factor=25.0,
            price_per_kg=8.0
        )
        
        assert result.quantity_javas == 4.0  # 100 / 25
        assert result.subtotal == Decimal("800.0")  # 100 * 8
    
    def test_decimal_precision(self):
        """Test decimal precision in calculations."""
        result = calculate_venta_item(
            quantity_kg=33.33,
            conversion_factor=20.0,
            price_per_kg=15.50
        )
        
        assert result.quantity_javas == pytest.approx(1.6665, rel=1e-3)
        assert result.subtotal == Decimal("516.615")  # 33.33 * 15.50
    
    def test_invalid_quantity(self):
        """Test that zero or negative quantity raises error."""
        with pytest.raises(ValidationError) as exc_info:
            calculate_venta_item(
                quantity_kg=0,
                conversion_factor=20.0,
                price_per_kg=10.0
            )
        
        assert "cantidad" in str(exc_info.value.message).lower()
    
    def test_invalid_conversion_factor(self):
        """Test that zero conversion factor raises error."""
        with pytest.raises(ValidationError) as exc_info:
            calculate_venta_item(
                quantity_kg=50.0,
                conversion_factor=0,
                price_per_kg=10.0
            )
        
        assert "factor de conversión" in str(exc_info.value.message).lower()
    
    def test_invalid_price(self):
        """Test that negative price raises error."""
        with pytest.raises(ValidationError) as exc_info:
            calculate_venta_item(
                quantity_kg=50.0,
                conversion_factor=20.0,
                price_per_kg=-5.0
            )
        
        assert "precio" in str(exc_info.value.message).lower()
