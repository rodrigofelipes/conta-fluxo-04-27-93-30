import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/state/auth'
import { useToast } from './use-toast'

const gradientOptions = [
  {
    name: "Dourado Atual",
    gradient: "linear-gradient(135deg, hsl(41 86% 58%) 0%, hsl(45 88% 72%) 40%, hsl(41 86% 58%) 80%, hsl(35 82% 48%) 100%)",
    colors: {
      primary: "41 86% 58%",
      brand: "41 94% 56%",
      brand2: "45 95% 70%",
      brand3: "35 90% 45%",
      ring: "41 86% 58%"
    }
  },
  {
    name: "Azul Oceano",
    gradient: "linear-gradient(135deg, hsl(210 100% 56%) 0%, hsl(220 90% 70%) 50%, hsl(200 85% 45%) 100%)",
    colors: {
      primary: "210 100% 56%",
      brand: "210 100% 56%",
      brand2: "220 90% 70%", 
      brand3: "200 85% 45%",
      ring: "210 100% 56%"
    }
  },
  {
    name: "Verde Esmeralda", 
    gradient: "linear-gradient(135deg, hsl(160 84% 39%) 0%, hsl(170 90% 50%) 50%, hsl(150 75% 35%) 100%)",
    colors: {
      primary: "160 84% 39%",
      brand: "160 84% 39%",
      brand2: "170 90% 50%",
      brand3: "150 75% 35%",
      ring: "160 84% 39%"
    }
  },
  {
    name: "Roxo Místico",
    gradient: "linear-gradient(135deg, hsl(280 70% 55%) 0%, hsl(290 85% 70%) 50%, hsl(270 60% 45%) 100%)",
    colors: {
      primary: "280 70% 55%",
      brand: "280 70% 55%",
      brand2: "290 85% 70%",
      brand3: "270 60% 45%",
      ring: "280 70% 55%"
    }
  },
  {
    name: "Laranja Sunset",
    gradient: "linear-gradient(135deg, hsl(25 95% 60%) 0%, hsl(35 100% 70%) 50%, hsl(15 85% 50%) 100%)",
    colors: {
      primary: "25 95% 60%",
      brand: "25 95% 60%",
      brand2: "35 100% 70%",
      brand3: "15 85% 50%",
      ring: "25 95% 60%"
    }
  },
  {
    name: "Rosa Suave",
    gradient: "linear-gradient(135deg, hsl(330 70% 65%) 0%, hsl(340 85% 75%) 50%, hsl(320 60% 55%) 100%)",
    colors: {
      primary: "330 70% 65%",
      brand: "330 70% 65%",
      brand2: "340 85% 75%",
      brand3: "320 60% 55%",
      ring: "330 70% 65%"
    }
  },
  {
    name: "Ciano Tecnológico",
    gradient: "linear-gradient(135deg, hsl(180 70% 55%) 0%, hsl(190 85% 65%) 50%, hsl(170 60% 45%) 100%)",
    colors: {
      primary: "180 70% 55%",
      brand: "180 70% 55%",
      brand2: "190 85% 65%",
      brand3: "170 60% 45%",
      ring: "180 70% 55%"
    }
  },
  {
    name: "Vermelho Elegante",
    gradient: "linear-gradient(135deg, hsl(0 75% 58%) 0%, hsl(10 85% 68%) 50%, hsl(350 70% 48%) 100%)",
    colors: {
      primary: "0 75% 58%",
      brand: "0 75% 58%",
      brand2: "10 85% 68%",
      brand3: "350 70% 48%",
      ring: "0 75% 58%"
    }
  },
  {
    name: "Azul Noturno",
    gradient: "linear-gradient(135deg, hsl(240 65% 45%) 0%, hsl(250 80% 60%) 50%, hsl(230 55% 35%) 100%)",
    colors: {
      primary: "240 65% 45%",
      brand: "240 65% 45%",
      brand2: "250 80% 60%",
      brand3: "230 55% 35%",
      ring: "240 65% 45%"
    }
  },
  {
    name: "Verde Menta",
    gradient: "linear-gradient(135deg, hsl(140 60% 55%) 0%, hsl(150 75% 65%) 50%, hsl(130 50% 45%) 100%)",
    colors: {
      primary: "140 60% 55%",
      brand: "140 60% 55%",
      brand2: "150 75% 65%",
      brand3: "130 50% 45%",
      ring: "140 60% 55%"
    }
  },
  {
    name: "Dourado Luxo",
    gradient: "linear-gradient(135deg, hsl(45 100% 65%) 0%, hsl(50 95% 75%) 30%, hsl(40 90% 55%) 70%, hsl(35 85% 45%) 100%)",
    colors: {
      primary: "45 100% 65%",
      brand: "45 100% 65%",
      brand2: "50 95% 75%",
      brand3: "35 85% 45%",
      ring: "45 100% 65%"
    }
  },
  {
    name: "Prata Metálico",
    gradient: "linear-gradient(135deg, hsl(220 15% 65%) 0%, hsl(200 20% 75%) 50%, hsl(240 10% 55%) 100%)",
    colors: {
      primary: "220 15% 65%",
      brand: "220 15% 65%",
      brand2: "200 20% 75%",
      brand3: "240 10% 55%",
      ring: "220 15% 65%"
    }
  },
  {
    name: "Gradiente Arco-íris",
    gradient: "linear-gradient(135deg, hsl(0 70% 60%) 0%, hsl(60 70% 60%) 16.66%, hsl(120 70% 60%) 33.33%, hsl(180 70% 60%) 50%, hsl(240 70% 60%) 66.66%, hsl(300 70% 60%) 83.33%, hsl(360 70% 60%) 100%)",
    colors: {
      primary: "180 70% 60%",
      brand: "180 70% 60%",
      brand2: "240 70% 60%",
      brand3: "120 70% 60%",
      ring: "180 70% 60%"
    }
  },
  {
    name: "Gradiente Flamingo",
    gradient: "linear-gradient(135deg, hsl(330 85% 70%) 0%, hsl(340 90% 75%) 30%, hsl(20 95% 70%) 70%, hsl(25 85% 60%) 100%)",
    colors: {
      primary: "330 85% 70%",
      brand: "330 85% 70%",
      brand2: "340 90% 75%",
      brand3: "25 85% 60%",
      ring: "330 85% 70%"
    }
  },
  {
    name: "Gradiente Nebula",
    gradient: "linear-gradient(135deg, hsl(280 80% 60%) 0%, hsl(240 70% 50%) 25%, hsl(200 85% 65%) 50%, hsl(160 75% 55%) 75%, hsl(120 60% 45%) 100%)",
    colors: {
      primary: "240 70% 50%",
      brand: "240 70% 50%",
      brand2: "200 85% 65%",
      brand3: "280 80% 60%",
      ring: "240 70% 50%"
    }
  },
  {
    name: "Gradiente Tropical",
    gradient: "linear-gradient(135deg, hsl(180 90% 55%) 0%, hsl(160 85% 60%) 25%, hsl(140 80% 50%) 50%, hsl(80 75% 55%) 75%, hsl(40 85% 65%) 100%)",
    colors: {
      primary: "140 80% 50%",
      brand: "140 80% 50%",
      brand2: "80 75% 55%",
      brand3: "180 90% 55%",
      ring: "140 80% 50%"
    }
  }
]

