import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SearchInput = ({ placeholder, value, onChange, className }: SearchInputProps) => {
  const [inputValue, setInputValue] = useState(value);

  // Sincroniza com valor externo
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onChange(inputValue);
    }
  };

  return (
    <div className={`group relative flex-1 ${className || ""}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
      <Input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
        className="pl-10 bg-background/50 border-border/50 hover:border-border focus:border-primary transition-all duration-200 focus:ring-2 focus:ring-primary/20 focus:bg-background"
      />
    </div>
  );
};