import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, User } from "lucide-react";

export default function ClientLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Por favor, preencha usuário e senha.",
      });
      return;
    }

    setLoading(true);

    try {
      // Buscar email pelo username
      const { data: emailData } = await supabase.rpc('get_user_email_by_username', {
        username_input: username
      });

      if (!emailData) {
        toast({
          variant: "destructive",
          title: "Usuário não encontrado",
          description: "Verifique seu nome de usuário.",
        });
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailData,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Usuário não encontrado");
      }

      // Verificar vínculo com clients; se não existir, criar automaticamente
      const { data: clientRow } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (!clientRow) {
        const nameFromMeta = (authData.user.user_metadata as any)?.username || username || (authData.user.email?.split('@')[0]) || 'Cliente';
        const { error: createClientError } = await supabase
          .from('clients')
          .insert([{ 
            user_id: authData.user.id,
            name: nameFromMeta,
            email: authData.user.email ?? null,
            classification: 'cliente'
          }]);
        if (createClientError) {
          await supabase.auth.signOut();
          toast({
            variant: 'destructive',
            title: 'Acesso negado',
            description: 'Não foi possível vincular sua conta de cliente.',
          });
          return;
        }
      }

      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo ao portal do cliente.",
      });

      navigate("/portal-cliente/dashboard");
    } catch (error: any) {
      console.error("Erro ao fazer login:", error);
      
      let errorMessage = "Erro ao fazer login. Verifique suas credenciais.";
      
      if (error.message?.includes("Invalid login credentials")) {
        errorMessage = "Usuário ou senha incorretos.";
      } else if (error.message?.includes("Email not confirmed")) {
        errorMessage = "Por favor, confirme seu email antes de fazer login.";
      }

      toast({
        variant: "destructive",
        title: "Erro no login",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-bold">Portal do Cliente</CardTitle>
          <CardDescription>
            Acesse sua área financeira
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="seu_usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <div className="text-center space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/portal-cliente/cadastro")}
                className="w-full"
              >
                Criar conta
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => navigate("/forgot")}
                className="text-sm"
              >
                Esqueceu sua senha?
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
