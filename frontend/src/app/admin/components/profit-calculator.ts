import { Decimal } from 'decimal.js';

interface SaleItem {
  product_id: number;
  quantity_javas: number;
  unit_sale_price: string;
}

interface Ingreso {
  product_id: number;
  total_javas: number;
  unit_cost_price: number;
}

export function calculateNetProfit(sales: any[], ingresos: any[]) {
  let totalRevenue = new Decimal(0);
  let totalCost = new Decimal(0);

  // 1. Calculate Total Revenue
  sales.forEach(sale => {
    totalRevenue = totalRevenue.plus(new Decimal(sale.total_amount));
  });

  // 2. Calculate Cost of Goods Sold (COGS)
  // For simplicity in this MVP, we use the average cost price per product from recent ingresos
  // In a more advanced version, we would use FIFO/LIFO based on batches
  const productCosts: Record<number, { totalCost: Decimal, totalJavas: Decimal }> = {};

  ingresos.forEach(ingreso => {
    if (!productCosts[ingreso.product_id]) {
      productCosts[ingreso.product_id] = { totalCost: new Decimal(0), totalJavas: new Decimal(0) };
    }
    productCosts[ingreso.product_id].totalCost = productCosts[ingreso.product_id].totalCost.plus(
      new Decimal(ingreso.total_javas).times(ingreso.unit_cost_price)
    );
    productCosts[ingreso.product_id].totalJavas = productCosts[ingreso.product_id].totalJavas.plus(ingreso.total_javas);
  });

  const avgCosts: Record<number, Decimal> = {};
  for (const id in productCosts) {
    if (productCosts[id].totalJavas.gt(0)) {
      avgCosts[id] = productCosts[id].totalCost.div(productCosts[id].totalJavas);
    }
  }

  // Calculate cost for each sale item
  sales.forEach(sale => {
    sale.items.forEach((item: any) => {
      const avgCost = avgCosts[item.product_id] || new Decimal(0);
      totalCost = totalCost.plus(new Decimal(item.quantity_javas).times(avgCost));
    });
  });

  return {
    revenue: totalRevenue.toNumber(),
    cost: totalCost.toNumber(),
    profit: totalRevenue.minus(totalCost).toNumber(),
    margin: totalRevenue.gt(0) ? totalRevenue.minus(totalCost).div(totalRevenue).times(100).toNumber() : 0
  };
}
