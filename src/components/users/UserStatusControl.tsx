import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { UserCheck, UserX, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UserStatusControlProps {
  userId: string;
  userType: 'system_user' | 'client';
  active?: boolean;
  name: string;
  onUpdate: () => void;
  canDelete?: boolean;
  canToggleStatus?: boolean;
  disabledReason?: string;
}

export function UserStatusControl({
  userId,
  userType,
  active = true,
  name,
  onUpdate,
  canDelete = false,
  canToggleStatus = true,
  disabledReason
}: UserStatusControlProps) {
  const [loading, setLoading] = useState(false);

  const toggleUserStatus = async () => {
    try {
      if (!canToggleStatus) {
        toast({
          title: "Sem permissão",
          description: disabledReason || "Você não tem permissão para alterar o status deste usuário.",
          variant: "destructive"
        });
        return;
      }

      setLoading(true);

      if (userType === 'system_user') {
        // Desativar/ativar usuário do sistema
        const { data, error } = await supabase
          .from('profiles')
          .update({ active: !active })
          .eq('user_id', userId)
          .select('id, active')
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          throw new Error('Usuário não encontrado para atualização.');
        }

        toast({
          title: "Sucesso",
          description: `Usuário ${active ? 'desativado' : 'ativado'} com sucesso`
        });
      } else {
        // Para clientes, não temos campo active, então só permite exclusão
        toast({
          title: "Aviso",
          description: "Para clientes, use a opção de exclusão",
          variant: "destructive"
        });
        return;
      }

      onUpdate();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status do usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteEntity = async () => {
    try {
      setLoading(true);

      if (userType === 'system_user') {
        // Para usuários do sistema, fazer exclusão lógica (desativar)
        const { data, error } = await supabase
          .from('profiles')
          .update({ active: false })
          .eq('user_id', userId)
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Usuário não encontrado para desativação.');

        toast({
          title: "Sucesso",
          description: "Usuário desativado com sucesso"
        });
      } else {
        // Para clientes, exclusão física
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', userId);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Cliente excluído com sucesso"
        });
      }

      onUpdate();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir. Verifique se não há dependências.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Status Badge */}
      {userType === 'system_user' && (
        <Badge variant={active ? "default" : "secondary"}>
          {active ? "Ativo" : "Inativo"}
        </Badge>
      )}

      {/* Toggle Status Button (só para usuários do sistema) */}
      {userType === 'system_user' && (
        canToggleStatus ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
              >
                {active ? (
                  <UserX className="w-3 h-3 mr-1" />
                ) : (
                  <UserCheck className="w-3 h-3 mr-1" />
                )}
                {active ? "Desativar" : "Ativar"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {active ? "Desativar" : "Ativar"} usuário
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja {active ? "desativar" : "ativar"} o usuário "{name}"?
                  {active && " Usuários desativados não conseguem fazer login no sistema."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={toggleUserStatus}>
                  {active ? "Desativar" : "Ativar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled
            title={disabledReason || "Você não tem permissão para alterar o status deste usuário."}
            className="cursor-not-allowed"
          >
            {active ? (
              <UserX className="w-3 h-3 mr-1" />
            ) : (
              <UserCheck className="w-3 h-3 mr-1" />
            )}
            {active ? "Desativar" : "Ativar"}
          </Button>
        )
      )}

      {/* Delete Button */}
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {userType === 'system_user' ? 'usuário' : 'cliente'}</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir "{name}"? 
                {userType === 'system_user' 
                  ? " O usuário será desativado permanentemente."
                  : " Esta ação não pode ser desfeita."
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={deleteEntity}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}