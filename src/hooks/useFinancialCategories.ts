import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface FinancialCategory {
  id: string;
  name: string;
  category_type: 'cost_forecast' | 'variable' | 'fixed';
  parent_id?: string;
  created_at: string;
  created_by: string;
  children?: FinancialCategory[];
}

export function useFinancialCategories() {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_categories')
        .select('*')
        .order('name');

      if (error) throw error;

      // Organizar em hierarquia
      const categoriesMap = new Map<string, FinancialCategory>();
      const rootCategories: FinancialCategory[] = [];

      data?.forEach(category => {
        categoriesMap.set(category.id, { 
          ...category, 
          children: [],
          category_type: category.category_type as 'cost_forecast' | 'variable' | 'fixed'
        });
      });

      data?.forEach(category => {
        const categoryWithChildren = categoriesMap.get(category.id)!;
        if (category.parent_id) {
          const parent = categoriesMap.get(category.parent_id);
          if (parent) {
            parent.children?.push(categoryWithChildren);
          }
        } else {
          rootCategories.push(categoryWithChildren);
        }
      });

      setCategories(rootCategories);
    } catch (error) {
      console.error('Erro ao buscar categorias financeiras:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias financeiras",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (categoryData: {
    name: string;
    category_type: 'cost_forecast' | 'variable' | 'fixed';
    parent_id?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('financial_categories')
        .insert({
          ...categoryData,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria criada com sucesso"
      });

      await fetchCategories();
      return true;
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar categoria",
        variant: "destructive"
      });
      return false;
    }
  };

  const updateCategory = async (id: string, categoryData: {
    name: string;
    category_type: 'cost_forecast' | 'variable' | 'fixed';
    parent_id?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('financial_categories')
        .update(categoryData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria atualizada com sucesso"
      });

      await fetchCategories();
      return true;
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar categoria",
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('financial_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso"
      });

      await fetchCategories();
      return true;
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria. Verifique se não há subcategorias ou transações vinculadas.",
        variant: "destructive"
      });
      return false;
    }
  };

  const getCategoriesByType = (type: 'cost_forecast' | 'variable' | 'fixed') => {
    return categories.filter(cat => cat.category_type === type);
  };

  const getFlatCategories = (): FinancialCategory[] => {
    const flatCategories: FinancialCategory[] = [];
    
    const flatten = (cats: FinancialCategory[]) => {
      cats.forEach(cat => {
        flatCategories.push(cat);
        if (cat.children) {
          flatten(cat.children);
        }
      });
    };
    
    flatten(categories);
    return flatCategories;
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoriesByType,
    getFlatCategories
  };
}