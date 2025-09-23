import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit2, Trash2, FolderOpen, Folder } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FinancialCategory {
  id: string;
  name: string;
  category_type: 'cost_forecast' | 'variable' | 'fixed';
  parent_id?: string;
  created_at: string;
  children?: FinancialCategory[];
}

interface CategoryFormData {
  name: string;
  category_type: 'cost_forecast' | 'variable' | 'fixed';
  parent_id?: string;
}

const CATEGORY_TYPES = {
  cost_forecast: 'Previsão de Custo',
  variable: 'Variável',
  fixed: 'Fixo'
};

export function FinancialCategoryManagement() {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    category_type: 'cost_forecast'
  });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Organizar categorias em hierarquia
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
      console.error('Erro ao carregar categorias:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias financeiras",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da categoria é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      if (editingCategory) {
        // Atualizar categoria
        const { error } = await supabase
          .from('financial_categories')
          .update({
            name: formData.name,
            category_type: formData.category_type,
            parent_id: formData.parent_id || null
          })
          .eq('id', editingCategory.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Categoria atualizada com sucesso"
        });
      } else {
        // Criar nova categoria
        const { error } = await supabase
          .from('financial_categories')
          .insert({
            name: formData.name,
            category_type: formData.category_type,
            parent_id: formData.parent_id || null,
            created_by: user.id
          });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Categoria criada com sucesso"
        });
      }

      setFormData({ name: '', category_type: 'cost_forecast' });
      setEditingCategory(null);
      setIsCreateOpen(false);
      fetchCategories();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar categoria",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('financial_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso"
      });

      fetchCategories();
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria. Verifique se não há subcategorias ou transações vinculadas.",
        variant: "destructive"
      });
    }
  };

  const openCreateDialog = (parentId?: string, categoryType?: 'cost_forecast' | 'variable' | 'fixed') => {
    setFormData({
      name: '',
      category_type: categoryType || 'cost_forecast',
      parent_id: parentId
    });
    setEditingCategory(null);
    setIsCreateOpen(true);
  };

  const openEditDialog = (category: FinancialCategory) => {
    setFormData({
      name: category.name,
      category_type: category.category_type,
      parent_id: category.parent_id
    });
    setEditingCategory(category);
    setIsCreateOpen(true);
  };

  const renderCategory = (category: FinancialCategory, level = 0) => (
    <div key={category.id} className={`${level > 0 ? 'ml-6 border-l-2 border-muted pl-4' : ''}`}>
      <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
        <div className="flex items-center gap-2">
          {category.children && category.children.length > 0 ? (
            <FolderOpen className="w-4 h-4 text-primary" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-medium">{category.name}</span>
          <span className="text-xs text-muted-foreground">
            ({CATEGORY_TYPES[category.category_type]})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCreateDialog(category.id, category.category_type)}
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(category)}
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir a categoria "{category.name}"? 
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(category.id)}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {category.children?.map(child => renderCategory(child, level + 1))}
    </div>
  );

  if (loading) {
    return <div>Carregando categorias...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gerenciar Categorias Financeiras</h3>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openCreateDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Categoria</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Digite o nome da categoria"
                />
              </div>
              
              <div>
                <Label htmlFor="category_type">Tipo de Categoria</Label>
                <Select 
                  value={formData.category_type} 
                  onValueChange={(value: 'cost_forecast' | 'variable' | 'fixed') => 
                    setFormData(prev => ({ ...prev, category_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cost_forecast">Previsão de Custo</SelectItem>
                    <SelectItem value="variable">Variável</SelectItem>
                    <SelectItem value="fixed">Fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingCategory(null);
                    setFormData({ name: '', category_type: 'cost_forecast' });
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  {editingCategory ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(['cost_forecast', 'variable', 'fixed'] as const).map(categoryType => (
          <Card key={categoryType}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {CATEGORY_TYPES[categoryType]}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCreateDialog(undefined, categoryType)}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {categories
                .filter(cat => cat.category_type === categoryType)
                .map(category => renderCategory(category))
              }
              {categories.filter(cat => cat.category_type === categoryType).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma categoria criada
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}