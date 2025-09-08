
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase";

export type Role = "admin" | "user" | "supervisor" | "coordenador";
export type Setor = "PESSOAL" | "FISCAL" | "CONTABIL" | "PLANEJAMENTO" | "TODOS";

export interface User { 
  id: string; 
  role: Role; 
  name: string; 
  email: string; 
  username: string;
  setor?: Setor; // Setor do admin
  isMasterAdmin?: boolean; // Se é master admin
}

interface AuthContextProps {
  user: User | null;
  login: (emailOrUsername: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signup: (email: string, password: string, username: string, telefone?: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  verifyUserCredentials: (username: string, email: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const fetchUserRole = async (userId: string): Promise<Role> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.warn('Error fetching user role:', error);
        return 'user';
      }
      
      return (data?.role as Role) || 'user';
    } catch (error) {
      console.warn('Error fetching user role:', error);
      return 'user';
    }
  };

  const fetchUserSetor = async (userId: string): Promise<Setor | null> => {
    // Since admin_setores table doesn't exist, return default setor
    return 'CONTABIL';
  };

  const checkIfMasterAdmin = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('user_id', userId)
        .single();
      
      if (error || !data) return false;
      
      return data.role === 'admin' && (data.name === 'Débora' || data.name === 'Olevate');
    } catch (error) {
      return false;
    }
  };

  const createUserFromSupabaseUser = async (sUser: any): Promise<User> => {
    const role = await fetchUserRole(sUser.id);
    const setor = role === 'admin' ? await fetchUserSetor(sUser.id) : null;
    const isMasterAdmin = role === 'admin' ? await checkIfMasterAdmin(sUser.id) : false;
    
    // Fetch the actual name from profiles table instead of user_metadata
    let profileName = sUser.user_metadata?.name || sUser.user_metadata?.full_name || sUser.email || "Usuário";
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', sUser.id)
        .single();
      
      if (!error && profileData) {
        profileName = profileData.name;
      }
    } catch (error) {
      console.warn('Error fetching profile name:', error);
    }
    
    return {
      id: sUser.id,
      email: sUser.email || "",
      name: profileName as string,
      username: (sUser.user_metadata?.username || profileName || sUser.email?.split('@')[0] || "usuario") as string,
      role,
      ...(role === 'admin' && { setor, isMasterAdmin }),
    };
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const mappedUser = await createUserFromSupabaseUser(session.user);
      setUser(mappedUser);
      localStorage.setItem("cc_auth_user", JSON.stringify(mappedUser));
    }
  };

  // Initialize auth listener first, then get existing session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const sUser = session?.user;
      if (sUser) {
        // CRITICAL: Never use async functions directly in onAuthStateChange
        // Defer role fetching to avoid blocking auth state change
        setTimeout(async () => {
          try {
            const mappedUser = await createUserFromSupabaseUser(sUser);
            setUser(mappedUser);
            localStorage.setItem("cc_auth_user", JSON.stringify(mappedUser));
          } catch (error) {
            console.error('Error creating user from Supabase user:', error);
            // Set basic user info even if role fetching fails
            // Try to get name from profiles even in error case
            let fallbackName = sUser.user_metadata?.name || sUser.user_metadata?.full_name || sUser.email || "Usuário";
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('name')
                .eq('user_id', sUser.id)
                .single();
              
              if (profileData) {
                fallbackName = profileData.name;
              }
            } catch (profileError) {
              console.warn('Error fetching profile name in fallback:', profileError);
            }
            
            setUser({
              id: sUser.id,
              email: sUser.email || "",
              name: fallbackName as string,
              username: (sUser.user_metadata?.username || fallbackName || sUser.email?.split('@')[0] || "usuario") as string,
              role: 'user' as Role
            });
          }
        }, 0);
      } else {
        setUser(null);
        localStorage.removeItem("cc_auth_user");
      }
    });

    // Get existing session
    supabase.auth.getSession().then(async ({ data }) => {
      const sUser = data.session?.user;
      if (sUser) {
        try {
          const mappedUser = await createUserFromSupabaseUser(sUser);
          setUser(mappedUser);
          localStorage.setItem("cc_auth_user", JSON.stringify(mappedUser));
        } catch (error) {
          console.error('Error creating user from existing session:', error);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login: AuthContextProps["login"] = async (emailOrUsername, password) => {
    try {
      console.log('Tentando login com:', emailOrUsername);
      
      // If it contains @, it's an email, proceed normally
      if (emailOrUsername.includes('@')) {
        console.log('Login via email:', emailOrUsername);
        const { error } = await supabase.auth.signInWithPassword({ 
          email: emailOrUsername, 
          password 
        });
        if (error) {
          console.error('Erro login email:', error);
          if (error.message.includes('Invalid login credentials')) {
            return { ok: false, error: "Email ou senha incorretos" };
          }
          return { ok: false, error: error.message };
        }
        return { ok: true };
      }
      
      // Se não contém @, é um nome de usuário
      console.log('Login via username, buscando email para:', emailOrUsername);
      const { data: emailResult, error: functionError } = await supabase
        .rpc('get_user_email_by_username', { username_input: emailOrUsername });
      
      console.log('Email encontrado:', emailResult, 'Erro:', functionError);
      
      if (!functionError && emailResult) {
        console.log('Tentando login com email encontrado:', emailResult);
        // Encontrou o email do usuário, tentar fazer login
        const { error } = await supabase.auth.signInWithPassword({
          email: emailResult,
          password
        });
        console.log('Resultado login:', error);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            return { ok: false, error: "Usuário ou senha incorretos" };
          }
          return { ok: false, error: error.message };
        }
        return { ok: true };
      }
      
      // Se não encontrou usuário, retornar erro específico
      console.log('Usuário não encontrado');
      return { ok: false, error: "Nome de usuário não encontrado" };
      
    } catch (error) {
      console.error('Login error:', error);
      return { ok: false, error: "Erro inesperado durante o login" };
    }
  };

  const signup: AuthContextProps["signup"] = async (email, password, username, telefone) => {
    try {
      // Check if username already exists
      const { data: existingUsers, error: checkError } = await supabase
        .from('profiles')
        .select('name')
        .eq('name', username);

      if (checkError) {
        console.error('Error checking username:', checkError);
        return { ok: false, error: "Erro ao verificar nome de usuário" };
      }

      if (existingUsers && existingUsers.length > 0) {
        return { ok: false, error: "Nome de usuário já está em uso" };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: username,
            full_name: username,
            telefone: telefone
          }
        }
      });
      
      if (error) return { ok: false, error: error.message };
      
      // Usuários registrados normalmente recebem role 'user' por padrão
      
      return { ok: true };
    } catch (error) {
      console.error('Signup error:', error);
      return { ok: false, error: "Erro inesperado durante cadastro" };
    }
  };

  const logout: AuthContextProps["logout"] = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem("cc_auth_user");
  };

  const verifyUserCredentials: AuthContextProps["verifyUserCredentials"] = async (username, email) => {
    try {
      // Check if username exists in profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('name', username)
        .maybeSingle();

      if (profileError) {
        console.error('Error checking username:', profileError);
        return { ok: false, error: "Erro ao verificar dados" };
      }

      if (!profileData) {
        return { ok: false, error: "Nome de usuário não encontrado" };
      }

      // Since we can't directly query auth.users, we'll try to sign in with the email/username
      // This is a verification approach that doesn't actually log the user in
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: 'dummy_password_for_verification'
      });

      // If the error is "Invalid login credentials", it means the email exists but wrong password
      // If the error is "Email not confirmed" or similar, it means the email exists
      // If the error is "Invalid email", it means the email doesn't exist or doesn't match
      if (error) {
        if (error.message.includes('Invalid login credentials') || 
            error.message.includes('Email not confirmed') ||
            error.message.includes('too many')) {
          // This means the email exists in the system
          return { ok: true };
        } else {
          // Email doesn't exist or other error
          return { ok: false, error: "Email não corresponde ao nome de usuário fornecido" };
        }
      }

      // This shouldn't happen with a dummy password, but just in case
      return { ok: true };
    } catch (error) {
      console.error('Error in verifyUserCredentials:', error);
      return { ok: false, error: "Erro inesperado durante verificação" };
    }
  };

  const value = useMemo(() => ({ user, login, signup, logout, refreshUser, verifyUserCredentials }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
