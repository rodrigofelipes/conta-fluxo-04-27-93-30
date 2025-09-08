
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/state/auth";
import { supabase } from "@/integrations/supabase/client";

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function Signup() {
  const { signup, login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (!validateEmail(email)) {
      setLoading(false);
      return setError("Por favor, digite um e-mail com formato válido");
    }
    
    try {
      // Use Supabase auth signup instead
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: username,
            username,
            telefone
          }
        }
      });

      if (error) {
        console.error('Error creating user:', error);
        setLoading(false);
        if (error.message.includes('Email address') && error.message.includes('invalid')) {
          return setError("Por favor, use um e-mail válido. Emails de teste podem não ser aceitos.");
        }
        return setError(error.message || "Erro ao criar conta");
      }

      console.log('User created successfully:', data);
      
      // Conta criada com sucesso - redirecionar para login
      setLoading(false);
      navigate("/login");
      
    } catch (error) {
      console.error('Unexpected error creating user:', error);
      setLoading(false);
      setError("Erro inesperado ao criar conta");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center relative overflow-hidden">
      <div className="absolute inset-0 -z-10 animate-gradient-pan" style={{ backgroundImage: "var(--gradient-primary)" }} />
      
      {/* Theme toggle no canto superior direito */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      <Card className="w-[90%] max-w-[420px] card-elevated">
        <CardHeader>
          <CardTitle className="text-center">Criar conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input 
                id="telefone" 
                type="tel" 
                placeholder="Ex: 31997810730"
                value={telefone} 
                onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" variant="hero" type="submit" disabled={loading}>{loading ? "Criando conta..." : "Criar conta"}</Button>
            <div className="text-center text-sm">
              Já tem conta? <Link to="/login" className="underline">Entrar</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
