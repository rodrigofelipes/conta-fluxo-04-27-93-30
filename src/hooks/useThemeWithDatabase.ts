import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/state/auth'

export function useThemeWithDatabase() {
  const { setTheme, theme, systemTheme, resolvedTheme } = useTheme()
  const { user } = useAuth()

  // Load theme from database when user logs in
  useEffect(() => {
    const loadUserTheme = async () => {
      if (!user?.id) return

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('theme')
          .eq('user_id', user.id)
          .single()

        if (profile?.theme && profile.theme !== theme) {
          setTheme(profile.theme)
        }
      } catch (error) {
        console.error('Erro ao carregar tema:', error)
      }
    }

    loadUserTheme()
  }, [user?.id, setTheme, theme])

  // Save theme to database when it changes
  const updateTheme = async (newTheme: string) => {
    setTheme(newTheme)
    
    if (!user?.id) return

    try {
      await supabase
        .from('profiles')
        .update({ theme: newTheme })
        .eq('user_id', user.id)
    } catch (error) {
      console.error('Erro ao salvar tema:', error)
    }
  }

  return {
    theme: resolvedTheme,
    setTheme: updateTheme
  }
}