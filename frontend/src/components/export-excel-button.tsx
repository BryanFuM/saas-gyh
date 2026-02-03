'use client';

import { Button } from '@/components/ui/button';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Client } from '@/hooks/use-clients-supabase';
import { StockItem } from '@/hooks/use-stock-supabase';
import { Venta } from '@/hooks/use-ventas-supabase';
import { DateRange } from 'react-day-picker';

interface ExportExcelButtonProps {
  salesData: Venta[];
  inventoryData: StockItem[];
  clientsData: Client[];
  dateRange: DateRange | undefined;
}

export function ExportExcelButton({ salesData, inventoryData, clientsData, dateRange }: ExportExcelButtonProps) {
  
  const handleExport = () => {
    try {
      // 1. Prepare Workbook
      const wb = XLSX.utils.book_new();
      
      // ---------------------------------------------------------
      // SHEET 1: VENTAS
      // ---------------------------------------------------------
      const ventasRows = salesData.map(v => ({
        'Fecha': format(new Date(v.created_at), 'dd/MM/yyyy'),
        'Cliente': v.client?.name || v.guest_client_name || 'Huésped',
        'Tipo': v.type,
        'Método Pago': v.payment_method,
        'Total (S/.)': Number(v.total_amount),
        // 'Estado': v.status // 'status' might not exist on Venta type yet
      }));
      
      const wsVentas = XLSX.utils.json_to_sheet(ventasRows);
      
      // Auto-width columns (basic approximation)
      const ventasColsWidth = [
        { wch: 12 }, // Fecha
        { wch: 30 }, // Cliente
        { wch: 10 }, // Tipo
        { wch: 15 }, // Metodo
        { wch: 12 }, // Total
        { wch: 12 }  // Estado
      ];
      wsVentas['!cols'] = ventasColsWidth;
      
      XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");

      // ---------------------------------------------------------
      // SHEET 2: INVENTARIO
      // ---------------------------------------------------------
      const inventoryRows = inventoryData.map(i => ({
        'Producto': i.name,
        'Tipo': i.type,
        'Calidad': i.quality,
        'Factor (Kg/Java)': Number(i.conversion_factor),
        'Stock (Javas)': Number(i.stock_javas),
        'Stock (Kg)': Number(i.stock_kg)
      }));

      const wsInventory = XLSX.utils.json_to_sheet(inventoryRows);
      
      const inventoryColsWidth = [
        { wch: 25 }, // Producto
        { wch: 15 }, // Tipo
        { wch: 15 }, // Calidad
        { wch: 15 }, // Factor
        { wch: 15 }, // Stock Javas
        { wch: 15 }  // Stock Kg
      ];
      wsInventory['!cols'] = inventoryColsWidth;

      XLSX.utils.book_append_sheet(wb, wsInventory, "Inventario");

      // ---------------------------------------------------------
      // SHEET 3: DEUDAS
      // ---------------------------------------------------------
      // Filter clients with debt usually? Or all clients? 
      // Requirement says "Hoja 'Deudas': ... Deuda Actual...". 
      // Usually only relevant for those with debt, but listing all is safer for full report.
      // Let's filter slightly >= 0 to show all active relationships, or just > 0.
      // I'll show all active clients.
      
      const debtRows = clientsData.map(c => ({
        'Cliente': c.name,
        'Whatsapp': c.whatsapp_number || '-',
        'Deuda Actual (S/.)': Number(c.current_debt || 0),
        'Días Sin Pago': c.days_without_payment || 0
      }));

      const wsDeudas = XLSX.utils.json_to_sheet(debtRows);
      
      const debtColsWidth = [
        { wch: 30 }, // Cliente
        { wch: 15 }, // Whatsapp
        { wch: 18 }, // Deuda
        { wch: 15 }  // Dias
      ];
      wsDeudas['!cols'] = debtColsWidth;

      XLSX.utils.book_append_sheet(wb, wsDeudas, "Deudas");

      // ---------------------------------------------------------
      // SAVE FILE
      // ---------------------------------------------------------
      const dateStr = format(new Date(), 'dd-MM-yyyy');
      const fileName = `Reporte_Agroinversiones_${dateStr}.xlsx`;
      
      XLSX.writeFile(wb, fileName);

    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Hubo un error al generar el Excel. Revisa la consola.");
    }
  };

  return (
    <Button 
      onClick={handleExport} 
      variant="outline" 
      className="gap-2 border-green-200 hover:bg-green-50 text-green-700 hover:text-green-800"
    >
      <FileSpreadsheet className="h-4 w-4" />
      <span className="hidden sm:inline">Descargar Excel</span>
    </Button>
  );
}
