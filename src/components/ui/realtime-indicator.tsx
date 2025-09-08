import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
interface RealtimeIndicatorProps {
  isConnected: boolean;
  className?: string;
}
export function RealtimeIndicator({
  isConnected,
  className
}: RealtimeIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "w-2 h-2 rounded-full transition-colors duration-300",
        isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
      )} />
      <Activity className={cn(
        "size-4 transition-colors duration-300",
        isConnected ? "text-green-600" : "text-red-600"
      )} />
    </div>
  );
}