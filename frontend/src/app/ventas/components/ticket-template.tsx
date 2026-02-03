import React from 'react';

interface TicketTemplateProps {
  sale: any;
  client?: any;
}

export const TicketTemplate = React.forwardRef<HTMLDivElement, TicketTemplateProps>(({ sale, client }, ref) => {
  if (!sale) return null;

  return (
    <div ref={ref} className="p-8 bg-white text-black font-mono text-sm w-[80mm]">
      <div className="text-center border-b pb-4 mb-4">
        <h1 className="text-xl font-bold">Agroinversiones Beto</h1>
        <p>Venta Mayorista</p>
        <p>{new Date(sale.date).toLocaleString()}</p>
      </div>

      <div className="mb-4">
        <p><strong>Ticket #:</strong> {sale.id}</p>
        <p><strong>Tipo:</strong> {sale.type}</p>
        {client && (
          <>
            <p><strong>Cliente:</strong> {client.name}</p>
            <p><strong>WhatsApp:</strong> {client.whatsapp_number}</p>
          </>
        )}
      </div>

      <table className="w-full mb-4 border-b">
        <thead>
          <tr className="border-b">
            <th className="text-left">Prod</th>
            <th className="text-right">Jav</th>
            <th className="text-right">P.U</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item: any, index: number) => {
            // Handle different data structures (Supabase vs Local State)
            const productName = item.product_name 
               || item.product?.name 
               || item.products?.name 
               || `Prod ${item.product_id}`;
               
            const type = item.product_type || item.product?.type || item.products?.type || '';
            const quality = item.product?.quality || item.products?.quality || '';
            const fullName = `${productName} ${type} ${quality}`.trim();

            // Calculate values
            const quantity = parseFloat(item.quantity_javas || 0);
            
            // Handle mismatched unit prices (sometimes per kg, here we want per java for display?)
            // Actually usually wholesale is per Java, but form inputs per Kg.
            // Let's check what unit_sale_price represents.
            // In sales-list mapping: unit_sale_price = subtotal / quantity_javas
            const price = parseFloat(item.unit_sale_price || item.price_per_java || 0);
            const subtotal = parseFloat(item.subtotal || (quantity * price) || 0);

            return (
              <tr key={index}>
                <td className="pr-2 py-1 leading-tight">{fullName}</td>
                <td className="text-right align-top">{quantity.toFixed(1)}</td>
                <td className="text-right align-top">{price.toFixed(2)}</td>
                <td className="text-right align-top">{subtotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="text-right space-y-1">
        <p><strong>Subtotal:</strong> S/ {parseFloat(sale.total_amount).toFixed(2)}</p>
        {sale.type === 'PEDIDO' && sale.previous_debt !== undefined && (
          <>
            <p><strong>Deuda Anterior:</strong> S/ {parseFloat(sale.previous_debt).toFixed(2)}</p>
            <p className="text-lg font-bold border-t pt-1">
              <strong>Total Deuda:</strong> S/ {(parseFloat(sale.previous_debt) + parseFloat(sale.total_amount)).toFixed(2)}
            </p>
          </>
        )}
        {sale.type === 'CAJA' && (
          <p className="text-lg font-bold border-t pt-1">
            <strong>Total:</strong> S/ {parseFloat(sale.total_amount).toFixed(2)}
          </p>
        )}
      </div>

      <div className="mt-8 text-center text-xs border-t pt-4">
        <p>¡Gracias por su compra!</p>
        <p>Agroinversiones Beto - Calidad y Confianza</p>
      </div>
    </div>
  );
});

TicketTemplate.displayName = 'TicketTemplate';
