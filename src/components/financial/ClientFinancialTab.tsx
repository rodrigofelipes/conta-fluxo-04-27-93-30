import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, Mail } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { ClientFinancialEmailDialog } from "@/components/financial/ClientFinancialEmailDialog";

export function ClientFinancialTab() {
  const { clients } = useClients();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedClient = selectedClientId
    ? clients.find(client => client.id === selectedClientId) || null
    : null;

  const handleOpenEmailDialog = (clientId: string) => {
    setSelectedClientId(clientId);
    setIsEmailDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsEmailDialogOpen(open);
    if (!open) {
      setSelectedClientId(null);
    }
  };

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
                  className="transition-all hover:shadow-md"
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{client.name}</h3>
                        <p className="text-sm text-muted-foreground">{client.email || 'Sem email cadastrado'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/client-financial/${client.id}`)}
                      >
                        Ver detalhes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEmailDialog(client.id)}
                      >
                        <Mail className="mr-2 h-4 w-4" /> Enviar resumo por email
                      </Button>
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

      <ClientFinancialEmailDialog
        client={selectedClient || null}
        open={isEmailDialogOpen}
        onOpenChange={handleDialogOpenChange}
      />
    </div>
  );
}