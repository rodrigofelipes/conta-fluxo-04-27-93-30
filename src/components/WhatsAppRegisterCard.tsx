import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Phone } from "lucide-react";

export function WhatsAppRegisterCard() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRequestCode() {
    setRequestingCode(true);
    setResult(null);
    try {
      const r = await fetch("https://xagbhvhqtgybmzfkcxoa.supabase.co/functions/v1/whatsapp-request-code", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZ2JodmhxdGd5Ym16ZmtjeG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4ODM1ODksImV4cCI6MjA3MDQ1OTU4OX0.VaJbNTXyjEPZMc7F-KYdkNxfbnDuxppxTWz7VA8BLV4`
        },
        body: JSON.stringify({ 
          phone_number: phoneNumber,
          method: "sms" 
        }),
      });
      
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      }
      
      const j = await r.json();
      if (j.ok) {
        setResult("✅ Código enviado por SMS! Verifique seu telefone.");
        setCodeRequested(true);
      } else {
        setResult(`❌ Falha ao solicitar código: ${JSON.stringify(j.error).slice(0, 500)}`);
      }
    } catch (e: any) {
      console.error('WhatsApp request code error:', e);
      setResult(`❌ Erro inesperado: ${e?.message || e}`);
    } finally {
      setRequestingCode(false);
    }
  }

  async function handleRegister() {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("https://xagbhvhqtgybmzfkcxoa.supabase.co/functions/v1/whatsapp-register", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhZ2JodmhxdGd5Ym16ZmtjeG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4ODM1ODksImV4cCI6MjA3MDQ1OTU4OX0.VaJbNTXyjEPZMc7F-KYdkNxfbnDuxppxTWz7VA8BLV4`
        },
        body: JSON.stringify({ pin }),
      });
      
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      }
      
      const j = await r.json();
      if (j.ok) {
        setResult("✅ Número registrado com sucesso!");
      } else {
        setResult(`❌ Falha no registro: ${JSON.stringify(j.error).slice(0, 500)}`);
      }
    } catch (e: any) {
      console.error('WhatsApp register error:', e);
      setResult(`❌ Erro inesperado: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          Ativar número no WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!codeRequested ? (
          <>
            <p className="text-sm text-muted-foreground">
              Primeiro, insira o número de telefone para receber o código de verificação via SMS.
            </p>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Ex.: +5531999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <Button
                onClick={handleRequestCode}
                disabled={requestingCode || !phoneNumber.trim()}
                className="flex items-center gap-2"
              >
                <Phone className="size-4" />
                {requestingCode ? "Enviando..." : "Solicitar Código"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Digite o <b>PIN (6 dígitos)</b> recebido por SMS no número {phoneNumber}.
            </p>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Ex.: 123456"
                value={pin}
                maxLength={6}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
              <Button
                onClick={handleRegister}
                disabled={loading || pin.length !== 6}
              >
                {loading ? "Ativando..." : "Ativar"}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setCodeRequested(false);
                setPin("");
                setResult(null);
              }}
              className="w-full"
            >
              Voltar para solicitar novo código
            </Button>
          </>
        )}
        {result && (
          <pre className="text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}