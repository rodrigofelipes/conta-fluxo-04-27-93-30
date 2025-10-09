import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, CheckCircle, XCircle, RefreshCw, HardDrive, FolderOpen } from "lucide-react";

export function GoogleDriveSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [rootFolderId, setRootFolderId] = useState(import.meta.env.VITE_GOOGLE_DRIVE_ROOT_FOLDER_ID || '');
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: 0 });

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      setConnectionStatus('checking');
      const { data, error } = await supabase.functions.invoke('google-drive-token');
      
      if (error) throw error;
      
      if (data?.access_token) {
        setConnectionStatus('connected');
        await loadStats();
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
      setConnectionStatus('disconnected');
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('client_documents')
        .select('file_size')
        .eq('upload_status', 'verified');
      
      if (!error && data) {
        const totalFiles = data.length;
        const totalSize = data.reduce((acc, doc) => acc + (doc.file_size || 0), 0);
        setStats({ totalFiles, totalSize });
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      const { data, error } = await supabase.functions.invoke('google-drive-token');
      
      if (error) throw error;
      
      if (data?.access_token) {
        toast({
          title: "Conexão bem-sucedida",
          description: "Google Drive está configurado e acessível",
        });
        setConnectionStatus('connected');
        await loadStats();
      } else {
        throw new Error('Token não recebido');
      }
    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      toast({
        title: "Erro na conexão",
        description: error.message || "Não foi possível conectar ao Google Drive",
        variant: "destructive",
      });
      setConnectionStatus('disconnected');
    } finally {
      setTesting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="size-5" />
            Status da Conexão
          </CardTitle>
          <CardDescription>
            Verifique o status da integração com Google Drive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                connectionStatus === 'connected' 
                  ? 'bg-green-100 dark:bg-green-900/20' 
                  : connectionStatus === 'checking'
                  ? 'bg-yellow-100 dark:bg-yellow-900/20'
                  : 'bg-red-100 dark:bg-red-900/20'
              }`}>
                {connectionStatus === 'connected' ? (
                  <CheckCircle className="size-5 text-green-600 dark:text-green-400" />
                ) : connectionStatus === 'checking' ? (
                  <RefreshCw className="size-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
                ) : (
                  <XCircle className="size-5 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div>
                <h3 className="font-medium">Google Drive</h3>
                <p className="text-sm text-muted-foreground">
                  {connectionStatus === 'connected' 
                    ? 'Conectado e operacional' 
                    : connectionStatus === 'checking'
                    ? 'Verificando conexão...'
                    : 'Não conectado'}
                </p>
              </div>
            </div>
            <Badge variant={connectionStatus === 'connected' ? 'default' : 'secondary'}>
              {connectionStatus === 'connected' ? 'Ativo' : connectionStatus === 'checking' ? 'Verificando' : 'Inativo'}
            </Badge>
          </div>

          {connectionStatus === 'connected' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Total de Arquivos</span>
                </div>
                <p className="text-2xl font-bold">{stats.totalFiles.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Cloud className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Espaço Utilizado</span>
                </div>
                <p className="text-2xl font-bold">{formatBytes(stats.totalSize)}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={testConnection} disabled={testing} variant="outline">
              {testing && <RefreshCw className="mr-2 size-4 animate-spin" />}
              Testar Conexão
            </Button>
            <Button onClick={checkConnection} disabled={testing} variant="ghost">
              <RefreshCw className="mr-2 size-4" />
              Atualizar Status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="size-5" />
            Configuração da Pasta Raiz
          </CardTitle>
          <CardDescription>
            Configure o ID da pasta raiz onde os arquivos serão armazenados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rootFolderId">ID da Pasta Raiz</Label>
            <Input
              id="rootFolderId"
              value={rootFolderId}
              onChange={(e) => setRootFolderId(e.target.value)}
              placeholder="Digite o ID da pasta raiz do Google Drive"
              disabled
            />
            <p className="text-xs text-muted-foreground">
              O ID da pasta é configurado nas variáveis de ambiente do sistema.
              Para alterar, atualize a variável VITE_GOOGLE_DRIVE_ROOT_FOLDER_ID no arquivo .env
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="p-2 h-fit rounded-lg bg-primary/10">
              <Cloud className="size-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium">Service Account Configurada</h4>
              <p className="text-sm text-muted-foreground">
                O sistema está usando autenticação via Service Account do Google Cloud.
                Os arquivos são enviados para uma pasta compartilhada no Google Drive,
                não requerendo login individual dos usuários.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
