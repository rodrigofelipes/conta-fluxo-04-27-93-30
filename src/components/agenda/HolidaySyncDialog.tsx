import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, CheckCircle, AlertCircle } from "lucide-react";

const syncFormSchema = z.object({
  year: z.string().min(4, "Selecione um ano"),
});

interface HolidaySyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHolidaysSynced: () => void;
}

interface SyncResult {
  message: string;
  total: number;
  inserted: number;
  existing: number;
  holidays?: any[];
}

export function HolidaySyncDialog({ open, onOpenChange, onHolidaysSynced }: HolidaySyncDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const form = useForm<z.infer<typeof syncFormSchema>>({
    resolver: zodResolver(syncFormSchema),
    defaultValues: {
      year: currentYear.toString(),
    },
  });

  const onSubmit = async (values: z.infer<typeof syncFormSchema>) => {
    setLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-holidays', {
        body: { year: parseInt(values.year) }
      });

      if (error) {
        console.error('Erro na função:', error);
        toast({
          title: "Erro na sincronização",
          description: error.message || "Erro ao sincronizar feriados.",
          variant: "destructive"
        });
        return;
      }

      setResult(data);
      
      if (data.inserted > 0) {
        toast({
          title: "Sincronização concluída!",
          description: `${data.inserted} novos feriados adicionados para ${values.year}.`,
        });
        onHolidaysSynced();
      } else {
        toast({
          title: "Nenhum feriado novo",
          description: data.message,
        });
      }

    } catch (error) {
      console.error('Erro ao sincronizar feriados:', error);
      toast({
        title: "Erro",
        description: "Erro ao sincronizar feriados. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setResult(null);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Sincronizar Feriados
          </DialogTitle>
        </DialogHeader>
        
        {!result ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano para sincronização</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o ano" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {years.map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                            {year === currentYear && " (Atual)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">ℹ️ Como funciona:</p>
                <ul className="text-xs space-y-1">
                  <li>• Busca feriados nacionais brasileiros automaticamente</li>
                  <li>• Evita duplicatas - só adiciona feriados novos</li>
                  <li>• Usa APIs públicas confiáveis (BrasilAPI/Nager.Date)</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Sincronizar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div className={`flex items-start gap-3 p-4 rounded-lg ${
              result.inserted > 0 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              {result.inserted > 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  result.inserted > 0 ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  {result.message}
                </p>
                <div className={`text-sm mt-2 space-y-1 ${
                  result.inserted > 0 ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  <p>📊 <strong>Resumo:</strong></p>
                  <p>• Total de feriados encontrados: {result.total}</p>
                  <p>• Novos feriados adicionados: {result.inserted}</p>
                  <p>• Feriados já existentes: {result.existing}</p>
                </div>
              </div>
            </div>

            {result.holidays && result.holidays.length > 0 && (
              <div className="max-h-40 overflow-y-auto">
                <p className="text-sm font-medium mb-2">Feriados adicionados:</p>
                <div className="space-y-1">
                  {result.holidays.map((holiday, index) => (
                    <div key={index} className="text-xs bg-gray-50 p-2 rounded border">
                      <div className="font-medium">{holiday.name}</div>
                      <div className="text-gray-600">
                        {new Date(holiday.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {holiday.is_national && " • Nacional"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}