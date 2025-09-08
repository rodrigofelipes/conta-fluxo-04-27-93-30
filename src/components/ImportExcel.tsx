import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import * as XLSX from 'xlsx';
import type { Setor } from "@/state/auth";

interface ImportData {
  name: string;
  email?: string;
  cpf?: string;
  classification: 'cliente' | 'colaborador' | 'fornecedor';
  created_by?: string;
}

interface ImportExcelProps {
  onImportComplete: () => void;
}

export function ImportExcel({ onImportComplete }: ImportExcelProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione um arquivo Excel (.xlsx ou .xls).",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const validateRowData = (row: any, rowIndex: number): ImportData | null => {
    // O nome pode vir da razão social se não houver campo nome específico
    let nome = row.nome;
    if (!nome && row.razao_social) {
      nome = row.razao_social;
    }
    
    if (!nome || typeof nome !== 'string') {
      console.warn(`Linha ${rowIndex + 2}: Nome ou Razão Social é obrigatório`);
      return null;
    }

    // Processar campo contato (pode ser telefone ou email)
    let email = row.email;
    let telefone = row.telefone;
    
    if (row.contato) {
      const contatoStr = String(row.contato).trim();
      // Se contém @ é email, senão é telefone
      if (contatoStr.includes('@')) {
        email = contatoStr;
      } else {
        telefone = contatoStr;
      }
    }

    // Processar situacao - converter "Ativa?" para formato padrão
    let situacao = 'ATIVO';
    if (row.situacao) {
      const situacaoStr = String(row.situacao).toLowerCase().trim();
      if (situacaoStr.includes('não') || situacaoStr.includes('inativa') || situacaoStr === 'false' || situacaoStr === '0') {
        situacao = 'INATIVO';
      }
    }

    // Combinar endereço com complemento se houver
    let endereco = row.endereco ? String(row.endereco).trim() : undefined;
    if (endereco && row.complemento) {
      endereco += `, ${String(row.complemento).trim()}`;
    }

    // Converter data do Excel para formato ISO
    let clienteDesde = undefined;
    if (row.cliente_desde) {
      const dateValue = row.cliente_desde;
      // Se é um número (serial date do Excel)
      if (typeof dateValue === 'number') {
        // Excel data serial: número de dias desde 01/01/1900
        // Ajustar para o bug do Excel (ano 1900 não é bissexto)
        const excelEpoch = new Date(1899, 11, 30); // 30 de dezembro de 1899
        const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        clienteDesde = date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      } else if (typeof dateValue === 'string') {
        // Tentar converter string para data
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          clienteDesde = date.toISOString().split('T')[0];
        }
      }
    }

    // Validar setor
    const validSetores: Setor[] = ['PESSOAL', 'FISCAL', 'CONTABIL', 'PLANEJAMENTO'];
    let setor: Setor = 'CONTABIL'; // padrão

    if (row.setor && typeof row.setor === 'string') {
      const setorUpper = row.setor.toUpperCase() as Setor;
      if (validSetores.includes(setorUpper)) {
        setor = setorUpper;
      }
    }

    // Se não é master admin, forçar o setor do usuário
    if (!user?.isMasterAdmin && user?.setor && user.setor !== 'TODOS') {
      setor = user.setor as Setor;
    }

      return {
        name: String(nome).trim(),
        email,
        cpf: row.cnpj ? String(row.cnpj).trim() : undefined,
        classification: 'cliente' as const,
        created_by: undefined, // Will be set in the batch processing
      };
  };

  const processExcelFile = async () => {
    if (!file || !user) {
      toast({
        title: "Erro",
        description: "Arquivo não selecionado ou usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Converter para JSON, assumindo que a primeira linha são os cabeçalhos
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        toast({
          title: "Arquivo inválido",
          description: "O arquivo deve ter pelo menos uma linha de cabeçalho e uma linha de dados.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Assumir que a primeira linha são os cabeçalhos
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1);

      // Mapear cabeçalhos baseado na ordem específica do arquivo
      const headerMap: { [key: string]: string } = {};
      headers.forEach((header, index) => {
        const normalizedHeader = String(header).toLowerCase().trim();
        
        // Mapeamento baseado na ordem: Razão Social, CNPJ, Contato, Regime, Endereço, Número, Complemento, CEP, Bairro, Cidade, UF, Data de abertura, Ativa?, Apelido, Inscrições Estaduais, Empresa Isenta
        if (normalizedHeader.includes('razão social') || normalizedHeader.includes('razao social')) {
          headerMap[index] = 'razao_social';
        } else if (normalizedHeader.includes('cnpj')) {
          headerMap[index] = 'cnpj';
        } else if (normalizedHeader.includes('contato')) {
          headerMap[index] = 'contato'; // Will be processed as telefone or email
        } else if (normalizedHeader.includes('regime')) {
          headerMap[index] = 'regime_tributario';
        } else if (normalizedHeader.includes('endereço') || normalizedHeader.includes('endereco')) {
          headerMap[index] = 'endereco';
        } else if (normalizedHeader.includes('número') || normalizedHeader.includes('numero')) {
          headerMap[index] = 'numero';
        } else if (normalizedHeader.includes('complemento')) {
          headerMap[index] = 'complemento';
        } else if (normalizedHeader.includes('cep')) {
          headerMap[index] = 'cep';
        } else if (normalizedHeader.includes('bairro')) {
          headerMap[index] = 'bairro';
        } else if (normalizedHeader.includes('cidade')) {
          headerMap[index] = 'cidade';
        } else if (normalizedHeader.includes('uf') || normalizedHeader.includes('estado')) {
          headerMap[index] = 'estado';
        } else if (normalizedHeader.includes('data de abertura') || normalizedHeader.includes('abertura')) {
          headerMap[index] = 'cliente_desde';
        } else if (normalizedHeader.includes('ativa') || normalizedHeader.includes('ativo')) {
          headerMap[index] = 'situacao';
        } else if (normalizedHeader.includes('apelido')) {
          headerMap[index] = 'apelido';
        }
        // Ignorar Inscrições Estaduais e Empresa Isenta por enquanto
      });

      // Converter linhas para objetos
      const validRows: ImportData[] = [];
      const errors: string[] = [];

      rows.forEach((row: any[], rowIndex) => {
        const rowObj: any = {};
        row.forEach((cell, cellIndex) => {
          const fieldName = headerMap[cellIndex];
          if (fieldName) {
            rowObj[fieldName] = cell;
          }
        });

        const validatedRow = validateRowData(rowObj, rowIndex);
        if (validatedRow) {
          validRows.push(validatedRow);
        } else {
          errors.push(`Linha ${rowIndex + 2}: dados inválidos`);
        }
      });

      if (validRows.length === 0) {
        toast({
          title: "Nenhum dado válido",
          description: "Nenhuma linha válida foi encontrada no arquivo.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Inserir no banco de dados em lotes
      const batchSize = 10;
      let imported = 0;

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize).map(row => ({
          ...row,
          created_by: user.id,
        }));

        const { error } = await supabase
          .from('clients')
          .insert(batch);

        if (error) {
          console.error('Erro ao inserir lote:', error);
          console.error('Dados do lote com erro:', batch);
          errors.push(`Erro ao inserir lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          
          // Log detalhado de cada item do lote com erro
          batch.forEach((item, index) => {
            console.error(`Item ${index + 1} do lote com erro:`, item);
          });
        } else {
          imported += batch.length;
        }

        setProgress(Math.round(((i + batchSize) / validRows.length) * 100));
      }

      toast({
        title: "Importação concluída",
        description: `${imported} clientes importados com sucesso${errors.length > 0 ? `. ${errors.length} erros encontrados.` : '.'}`,
      });

      if (errors.length > 0) {
        console.warn('Erros durante importação:', errors);
        console.group('Detalhes dos Erros de Importação');
        errors.forEach((error, index) => {
          console.error(`Erro ${index + 1}:`, error);
        });
        console.groupEnd();
      }

      onImportComplete();
      setIsOpen(false);
      setFile(null);

    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : error);
      toast({
        title: "Erro",
        description: `Erro ao processar o arquivo Excel: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Clientes do Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Formatos aceitos: .xlsx, .xls</p>
            <p>Colunas da sua planilha: Endereço, Bairro, Número, CEP, Município, Estado, Situac, Cliente desde, Compl, Apelid, C.N.P.J./C.P.F./C.I.I./C.A.E.P.F., Razão Social</p>
            <p className="font-medium">A "Razão Social" será usada como nome do cliente.</p>
            {!user?.isMasterAdmin && user?.setor && user.setor !== 'TODOS' && (
              <p className="text-orange-600">
                Todos os clientes serão importados para o setor: {user.setor}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="excel-file">Selecionar arquivo</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={loading}
              />
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          {file && (
            <div className="text-sm text-muted-foreground">
              Arquivo selecionado: {file.name}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              <div className="text-sm">Processando arquivo...</div>
              <Progress value={progress} className="w-full" />
              <div className="text-xs text-muted-foreground">{progress}%</div>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={processExcelFile} disabled={!file || loading}>
              {loading ? 'Importando...' : 'Importar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}