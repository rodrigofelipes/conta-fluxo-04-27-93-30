import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Holiday {
  id: string;
  name: string;
  date: string;
  is_national: boolean;
  description?: string;
  created_at: string;
  created_by: string;
}

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date');

      if (error) {
        console.error('Erro ao buscar feriados:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar feriados.",
          variant: "destructive"
        });
        return;
      }

      setHolidays(data || []);
    } catch (error) {
      console.error('Erro ao carregar feriados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar feriados.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getHolidaysForDate = (date: Date): Holiday[] => {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.filter(holiday => holiday.date === dateStr);
  };

  const getHolidaysForYear = (year: number): Holiday[] => {
    return holidays.filter(holiday => {
      const holidayYear = new Date(holiday.date + 'T12:00:00').getFullYear();
      return holidayYear === year;
    });
  };

  const checkHolidaysForYear = (year: number): boolean => {
    return getHolidaysForYear(year).length > 0;
  };

  const suggestSyncForYear = (year: number): boolean => {
    // Sugerir sincronização se não há feriados para o ano
    // e se é um ano válido (atual ou próximos 2 anos)
    const currentYear = new Date().getFullYear();
    const isValidYear = year >= currentYear && year <= currentYear + 2;
    return isValidYear && !checkHolidaysForYear(year);
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  return {
    holidays,
    loading,
    loadHolidays,
    getHolidaysForDate,
    getHolidaysForYear,
    checkHolidaysForYear,
    suggestSyncForYear
  };
}