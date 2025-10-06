import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para acessar feature flags do sistema
 */
export function useFeatureFlag(key: string, defaultValue: string = ''): string {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlag = async () => {
      try {
        const { data, error } = await supabase
          .from('system_config')
          .select('config_value')
          .eq('config_key', key)
          .maybeSingle();

        if (error) {
          console.error('Error fetching feature flag:', error);
        } else if (data) {
          setValue(data.config_value);
        }
      } catch (err) {
        console.error('Error in useFeatureFlag:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFlag();
  }, [key]);

  return loading ? defaultValue : value;
}

/**
 * Hook para feature flags booleanos
 */
export function useBooleanFeatureFlag(key: string, defaultValue: boolean = false): boolean {
  const value = useFeatureFlag(key, defaultValue ? 'true' : 'false');
  return value === 'true';
}

/**
 * Hook para feature flags numéricos
 */
export function useNumericFeatureFlag(key: string, defaultValue: number = 0): number {
  const value = useFeatureFlag(key, String(defaultValue));
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}
