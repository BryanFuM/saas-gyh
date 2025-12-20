'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Phone, DollarSign, CreditCard, History, Edit } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Payment {
  id: number;
  amount: number;
  notes: string | null;
  created_at: string;
}

interface Client {
  id: number;
  name: string;
  whatsapp_number: string | null;
  current_debt: number;
}

export default function ClientesPage() {
  const { token, user, isHydrated, hydrate } = useAuthStore();
  const { toast } = useToast();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state for new client
  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [initialDebt, setInitialDebt] = useState('');
  
  // Payment dialog state
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  
  // History dialog state
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  
  // Edit debt dialog state
  const [isEditDebtDialogOpen, setIsEditDebtDialogOpen] = useState(false);
  const [newDebtAmount, setNewDebtAmount] = useState('');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/python/clients', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/python/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          whatsapp_number: whatsappNumber || null,
          current_debt: initialDebt ? parseFloat(initialDebt) : 0,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al crear cliente');
      }

      toast({
        title: "Éxito",
        description: "Cliente creado correctamente",
      });

      // Reset form
      setName('');
      setWhatsappNumber('');
      setInitialDebt('');
      setIsDialogOpen(false);

      // Refresh list
      fetchClients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      const response = await fetch(`/api/python/clients/${selectedClient.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          notes: paymentNotes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al registrar pago');
      }

      toast({
        title: "Éxito",
        description: `Pago de S/. ${paymentAmount} registrado correctamente`,
      });

      // Reset form
      setPaymentAmount('');
      setPaymentNotes('');
      setIsPaymentDialogOpen(false);
      setSelectedClient(null);

      // Refresh list
      fetchClients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchPaymentHistory = async (client: Client) => {
    setSelectedClient(client);
    setLoadingPayments(true);
    setIsHistoryDialogOpen(true);

    try {
      const response = await fetch(`/api/python/clients/${client.id}/payments`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const openEditDebtDialog = (client: Client) => {
    setSelectedClient(client);
    setNewDebtAmount(client.current_debt.toString());
    setIsEditDebtDialogOpen(true);
  };

  const handleUpdateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      const response = await fetch(`/api/python/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: selectedClient.name,
          whatsapp_number: selectedClient.whatsapp_number,
          current_debt: parseFloat(newDebtAmount),
        }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar deuda');
      }

      toast({
        title: "Éxito",
        description: "Deuda actualizada correctamente",
      });

      setIsEditDebtDialogOpen(false);
      setSelectedClient(null);
      fetchClients();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openPaymentDialog = (client: Client) => {
    setSelectedClient(client);
    setPaymentAmount('');
    setPaymentNotes('');
    setIsPaymentDialogOpen(true);
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Clientes</h1>
            <p className="text-sm md:text-base text-gray-500">Gestión de clientes y deudas</p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
              <DialogDescription>
                Ingresa los datos del cliente para el sistema de pedidos
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Cliente</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
                  <Input
                    id="whatsapp"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="Ej: 51987654321"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initialDebt">Deuda Inicial (opcional)</Label>
                  <Input
                    id="initialDebt"
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialDebt}
                    onChange={(e) => setInitialDebt(e.target.value)}
                    placeholder="S/. 0.00"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar Cliente</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago / Abono</DialogTitle>
            <DialogDescription>
              Cliente: {selectedClient?.name} | Deuda actual: S/. {Number(selectedClient?.current_debt || 0).toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterPayment}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Monto del Pago</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedClient?.current_debt || 0)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="S/. 0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Notas (opcional)</Label>
                <Textarea
                  id="paymentNotes"
                  value={paymentNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPaymentNotes(e.target.value)}
                  placeholder="Ej: Pago en efectivo, transferencia, etc."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar Pago</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Historial de Pagos</DialogTitle>
            <DialogDescription>
              Cliente: {selectedClient?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {loadingPayments ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : payments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No hay pagos registrados</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-green-600 font-bold">S/. {payment.amount.toFixed(2)}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(payment.created_at).toLocaleDateString('es-PE', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {payment.notes && (
                      <p className="text-sm text-gray-600 mt-1">{payment.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Debt Dialog */}
      <Dialog open={isEditDebtDialogOpen} onOpenChange={setIsEditDebtDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Deuda</DialogTitle>
            <DialogDescription>
              Cliente: {selectedClient?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateDebt}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newDebt">Nueva Deuda</Label>
                <Input
                  id="newDebt"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newDebtAmount}
                  onChange={(e) => setNewDebtAmount(e.target.value)}
                  placeholder="S/. 0.00"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDebtDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Actualizar Deuda</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No hay clientes registrados</p>
            <p className="text-gray-400 text-sm">Agrega tu primer cliente usando el botón &quot;Nuevo Cliente&quot;</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{client.name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {client.whatsapp_number ? (
                    <>
                      <Phone className="h-4 w-4" />
                      {client.whatsapp_number}
                    </>
                  ) : (
                    <span className="text-gray-400">Sin WhatsApp</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-500">Deuda actual:</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold flex items-center gap-1 ${Number(client.current_debt) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <DollarSign className="h-4 w-4" />
                      S/. {Number(client.current_debt).toFixed(2)}
                    </span>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDebtDialog(client)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {Number(client.current_debt) > 0 && (
                    <Button size="sm" variant="default" className="flex-1" onClick={() => openPaymentDialog(client)}>
                      <CreditCard className="h-4 w-4 mr-1" />
                      Registrar Pago
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => fetchPaymentHistory(client)}>
                    <History className="h-4 w-4 mr-1" />
                    Historial
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
