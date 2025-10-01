export type Role = "admin" | "user" | "supervisor" | "coordenador" | "marketing";

export const getRoleLabel = (role: Role): string => {
  switch (role) {
    case 'admin':
      return 'Administrador';
    case 'supervisor':
      return 'Supervisor';
    case 'coordenador':
      return 'Coordenador';
    case 'marketing':
      return 'Marketing';
    case 'user':
      return 'Colaborador';
    default:
      return 'Colaborador';
  }
};

export const getRoleBadgeVariant = (role: Role): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (role) {
    case 'admin':
      return 'destructive';
    case 'supervisor':
    case 'coordenador':
      return 'default';
    case 'marketing':
      return 'outline';
    case 'user':
    default:
      return 'secondary';
  }
};