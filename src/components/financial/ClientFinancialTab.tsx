import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  Users,
  Search,
  DollarSign,
  CreditCard,
  TrendingUp,
  Calendar,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";

interface ClientFinancialData {
  client_id: string;
  client_name: string;
  total_receivables: number;
  paid_receivables: number;
  pending_receivables: number;
  overdue_receivables: number;
  total_installments: number;
  pending_installments: number;
  transactions: Array<{
    id: string;
    description: string;
    amount: number;
    transaction_date: string;
    status: string;
    transaction_category: string;
    transaction_type: string;
  }>;
  installments: Array<{
    id: string;
    installment_number: number;
    total_installments: number;
    amount: number;
    due_date: string;
    status: string;
    payment_date?: string;
  }>;
}

export function ClientFinancialTab() {
  const { clients } = useClients();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Área de Busca */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Financeiro por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Clientes ({filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredClients.map(client => (
                <Card 
                  key={client.id} 
                  className="cursor-pointer transition-all hover:shadow-md hover:bg-accent/50"
                  onClick={() => {
                    navigate(`/client-financial/${client.id}`);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{client.name}</h3>
                        <p className="text-sm text-muted-foreground">{client.email || 'Sem email'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <div className="font-medium mb-2">Nenhum cliente encontrado</div>
              <div className="text-sm">
                {searchTerm ? 'Tente ajustar os termos de busca' : 'Não há clientes cadastrados'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}