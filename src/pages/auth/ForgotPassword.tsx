import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/state/auth";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { verifyUserCredentials } = useAuth();
  const [step, setStep] = useState<"verify" | "reset">("verify");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!username || !email) {
      setError("Preencha todos os campos para verificação");
      setLoading(false);
      return;
    }

    // Verificar usuário e e-mail
    const result = await verifyUserCredentials(username, email);
    
    if (result.ok) {
      setStep("reset");
    } else {
      setError(result.error || "Dados incorretos");
    }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      // Aqui você implementaria a lógica real de reset de senha
      // Por enquanto, simularemos sucesso
      navigate("/login");
    } catch (err) {
      setError("Erro ao redefinir senha. Tente novamente.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid place-items-center relative overflow-hidden">
      {/* Theme toggle no canto superior direito */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      <Card className="w-[90%] max-w-[420px] card-elevated">
        <CardHeader>
          <CardTitle className="text-center">
            {step === "verify" ? "Redefinir senha" : "Nova senha"}
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            {step === "verify" 
              ? "Confirme seus dados para redefinir sua senha" 
              : "Digite sua nova senha"
            }
          </p>
        </CardHeader>
        <CardContent>
          {step === "verify" ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input 
                  id="username" 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required 
                  placeholder="Digite seu nome de usuário"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  placeholder="Digite seu e-mail"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" variant="hero" type="submit" disabled={loading}>
                {loading ? "Verificando..." : "Verificar dados"}
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm underline text-muted-foreground">
                  Voltar ao login
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input 
                  id="newPassword" 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  placeholder="Digite sua nova senha"
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                  placeholder="Confirme sua nova senha"
                  minLength={6}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" variant="hero" type="submit" disabled={loading}>
                {loading ? "Redefinindo..." : "Redefinir senha"}
              </Button>
              <div className="flex justify-between text-sm">
                <button 
                  type="button" 
                  onClick={() => setStep("verify")} 
                  className="underline text-muted-foreground"
                >
                  Voltar
                </button>
                <Link to="/login" className="underline text-muted-foreground">
                  Ir para login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
