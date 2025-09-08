import React from 'react';
import { cn } from '@/lib/utils';

interface ProportionalScalerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ProportionalScaler component that applies automatic scaling
 * to maintain proportions on smaller screens.
 * 
 * Uses CSS clamp() for fluid scaling and transform scale() 
 * as fallback for extreme small screens.
 */
export const ProportionalScaler: React.FC<ProportionalScalerProps> = ({
  children,
  className
}) => {
  return (
    <div className={cn("proportional-scaler", className)}>
      {children}
    </div>
  );
};

export default ProportionalScaler;