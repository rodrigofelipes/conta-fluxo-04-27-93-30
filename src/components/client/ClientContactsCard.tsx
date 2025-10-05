import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MessageSquare, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contact {
  id: string;
  contact_type: string;
  subject: string;
  description: string;
  contact_date: string;
  created_at: string;
  created_by_profile?: {
    name: string;
  } | null;
}

interface ClientContactsCardProps {
  clientId: string;
}

const contactTypeIcons = {
  phone: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  other: Calendar
};

const contactTypeLabels = {
  phone: "Telefone",
  email: "E-mail",
  whatsapp: "WhatsApp",
  meeting: "Reunião",
  visit: "Visita",
  other: "Outro"
};

export function ClientContactsCard({ clientId }: ClientContactsCardProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, [clientId]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('client_contacts')
        .select(`
          id,
          contact_type,
          subject,
          description,
          contact_date,
          created_at,
          created_by
        `)
        .eq('client_id', clientId)
        .not('subject', 'ilike', '%Mensagem%via WhatsApp%')
        .order('contact_date', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Buscar nomes dos criadores separadamente
      const contactsWithProfiles = await Promise.all(
        (data || []).map(async (contact) => {
          if (contact.created_by) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('user_id', contact.created_by)
              .single();
            
            return {
              ...contact,
              created_by_profile: profile ? { name: profile.name } : null
            };
          }
          return {
            ...contact,
            created_by_profile: null
          };
        })
      );
      
      setContacts(contactsWithProfiles);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contatos com o Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contatos com o Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum contato registrado com este cliente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contatos com o Cliente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => {
                const Icon = contactTypeIcons[contact.contact_type as keyof typeof contactTypeIcons] || Calendar;
                const typeLabel = contactTypeLabels[contact.contact_type as keyof typeof contactTypeLabels] || contact.contact_type;

                return (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <Icon className="w-3 h-3" />
                        {typeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{contact.subject}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {contact.description || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(contact.contact_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.created_by_profile?.name || "Sistema"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
