import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <img 
        src="/lovable-uploads/6fdf2876-fcf1-4489-9b89-9c3e6f5e9c6a.png"
        alt="CONCEPÇÃO CONTABILIDADE"
        className="w-full h-full object-contain"
      />
    </div>
  );
}