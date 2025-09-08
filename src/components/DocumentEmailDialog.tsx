import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentEmailDialogProps {
  documentId: string;
  documentName: string;
  clientEmail?: string;
  clientName?: string;
  trigger?: React.ReactNode;
}

export function DocumentEmailDialog({ documentId, documentName, clientEmail, clientName, trigger }: DocumentEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(clientEmail || "");
  const [name, setName] = useState(clientName || "");
  const [subject, setSubject] = useState(`Documento: ${documentName}`);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendEmail = async () => {
    if (!email) {
      toast.error("Email é obrigatório");
      return;
    }

    setIsLoading(true);
    
    console.log('Enviando email para documento:', documentId);
    console.log('Dados do email:', { documentId, recipientEmail: email, recipientName: name, subject, message });
    
    try {
      const { data, error } = await supabase.functions.invoke('send-document-email', {
        body: {
          documentId,
          recipientEmail: email,
          recipientName: name,
          subject,
          message,
        },
      });

      console.log('Resposta da edge function:', { data, error });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast.success("Email enviado com sucesso!");
        setOpen(false);
        // Reset form only if not pre-populated
        if (!clientEmail) setEmail("");
        if (!clientName) setName("");
        setSubject(`Documento: ${documentName}`);
        setMessage("");
      } else {
        throw new Error(data.error || "Erro ao enviar email");
      }
      
    } catch (error: any) {
      console.error("Erro ao enviar email:", error);
      toast.error(`Erro ao enviar email: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Enviar por Email
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Documento por Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient-email">Email do Destinatário *</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="cliente@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="recipient-name">Nome do Destinatário</Label>
            <Input
              id="recipient-name"
              placeholder="Nome do cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email-subject">Assunto</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email-message">Mensagem Personalizada</Label>
            <Textarea
              id="email-message"
              placeholder="Adicione uma mensagem personalizada (opcional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendEmail} disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar Email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}