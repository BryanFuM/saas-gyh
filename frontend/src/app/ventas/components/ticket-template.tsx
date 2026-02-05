import React from 'react';

// --- Interfaces ---

interface TicketTemplateProps {
  sale: any;
  client?: any;
  isReprint?: boolean;
}

// --- Shared Components ---

const TicketHeader = ({ title, date, isReprint, saleId }: { title: string, date: string, isReprint?: boolean, saleId: number }) => (
  <div className="text-center border-b pb-4 mb-4">
    <h1 className="text-xl font-bold">Agroinversiones Beto</h1>
    <p className="uppercase font-medium">{title}</p>
    <p className="text-xs">{new Date(date).toLocaleString()}</p>
    <p className="text-xs font-bold mt-1">Ticket #: {saleId}</p>
    {isReprint && <p className="font-bold mt-2 text-xs">** COPIA DE TICKET **</p>}
  </div>
);

const ClientInfo = ({ client }: { client: any }) => {
  if (!client) return null;
  return (
    <div className="mb-4 text-xs border-b pb-2">
      <p><strong>Cliente:</strong> {client.name}</p>
      {client.whatsapp_number && <p><strong>WhatsApp:</strong> {client.whatsapp_number}</p>}
    </div>
  );
};

const TicketItemsTable = ({ items }: { items: any[] }) => (
  <table className="w-full mb-4 border-b text-xs">
    <thead>
      <tr className="border-b">
        <th className="text-left py-1">Prod</th>
        <th className="text-right py-1">Jav</th>
        <th className="text-right py-1">P.U</th>
        <th className="text-right py-1">Total</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item: any, index: number) => {
        // Handle different data structures safely
        const productName = item.product_name 
           || item.product?.name 
           || item.products?.name 
           || `Prod ${item.product_id}`;
           
        const type = item.product_type || item.product?.type || item.products?.type || '';
        const quality = item.product?.quality || item.products?.quality || '';
        const fullName = `${productName} ${type} ${quality}`.trim();

        // Calculate values logic preserved from original
        const quantity = parseFloat(item.quantity_javas || 0);
        // unit_sale_price usually comes from items, fallback to price_per_java
        const price = parseFloat(item.unit_sale_price || item.price_per_java || 0);
        const subtotal = parseFloat(item.subtotal || (quantity * price) || 0);

        return (
          <tr key={index}>
            <td className="pr-1 py-1 leading-tight">{fullName}</td>
            <td className="text-right align-top">{quantity.toFixed(1)}</td>
            <td className="text-right align-top">{price.toFixed(2)}</td>
            <td className="text-right align-top">{subtotal.toFixed(2)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

// --- Specific Templates ---

const CashTicketTemplate = React.forwardRef<HTMLDivElement, TicketTemplateProps>(({ sale, client, isReprint }, ref) => {
  return (
    <div ref={ref} className="p-6 bg-white text-black font-mono text-sm w-[80mm]">
      <TicketHeader 
        title="NOTA DE VENTA - CONTADO" 
        date={sale.date} 
        isReprint={isReprint} 
        saleId={sale.id}
      />
      
      <ClientInfo client={client} />
      <TicketItemsTable items={sale.items} />

      <div className="text-right space-y-1 mb-6">
        <p className="text-lg font-bold border-t pt-2">
          <strong>TOTAL:</strong> S/ {parseFloat(sale.total_amount).toFixed(2)}
        </p>
        <p className="text-xs text-gray-600 mt-1">Método: {sale.payment_method || 'EFECTIVO'}</p>
      </div>

      <div className="mt-8 text-center text-xs border-t pt-4">
        <p className="font-medium">¡Gracias por su preferencia!</p>
        <p className="mt-1 text-[10px]">Agroinversiones Beto</p>
      </div>
    </div>
  );
});
CashTicketTemplate.displayName = 'CashTicketTemplate';

const CreditTicketTemplate = React.forwardRef<HTMLDivElement, TicketTemplateProps>(({ sale, client, isReprint }, ref) => {
  // Calculate debt details
  const currentTotal = parseFloat(sale.total_amount || 0);
  const previousDebt = parseFloat(sale.previous_debt || 0);
  const totalNewDebt = currentTotal + previousDebt;

  return (
    <div ref={ref} className="p-6 bg-white text-black font-mono text-sm w-[80mm]">
      <TicketHeader 
        title="VALE DE CRÉDITO / PEDIDO" 
        date={sale.date} 
        isReprint={isReprint} 
        saleId={sale.id}
      />

      <ClientInfo client={client} />
      <TicketItemsTable items={sale.items} />

      {/* Debt Summary Section - CRITICAL */}
      <div className="text-right space-y-1 mb-4 border p-2 rounded border-dashed border-gray-400">
        <p className="text-xs">Saldo Anterior: S/ {previousDebt.toFixed(2)}</p>
        <p className="text-xs font-bold border-b border-dashed pb-1">Monto esta Venta: S/ {currentTotal.toFixed(2)}</p>
        <div className="pt-1">
            <p className="text-[10px] text-gray-600 uppercase">Nueva Deuda Total</p>
            <p className="text-xl font-extrabold">S/ {totalNewDebt.toFixed(2)}</p>
        </div>
      </div>

      {/* Signature Section */}
      <div className="mt-12 mb-4">
        <div className="border-t border-black border-dashed mx-8"></div>
        <p className="text-center text-xs mt-1 font-medium">FIRMA CONFORME</p>
      </div>

      <div className="mt-4 text-center">
        <p className="text-[10px] italic text-gray-500 leading-tight">
          &quot;Reconozco la deuda detallada en este documento y me comprometo a cancelarla en el plazo acordado.&quot;
        </p>
      </div>
    </div>
  );
});
CreditTicketTemplate.displayName = 'CreditTicketTemplate';

// --- Main Components (Factory) ---

export const TicketTemplate = React.forwardRef<HTMLDivElement, TicketTemplateProps>((props, ref) => {
  const { sale } = props;
  
  if (!sale) return null;

  // Logic to determine which template to use
  // If type is PEDIDO (Credit) or explicitly Pending status
  const isCredit = sale.type === 'PEDIDO' || sale.payment_status === 'PENDING';

  if (isCredit) {
    return <CreditTicketTemplate ref={ref} {...props} />;
  }

  return <CashTicketTemplate ref={ref} {...props} />;
});

TicketTemplate.displayName = 'TicketTemplate';