export function useGradientDatabase() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [selectedGradient, setSelectedGradient] = useState("Dourado Atual")

  // Load gradient from localStorage first, then database
  useEffect(() => {
    const loadUserGradient = async () => {
      // Always try to load from localStorage first for immediate theme application
      const savedGradient = localStorage.getItem('user-gradient');
      if (savedGradient) {
        setSelectedGradient(savedGradient);
        applyGradient(savedGradient, false);
      }

      if (!user?.id) {
        // Apply default gradient if no user and no saved gradient
        if (!savedGradient) {
          applyGradient("Dourado Atual", false);
          localStorage.setItem('user-gradient', 'Dourado Atual');
        }
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gradient')
          .eq('user_id', user.id)
          .single();

        if (profile?.gradient) {
          setSelectedGradient(profile.gradient);
          applyGradient(profile.gradient, false);
          // Save to localStorage for future immediate loading
          localStorage.setItem('user-gradient', profile.gradient);
        } else {
          // Apply default gradient if no gradient found in database
          if (!savedGradient) {
            applyGradient("Dourado Atual", false);
            localStorage.setItem('user-gradient', 'Dourado Atual');
          }
        }
      } catch (error) {
        console.error('Erro ao carregar gradiente:', error);
        // In case of error, apply default if no saved gradient
        if (!savedGradient) {
          applyGradient("Dourado Atual", false);
          localStorage.setItem('user-gradient', 'Dourado Atual');
        }
      }
    };

    loadUserGradient();
  }, [user?.id])

  // Apply gradient and save to database
  const applyGradient = async (gradientName: string, saveToDb = true) => {
    const selectedGradientOption = gradientOptions.find(g => g.name === gradientName)
    if (!selectedGradientOption) return

    const root = document.documentElement
    
    // Apply gradients
    root.style.setProperty('--gradient-primary', selectedGradientOption.gradient)
    root.style.setProperty('--gradient-support', selectedGradientOption.gradient)
    
    // Apply color palette
    root.style.setProperty('--primary', selectedGradientOption.colors.primary)
    root.style.setProperty('--brand', selectedGradientOption.colors.brand)
    root.style.setProperty('--brand-2', selectedGradientOption.colors.brand2)
    root.style.setProperty('--brand-3', selectedGradientOption.colors.brand3)
    root.style.setProperty('--ring', selectedGradientOption.colors.ring)
    
    // Update sidebar colors
    root.style.setProperty('--sidebar-primary', selectedGradientOption.colors.primary)
    root.style.setProperty('--sidebar-ring', selectedGradientOption.colors.ring)
    
    setSelectedGradient(gradientName)
    
    // Always save to localStorage for immediate loading
    localStorage.setItem('user-gradient', gradientName);
    
    if (saveToDb && user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ gradient: gradientName })
          .eq('user_id', user.id)

        toast({
          title: "Tema aplicado",
          description: `Gradiente "${gradientName}" salvo com sucesso!`
        })
      } catch (error) {
        console.error('Erro ao salvar gradiente:', error)
        toast({
          title: "Erro",
          description: "Erro ao salvar gradiente no banco de dados",
          variant: "destructive"
        })
      }
    }
  }

  return {
    selectedGradient,
    applyGradient,
    gradientOptions
  }
}