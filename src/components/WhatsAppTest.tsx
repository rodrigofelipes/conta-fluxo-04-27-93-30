import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, Send } from "lucide-react";

export default function WhatsAppTest() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const { toast } = useToast();

  const sendWhatsAppMessage = async () => {
    if (!phone.trim() || !message.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      console.log("Enviando mensagem WhatsApp...");
      
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { 
          to: phone.trim(), 
          message: message.trim() 
        }
      });

      if (error) {
        console.error("Erro da função:", error);
        throw error;
      }

      console.log("Resposta da função:", data);
      setResponse(data);

      if (data.ok) {
        setMessage("");
      } else {
        toast({
          title: "Erro",
          description: `Erro ao enviar: ${data.error?.message || "Erro desconhecido"}`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: `Erro ao enviar mensagem: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          Teste WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Número do WhatsApp</Label>
          <Input
            id="phone"
            placeholder="Ex: 5511999999999 (formato E.164)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Use o formato internacional: código do país + DDD + número
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Mensagem</Label>
          <Textarea
            id="message"
            placeholder="Digite sua mensagem aqui..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
          />
        </div>

        <Button 
          onClick={sendWhatsAppMessage} 
          disabled={loading || !phone.trim() || !message.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="mr-2 size-4" />
              Enviar Mensagem
            </>
          )}
        </Button>

        {response && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Resposta da API</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                {JSON.stringify(response, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}