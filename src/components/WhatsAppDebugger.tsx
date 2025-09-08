import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bug, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface DebugInfo {
  hasAccessToken: boolean;
  hasPhoneNumberId: boolean;
  phoneId: string;
  testResult?: any;
}

export default function WhatsAppDebugger() {
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState("5511999999999");
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const { toast } = useToast();

  const debugWhatsAppConfig = async () => {
    setLoading(true);
    
    try {
      console.log("Testando configuração WhatsApp...");
      
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { 
          to: testPhone, 
          message: "🔍 TESTE DE CONFIGURAÇÃO\nSe você recebeu esta mensagem, o WhatsApp está funcionando corretamente!" 
        }
      });

      if (error) {
        console.error("Erro no teste:", error);
        throw error;
      }

      console.log("Resposta do teste:", data);
      
      setDebugInfo({
        hasAccessToken: data.details?.hasAccessToken || false,
        hasPhoneNumberId: data.details?.hasPhoneNumberId || false,
        phoneId: data.details?.phoneId || 'Não informado',
        testResult: data
      });

      if (data.ok) {
        toast({
          title: "✅ Teste realizado",
          description: "Mensagem de teste enviada! Verifique o WhatsApp.",
        });
      } else {
        toast({
          title: "❌ Erro no teste",
          description: data.error || data.message || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Erro crítico no teste:", error);
      toast({
        title: "❌ Erro crítico",
        description: `Falha no teste: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? 
      <CheckCircle className="size-4 text-green-600" /> : 
      <XCircle className="size-4 text-red-600" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="size-5" />
          Debug WhatsApp - Diagnóstico Completo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Número para teste:</label>
            <Input
              placeholder="Ex: 5511999999999"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use o número real da Débora para teste
            </p>
          </div>
          
          <Button 
            onClick={debugWhatsAppConfig} 
            disabled={loading || !testPhone.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Testando configuração...
              </>
            ) : (
              <>
                <Bug className="mr-2 size-4" />
                Testar Configuração WhatsApp
              </>
            )}
          </Button>
        </div>

        {debugInfo && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <h4 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Diagnóstico das Configurações
            </h4>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Token de Acesso (ACCESS_TOKEN):</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(debugInfo.hasAccessToken)}
                  <Badge variant={debugInfo.hasAccessToken ? "default" : "destructive"}>
                    {debugInfo.hasAccessToken ? "✓ Configurado" : "✗ Ausente"}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Phone Number ID:</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(debugInfo.hasPhoneNumberId)}
                  <Badge variant={debugInfo.hasPhoneNumberId ? "default" : "destructive"}>
                    {debugInfo.hasPhoneNumberId ? "✓ Configurado" : "✗ Ausente"}
                  </Badge>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                <strong>Phone ID:</strong> {debugInfo.phoneId}
              </div>
            </div>

            {debugInfo.testResult && (
              <details className="cursor-pointer">
                <summary className="text-sm font-medium mb-2">
                  Ver resposta completa da API
                </summary>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                  {JSON.stringify(debugInfo.testResult, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-sm">
          <div className="font-semibold mb-2">⚠️ Problemas Identificados:</div>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>O número da Débora está configurado como placeholder (5511999999999)</li>
            <li>Pode ser necessário configurar o número real no código</li>
            <li>Verificar se as credenciais do WhatsApp Business API estão corretas</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}