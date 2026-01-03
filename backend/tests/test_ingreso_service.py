"""
Tests for ingreso service calculations.
"""
import pytest
from services.ingreso_service import calculate_item_costs, CalculatedItem
from utils.exceptions import ValidationError


class TestCalculateItemCosts:
    """Test cases for calculate_item_costs function."""
    
    def test_calculate_with_price_per_java(self):
        """Test calculation when price is given per java."""
        result = calculate_item_costs(
            total_kg=100.0,
            conversion_factor=20.0,
            cost_price_input=50.0,
            cost_price_mode="JAVA"
        )
        
        assert isinstance(result, CalculatedItem)
        assert result.total_javas == 5.0  # 100 / 20
        assert result.cost_per_java == 50.0
        assert result.total_cost == 250.0  # 5 * 50
    
    def test_calculate_with_price_per_kg(self):
        """Test calculation when price is given per kg."""
        result = calculate_item_costs(
            total_kg=100.0,
            conversion_factor=20.0,
            cost_price_input=2.5,  # Price per kg
            cost_price_mode="KG"
        )
        
        assert result.total_javas == 5.0  # 100 / 20
        # cost_per_java = price_per_kg * conversion_factor = 2.5 * 20 = 50
        assert result.cost_per_java == 50.0
        assert result.total_cost == 250.0  # 5 * 50
    
    def test_different_conversion_factor(self):
        """Test with different conversion factor."""
        result = calculate_item_costs(
            total_kg=150.0,
            conversion_factor=25.0,
            cost_price_input=100.0,
            cost_price_mode="JAVA"
        )
        
        assert result.total_javas == 6.0  # 150 / 25
        assert result.cost_per_java == 100.0
        assert result.total_cost == 600.0  # 6 * 100
    
    def test_invalid_total_kg(self):
        """Test that zero or negative total_kg raises error."""
        with pytest.raises(ValidationError) as exc_info:
            calculate_item_costs(
                total_kg=0,
                conversion_factor=20.0,
                cost_price_input=50.0,
                cost_price_mode="JAVA"
            )
        
        assert "KG debe ser mayor a 0" in str(exc_info.value.message)
    
    def test_invalid_conversion_factor(self):
        """Test that zero conversion factor raises error."""
        with pytest.raises(ValidationError) as exc_info:
            calculate_item_costs(
                total_kg=100.0,
                conversion_factor=0,
                cost_price_input=50.0,
                cost_price_mode="JAVA"
            )
        
        assert "factor de conversión" in str(exc_info.value.message).lower()
    
    def test_invalid_cost_price(self):
        """Test that negative cost price raises error."""
        with pytest.raises(ValidationError) as exc_info:
            calculate_item_costs(
                total_kg=100.0,
                conversion_factor=20.0,
                cost_price_input=-10.0,
                cost_price_mode="JAVA"
            )
        
        assert "precio de costo" in str(exc_info.value.message).lower()
    
    def test_invalid_cost_price_mode(self):
        """Test that invalid cost price mode raises error."""
        with pytest.raises(ValidationError) as exc_info:
            calculate_item_costs(
                total_kg=100.0,
                conversion_factor=20.0,
                cost_price_input=50.0,
                cost_price_mode="INVALID"
            )
        
        assert "modo de precio" in str(exc_info.value.message).lower()
    
    def test_to_dict(self):
        """Test CalculatedItem.to_dict() method."""
        result = calculate_item_costs(
            total_kg=100.0,
            conversion_factor=20.0,
            cost_price_input=50.123,
            cost_price_mode="JAVA"
        )
        
        dict_result = result.to_dict()
        
        assert "total_javas" in dict_result
        assert "cost_per_java" in dict_result
        assert "total_cost" in dict_result
        assert dict_result["total_javas"] == 5.0
        assert dict_result["cost_per_java"] == 50.12  # Rounded
