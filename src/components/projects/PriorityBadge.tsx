import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Clock, Zap } from "lucide-react";

export type Priority = "baixa" | "media" | "alta" | "urgente";

interface PriorityBadgeProps {
  priority: Priority;
  showIcon?: boolean;
}

export function PriorityBadge({ priority, showIcon = true }: PriorityBadgeProps) {
  const config = {
    baixa: {
      label: "Baixa",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      icon: Clock
    },
    media: {
      label: "Média",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      icon: AlertCircle
    },
    alta: {
      label: "Alta",
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      icon: AlertTriangle
    },
    urgente: {
      label: "Urgente",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      icon: Zap
    }
  };

  const { label, className, icon: Icon } = config[priority];

  return (
    <Badge className={className}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  );
}
