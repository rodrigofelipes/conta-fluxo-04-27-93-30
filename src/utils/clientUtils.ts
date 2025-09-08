import { supabase } from "@/integrations/supabase/client";

// Função para buscar um cliente por ID no Supabase
export const findClientById = async (id: string) => {
  if (!id) return null;
  
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Erro ao buscar cliente:', error);
      return null;
    }
    
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: '',
      cnpj: data.cpf,
      regime: 'Simples Nacional',
      city: data.residential_address,
      state: data.construction_address,
      setor: 'CONTABIL',
      dataAbertura: data.birth_date,
      inscricaoEstadual: ''
    };
  } catch (error) {
    console.error('Erro inesperado ao buscar cliente:', error);
    return null;
  }
};