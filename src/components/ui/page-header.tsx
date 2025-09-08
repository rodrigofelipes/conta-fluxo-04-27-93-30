import { cn } from "@/lib/utils";
import { ReactNode } from "react";
interface PageHeaderProps {
  title: string;
  subtitle?: string | ReactNode;
  className?: string;
}
export function PageHeader({
  title,
  subtitle,
  className
}: PageHeaderProps) {
  return <div className={cn("relative w-full", className)}>
      <div className="rounded-lg responsive-padding shadow-lg btn-hero animate-gradient-pan w-full">
        <h1 className="responsive-text-3xl font-bold tracking-tight text-white text-left">
          {title}
        </h1>
        {subtitle && <p className="text-white/80 mt-1 sm:mt-2 text-left responsive-text-sm">
            {subtitle}
          </p>}
      </div>
    </div>;
}