import { useEffect, useState } from "react";
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
  created_by_profile?: {
    name: string;
  } | null;
}

interface PhaseClientContactsProps {
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

export function PhaseClientContacts({ clientId }: PhaseClientContactsProps) {
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
          created_by
        `)
        .eq('client_id', clientId)
        .not('subject', 'ilike', '%Mensagem%via WhatsApp%')
        .order('contact_date', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Buscar nomes dos criadores
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
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-16 bg-muted rounded" />
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum contato registrado com este cliente.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {contacts.map((contact) => {
        const Icon = contactTypeIcons[contact.contact_type as keyof typeof contactTypeIcons] || Calendar;
        const typeLabel = contactTypeLabels[contact.contact_type as keyof typeof contactTypeLabels] || contact.contact_type;

        return (
          <div key={contact.id} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            <div className="flex items-start gap-2 mb-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Icon className="w-3 h-3" />
                {typeLabel}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(contact.contact_date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
            
            <p className="font-medium text-sm mb-1">{contact.subject}</p>
            
            {contact.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                {contact.description}
              </p>
            )}
            
            <p className="text-xs text-muted-foreground">
              Por: {contact.created_by_profile?.name || "Sistema"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
