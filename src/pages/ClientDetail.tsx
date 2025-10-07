import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, MouseEvent as ReactMouseEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Phone, Mail, MessageSquare, Calendar, FileText, DollarSign, Building, Upload, Download, X, MapPin, User, Eye, Trash2, CreditCard, Send, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/state/auth";
import { ProjectTimeline } from "@/components/projects/ProjectTimeline";
import { ClientProjectsTab } from "@/components/projects/ClientProjectsTab";
import { ClientBudgetsTab } from "@/components/client/ClientBudgetsTab";

interface Client {
  id: string;
  name: string;
  cpf: string;
  email: string;
  residential_address: string;
  construction_address: string;
  indication: string;
  birth_date: string;
  classification: string;
  created_at: string;
}

interface Contact {
  id: string;
  contact_type: string;
  subject: string;
  description: string;
  contact_date: string;
  created_at: string;
  created_by_profile?: {
    name: string;
  } | null;
}

interface Document {
  id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number;
  created_at: string;
  uploaded_by?: string;
  uploader_name?: string;
  // URLs preparadas para visualizar/baixar
  view_url?: string | null;
  download_url?: string | null;
}

interface Financial {
  id: string;
  transaction_type: string;
  description: string;
  amount: number;
  transaction_date: string;
  status: string;
  reference_document: string | null;
  payment_method?: string;
  created_at?: string;
}

type EmailSummarySections = {
  includeSummary: boolean;
  includePending: boolean;
  includeRecent: boolean;
};

interface Project {
  id: string;
  title: string;
  description: string;
  address: string;
  status: string;
  contracted_hours: number;
  contracted_value: number;
  executed_hours: number;
  visits_count: number;
  meetings_count: number;
  created_at: string;
  updated_at: string;
}

interface ProjectDocument {
  id: string;
  project_id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

interface ProjectPhase {
  id: string;
  project_id: string;
  phase_name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  estimated_hours: number;
  executed_hours: number;
  order_index: number;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  // Verificar se o usuário atual é "Mara" para acesso à aba financeiro
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const canAccessFinancial = currentUserProfile?.name === 'Mara';

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [financials, setFinancials] = useState<Financial[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isDeleteDocumentDialogOpen, setIsDeleteDocumentDialogOpen] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('contatos');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [selectedProjectForTimeline, setSelectedProjectForTimeline] = useState<Project | null>(null);
  const [openFinancialGroups, setOpenFinancialGroups] = useState<Record<string, boolean>>({});

  // Estados para novos itens
  const [newContact, setNewContact] = useState({
    type: '',
    subject: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [newFinancial, setNewFinancial] = useState({
    type: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    reference: '',
    payment_method: '',
    isInstallment: false,
    installmentCount: '1',
  });

  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to: '',
    cc: '',
    subject: '',
    message: '',
    includeSummary: true,
    includePending: true,
    includeRecent: true,
  });

  useEffect(() => {
    if (!id) return;
    loadClientData();
    loadUserProfile();
  }, [id, user?.id]);

  const loadUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      setCurrentUserProfile(profileData);
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
    }
  };


  const fetchClientDocuments = useCallback(async () => {
    if (!id) return;


    const { data: documentsData, error: documentsError } = await supabase
      .from('client_documents')
      .select('id, client_id, document_name, document_type, file_path, file_size, created_at, uploaded_by')
      .eq('client_id', id)
      .order('created_at', { ascending: false });
    if (documentsError) throw documentsError;

    const uploaderIds = [...new Set(documentsData?.map(d => d.uploaded_by).filter(Boolean) || [])];
    let uploaderProfiles: { user_id: string; name: string }[] = [];

    if (uploaderIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', uploaderIds);

      if (profilesError) throw profilesError;
      uploaderProfiles = profilesData;
    }

    const uploaderProfilesMap = new Map(uploaderProfiles.map((p) => [p.user_id, p.name]));

    const docsWithUploader: Document[] = (documentsData || []).map((doc: any) => ({
      ...doc,
      uploader_name: uploaderProfilesMap.get(doc.uploaded_by) || 'Usuário desconhecido',
    }));

    const docsWithUrls: Document[] = await Promise.all(
      docsWithUploader.map(async (doc) => {
        try {
          const { data: signed, error: signedError } = await supabase
            .storage
            .from('client-documents')
            .createSignedUrl(doc.file_path, 60 * 60, { download: doc.document_name });

          if (signedError) throw signedError;
          return { ...doc, view_url: signed?.signedUrl, download_url: signed?.signedUrl };
        } catch (e) {
          const { data: pub } = supabase.storage.from('client-documents').getPublicUrl(doc.file_path);
          return { ...doc, view_url: pub?.publicUrl || null, download_url: pub?.publicUrl || null };
        }
      })
    );

    setDocuments(docsWithUrls);


  }, [id]);

  const loadClientData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1) Cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();
      if (clientError) throw clientError;
      setClient(clientData);

      // 2) Contatos com nome de quem registrou (excluindo mensagens automáticas do chat)
      const { data: contactsData } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', id)
        .not('subject', 'ilike', '%Mensagem%via WhatsApp%')
        .order('contact_date', { ascending: false });

      const createdByIds = [...new Set(contactsData?.map(c => c.created_by).filter(Boolean) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', createdByIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.name]) || []);
      const processedContacts: Contact[] = (contactsData || []).map((contact: any) => ({
        ...contact,
        created_by_profile: contact.created_by ? { name: profilesMap.get(contact.created_by) || 'Usuário desconhecido' } : null,
      }));
      setContacts(processedContacts);

      // 3) Documentos do cliente (agora com URLs para visualizar/baixar)
      await fetchClientDocuments();

      // 4) Financeiro
      const { data: financialsData } = await supabase
        .from('client_financials')
        .select('*')
        .eq('client_id', id)
        .order('transaction_date', { ascending: false });
      setFinancials(financialsData || []);

      // 5) Projetos
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });
      setProjects(projectsData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar os dados do cliente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!id || !user || !newContact.type || !newContact.subject) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    try {
      const localDate = new Date(newContact.date + 'T12:00:00');
      const formattedDate = localDate.toISOString().split('T')[0];
      const { error } = await supabase.from('client_contacts').insert({
        client_id: id,
        contact_type: newContact.type,
        subject: newContact.subject,
        description: newContact.description,
        contact_date: formattedDate,
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Contato adicionado com sucesso!' });
      setNewContact({ type: '', subject: '', description: '', date: new Date().toISOString().split('T')[0] });
      loadClientData();
    } catch (error) {
      console.error('Erro ao adicionar contato:', error);
      toast({ title: 'Erro', description: 'Não foi possível adicionar o contato.', variant: 'destructive' });
    }
  };

  const handleAddFinancial = async () => {
    if (!id || !user || !newFinancial.type || !newFinancial.description || !newFinancial.amount) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    const amountValue = Number.parseFloat(newFinancial.amount);
    if (!Number.isFinite(amountValue)) {
      toast({ title: 'Erro', description: 'Informe um valor válido para a transação.', variant: 'destructive' });
      return;
    }

    const installmentCount = newFinancial.isInstallment
      ? Number.parseInt(newFinancial.installmentCount, 10)
      : 1;

    if (newFinancial.isInstallment && (!Number.isFinite(installmentCount) || installmentCount < 1)) {
      toast({ title: 'Erro', description: 'Informe um número válido de parcelas.', variant: 'destructive' });
      return;
    }

    try {
      const localDate = new Date(newFinancial.date + 'T12:00:00');
      if (Number.isNaN(localDate.getTime())) {
        toast({ title: 'Erro', description: 'Informe uma data válida para a transação.', variant: 'destructive' });
        return;
      }

      const formattedDate = localDate.toISOString().split('T')[0];
      const entries: {
        client_id: string;
        transaction_type: string;
        description: string;
        amount: number;
        transaction_date: string;
        status: string;
        reference_document: string;
        payment_method: string;
        created_by: string;
      }[] = [];

      if (newFinancial.isInstallment && installmentCount > 1) {
        const totalInCents = Math.round(amountValue * 100);
        const baseAmountInCents = Math.floor(totalInCents / installmentCount);
        const remainder = totalInCents % installmentCount;

        for (let index = 0; index < installmentCount; index += 1) {
          const amountInCents = baseAmountInCents + (index < remainder ? 1 : 0);
          const dueDate = new Date(localDate);
          dueDate.setMonth(dueDate.getMonth() + index);

          entries.push({
            client_id: id,
            transaction_type: newFinancial.type,
            description: newFinancial.description,
            amount: amountInCents / 100,
            transaction_date: dueDate.toISOString().split('T')[0],
            status: newFinancial.status,
            reference_document: newFinancial.reference,
            payment_method: newFinancial.payment_method,
            created_by: user.id,
          });
        }
      } else {
        entries.push({
          client_id: id,
          transaction_type: newFinancial.type,
          description: newFinancial.description,
          amount: amountValue,
          transaction_date: formattedDate,
          status: newFinancial.status,
          reference_document: newFinancial.reference,
          payment_method: newFinancial.payment_method,
          created_by: user.id,
        });
      }

      const { error } = await supabase.from('client_financials').insert(entries);
      if (error) throw error;

      toast({
        title: 'Sucesso',
        description:
          newFinancial.isInstallment && installmentCount > 1
            ? `${installmentCount} parcelas criadas com sucesso!`
            : 'Transação adicionada com sucesso!',
      });

      setNewFinancial({
        type: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        reference: '',
        payment_method: '',
        isInstallment: false,
        installmentCount: '1',
      });
      loadClientData();
    } catch (error) {
      console.error('Erro ao adicionar transação:', error);
      toast({ title: 'Erro', description: 'Não foi possível adicionar a transação.', variant: 'destructive' });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id || !user) return;
    try {
      // Sanitizar nome
      const sanitizedFileName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();

      const fileName = `${id}/${Date.now()}-${sanitizedFileName}`;
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('client-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'application/octet-stream',
        });
      if (storageError) throw storageError;

      const { error: insertError } = await supabase.from('client_documents').insert({
        client_id: id,
        document_name: file.name,
        document_type: file.type || 'application/octet-stream',
        file_path: storageData.path,
        file_size: file.size,
        uploaded_by: user.id,
      });
      if (insertError) throw insertError;

      toast({ title: 'Sucesso', description: 'Documento anexado com sucesso!' });
      event.target.value = '';
      loadClientData();
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast({ title: 'Erro', description: `Não foi possível enviar o documento: ${error?.message || 'Erro desconhecido'}`, variant: 'destructive' });
    }
  };

  const handlePreviewDocument = async (doc: Document) => {
    try {
      // Gera um link atualizado para evitar expiração
      const { data: signed } = await supabase
        .storage
        .from('client-documents')
        .createSignedUrl(doc.file_path, 10 * 60); // 10 min
      const url = signed?.signedUrl || doc.view_url;
      if (!url) throw new Error('URL não disponível');
      window.open(url, '_blank');
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível abrir o documento.', variant: 'destructive' });
    }
  };

  const handleDownloadDocument = async (doc: Document) => {
    try {
      const { data, error } = await supabase
        .storage
        .from('client-documents')
        .download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name || 'documento';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível baixar o documento.', variant: 'destructive' });
    }
  };

  const openDeleteDocumentDialog = (doc: Document) => {
    setDocumentToDelete(doc);
    setIsDeleteDocumentDialogOpen(true);
  };

  const handleDeleteDocumentDialogChange = (open: boolean) => {
    setIsDeleteDocumentDialogOpen(open);
    if (!open) {
      setDocumentToDelete(null);
      setIsDeletingDocument(false);
    }
  };

  const handleDeleteDocument = async () => {
    const doc = documentToDelete;
    if (!doc) return;

    setIsDeletingDocument(true);
    try {
      if (documentToDelete.file_path) {
        const { error: storageError } = await supabase
          .storage
          .from('client-documents')
          .remove([documentToDelete.file_path]);

        if (storageError && storageError.message && storageError.message.toLowerCase().includes('not found')) {
          console.warn('Arquivo não encontrado no storage, prosseguindo com exclusão do registro.');
        } else if (storageError) {
          throw storageError;
        }
      }

      const { error: dbError } = await supabase
        .from('client_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      // Atualiza estado imediatamente para feedback visual rápido
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));

      toast({ title: 'Documento excluído', description: 'O documento foi removido com sucesso.' });

      setIsDeleteDocumentDialogOpen(false);
      setDocumentToDelete(null);

      // Recarrega lista completa do servidor para garantir sincronização
      try {
        await fetchClientDocuments();
      } catch (fetchError) {
        console.error('Erro ao recarregar documentos após exclusão:', fetchError);
        // Não exibe erro ao usuário pois a exclusão foi bem-sucedida
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro', description: 'Não foi possível excluir o documento.', variant: 'destructive' });
    } finally {
      setIsDeletingDocument(false);
    }
  };

  const getContactIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4" />;
      case 'meeting':
        return <Calendar className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'bg-status-completed text-status-completed-foreground',
      pending: 'bg-status-pending text-status-pending-foreground',
      cancelled: 'bg-destructive text-destructive-foreground',
    } as const;
    return (variants as any)[status] || 'bg-muted text-muted-foreground';
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      pix: 'PIX',
      ted: 'TED',
      doc: 'DOC',
      dinheiro: 'Dinheiro',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      boleto: 'Boleto',
      cheque: 'Cheque',
      outros: 'Outros'
    } as const;
    return (labels as any)[method] || method;
  };

  const formatReferenceDocument = (reference?: string | null) => {
    if (!reference) return null;

    try {
      const parsed = JSON.parse(reference) as Record<string, unknown> | null;

      if (parsed && typeof parsed === 'object') {
        const { source } = parsed;

        if (source === 'budget_approval') {
          const details: string[] = [];

          const installmentNumberRaw = parsed.installmentNumber;
          const totalInstallmentsRaw = parsed.totalInstallments;

          const installmentNumber =
            typeof installmentNumberRaw === 'number'
              ? installmentNumberRaw
              : Number.parseInt(String(installmentNumberRaw ?? ''), 10);
          const totalInstallments =
            typeof totalInstallmentsRaw === 'number'
              ? totalInstallmentsRaw
              : Number.parseInt(String(totalInstallmentsRaw ?? ''), 10);

          if (
            Number.isFinite(installmentNumber) &&
            installmentNumber > 0 &&
            Number.isFinite(totalInstallments) &&
            totalInstallments > 0
          ) {
            details.push(`Parcela ${installmentNumber}/${totalInstallments}`);
          }

          const approvedAt = parsed.approvedAt;
          if (typeof approvedAt === 'string') {
            const approvedDate = new Date(approvedAt);
            if (!Number.isNaN(approvedDate.getTime())) {
              details.push(`Aprovado em ${approvedDate.toLocaleDateString('pt-BR')}`);
            }
          }

          const notes = typeof parsed.notes === 'string' ? parsed.notes.trim() : '';
          if (notes) {
            details.push(notes);
          }

          if (details.length === 0) {
            return 'Aprovação de orçamento';
          }

          return `Aprovação de orçamento • ${details.join(' • ')}`;
        }
      }
    } catch (error) {
      // Se não for um JSON válido, retorna o valor original
    }

    return reference;
  };

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  );
  const formatMoney = useCallback((amount: number) => currencyFormatter.format(amount), [currencyFormatter]);
  const formatSize = (bytes?: number) => {
    if (!bytes && bytes !== 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDateToBR = (value?: string | null) => {
    if (!value) return 'Sem data';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sem data';
    return parsed.toLocaleDateString('pt-BR');
  };

  const installmentPreview = useMemo(() => {
    if (!newFinancial.isInstallment) return null;

    const amountValue = Number.parseFloat(newFinancial.amount);
    const count = Number.parseInt(newFinancial.installmentCount, 10);

    if (!Number.isFinite(amountValue) || amountValue <= 0 || !Number.isFinite(count) || count < 2) {
      return null;
    }

    const averageAmount = amountValue / count;

    let firstDate: Date | null = null;
    let lastDate: Date | null = null;

    if (newFinancial.date) {
      const baseDate = new Date(`${newFinancial.date}T12:00:00`);
      if (!Number.isNaN(baseDate.getTime())) {
        firstDate = new Date(baseDate);
        lastDate = new Date(baseDate);
        lastDate.setMonth(lastDate.getMonth() + (count - 1));
      }
    }

    return {
      count,
      averageAmount,
      firstDate,
      lastDate,
    } as const;
  }, [newFinancial]);

  const totalIncome = useMemo(
    () =>
      financials
        .filter((f) => f.transaction_type === 'income' || f.transaction_type === 'payment_received')
        .reduce((acc, f) => acc + (f.amount || 0), 0),
    [financials]
  );

  const totalExpenses = useMemo(
    () =>
      financials
        .filter((f) => f.transaction_type === 'expense' || f.transaction_type === 'payment_sent')
        .reduce((acc, f) => acc + (f.amount || 0), 0),
    [financials]
  );

  const netBalance = useMemo(() => totalIncome - totalExpenses, [totalIncome, totalExpenses]);

  const pendingTransactions = useMemo(
    () => financials.filter((f) => (f.status || '').toLowerCase() !== 'completed'),
    [financials]
  );

  const totalPendingAmount = useMemo(
    () => pendingTransactions.reduce((acc, f) => acc + (f.amount || 0), 0),
    [pendingTransactions]
  );

  const upcomingPendings = useMemo(() => {
    const withDate = pendingTransactions.filter((item) => item.transaction_date);
    const sorted = [...withDate].sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    return sorted.slice(0, 3);
  }, [pendingTransactions]);

  const recentTransactions = useMemo(() => {
    const sorted = [...financials].sort(
      (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
    );
    return sorted.slice(0, 5);
  }, [financials]);

  const getFinancialStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      completed: 'Concluído',
      pending: 'Pendente',
      cancelled: 'Cancelado',
    };
    return labels[status?.toLowerCase?.()] || status || '—';
  };

  const composeEmailSummary = useCallback(
    (sections: EmailSummarySections) => {
      const lines: string[] = [];
      const firstName = client?.name?.split(' ')[0] || client?.name || 'cliente';

      lines.push(`Olá ${firstName},`);
      lines.push('');

      if (sections.includeSummary) {
        lines.push('Segue o resumo financeiro atualizado:');
        lines.push(`• Receitas registradas: ${formatMoney(totalIncome)}`);
        lines.push(`• Despesas registradas: ${formatMoney(totalExpenses)}`);
        lines.push(`• Saldo atual: ${formatMoney(netBalance)}`);
        lines.push('');
      }

      if (sections.includePending) {
        if (pendingTransactions.length > 0) {
          lines.push(
            `Pendências financeiras: ${formatMoney(totalPendingAmount)} em ${pendingTransactions.length} ${
              pendingTransactions.length === 1 ? 'lançamento' : 'lançamentos'
            }.`
          );

          const highlightPendings = upcomingPendings.length > 0
            ? upcomingPendings
            : pendingTransactions.slice(0, 3);

          highlightPendings.forEach((item) => {
            lines.push(
              `• ${item.description || 'Lançamento'} - ${formatMoney(item.amount)} (${formatDateToBR(
                item.transaction_date
              )})`
            );
          });
        } else {
          lines.push('Não encontramos pendências financeiras no momento.');
        }
        lines.push('');
      }

      if (sections.includeRecent && recentTransactions.length > 0) {
        lines.push('Últimos lançamentos registrados:');
        recentTransactions.forEach((item) => {
          lines.push(
            `• ${formatDateToBR(item.transaction_date)} - ${item.description || 'Lançamento'} (${formatMoney(
              item.amount
            )}) - ${getFinancialStatusLabel(item.status)}`
          );
        });
        lines.push('');
      }

      lines.push('Se precisar de qualquer ajuste ou esclarecimento, é só responder este email.');
      lines.push('');
      lines.push('Atenciosamente,');
      lines.push('Equipe Financeira');

      return lines.join('\n');
    },
    [
      client,
      formatMoney,
      netBalance,
      pendingTransactions,
      recentTransactions,
      totalExpenses,
      totalIncome,
      totalPendingAmount,
      upcomingPendings,
    ]
  );

  const emailSummaryPreview = useMemo(
    () =>
      composeEmailSummary({
        includeSummary: emailForm.includeSummary,
        includePending: emailForm.includePending,
        includeRecent: emailForm.includeRecent,
      }),
    [composeEmailSummary, emailForm.includePending, emailForm.includeRecent, emailForm.includeSummary]
  );

  useEffect(() => {
    if (!isEmailDialogOpen) return;

    setEmailForm((prev) => {
      const nextTo = prev.to || client?.email || '';
      const nextSubject = prev.subject || (client ? `Resumo Financeiro - ${client.name}` : 'Resumo Financeiro');
      const nextMessage =
        prev.message ||
        composeEmailSummary({
          includeSummary: prev.includeSummary,
          includePending: prev.includePending,
          includeRecent: prev.includeRecent,
        });

      if (prev.to === nextTo && prev.subject === nextSubject && prev.message === nextMessage) {
        return prev;
      }

      return {
        ...prev,
        to: nextTo,
        subject: nextSubject,
        message: nextMessage,
      };
    });
  }, [client, composeEmailSummary, isEmailDialogOpen]);

  const handleToggleEmailSection = useCallback(
    (key: keyof EmailSummarySections) => (checked: boolean) => {
      setEmailForm((prev) => {
        const updatedSections: EmailSummarySections = {
          includeSummary: key === 'includeSummary' ? checked : prev.includeSummary,
          includePending: key === 'includePending' ? checked : prev.includePending,
          includeRecent: key === 'includeRecent' ? checked : prev.includeRecent,
        };

        const next = {
          ...prev,
          ...updatedSections,
        } as typeof prev;

        if (!prev.message.trim()) {
          next.message = composeEmailSummary(updatedSections);
        }

        return next;
      });
    },
    [composeEmailSummary]
  );

  const handleUseSuggestedMessage = useCallback(() => {
    setEmailForm((prev) => ({
      ...prev,
      message: emailSummaryPreview,
    }));
  }, [emailSummaryPreview]);

  const handleSendEmail = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSendingEmail(true);

      const highlightPendings = upcomingPendings.length > 0 ? upcomingPendings : pendingTransactions.slice(0, 3);

      const payload = {
        to: emailForm.to,
        cc: emailForm.cc,
        subject: emailForm.subject,
        message: emailForm.message,
        autoSummary: emailSummaryPreview,
        sections: {
          includeSummary: emailForm.includeSummary,
          includePending: emailForm.includePending,
          includeRecent: emailForm.includeRecent,
        },
        totals: {
          income: totalIncome,
          expenses: totalExpenses,
          balance: netBalance,
          pendingAmount: totalPendingAmount,
        },
        pending: highlightPendings.map((item) => ({
          id: item.id,
          description: item.description,
          amount: item.amount,
          transaction_date: item.transaction_date,
          status: item.status,
        })),
        recent: recentTransactions.map((item) => ({
          id: item.id,
          description: item.description,
          amount: item.amount,
          transaction_date: item.transaction_date,
          status: item.status,
        })),
      };

      console.log('[FinanceEmailPreview]', payload);

      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        toast({
          title: 'Resumo preparado',
          description:
            'Os dados financeiros foram compilados. A integração com o serviço de email será conectada em breve.',
        });
        setIsEmailDialogOpen(false);
      } finally {
        setIsSendingEmail(false);
      }
    },
    [
      emailForm,
      emailSummaryPreview,
      netBalance,
      pendingTransactions,
      recentTransactions,
      setIsEmailDialogOpen,
      toast,
      totalExpenses,
      totalIncome,
      totalPendingAmount,
      upcomingPendings,
    ]
  );

  const isEmailFormValid = emailForm.to.trim().length > 0 && emailForm.subject.trim().length > 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p>Carregando dados do cliente...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente não encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/clients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Clientes
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="btn-hero-static rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
                {client.name}
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm text-white/80">
                {client.cpf && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">CPF:</span>
                    <span>{client.cpf}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{client.email}</span>
                  </div>
                )}
                {client.residential_address && (
                  <div className="flex items-start gap-2 md:col-span-1">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="leading-relaxed">{client.residential_address}</span>
                  </div>
                )}
                {client.construction_address && (
                  <div className="flex items-start gap-2 md:col-span-1">
                    <Building className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="leading-relaxed">{client.construction_address}</span>
                  </div>
                )}
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="hover:bg-white/20 p-2 rounded-full">
              <Link to="/clients">
                <X className="h-20 w-20 text-white" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Informações básicas do cliente */}
      <Card></Card>

      {/* Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${
          !canAccessFinancial ? 'grid-cols-4' : 
          user?.role === 'supervisor' ? 'grid-cols-4' : 'grid-cols-5'
        }`}>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          {canAccessFinancial && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
          <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
        </TabsList>

        {/* Aba Contatos */}
        <TabsContent value="contatos" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Histórico de Contatos
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {contacts.length} {contacts.length === 1 ? 'contato registrado' : 'contatos registrados'}
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo Contato
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Contato</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tipo de Contato</Label>
                      <Select value={newContact.type} onValueChange={(value) => setNewContact({ ...newContact, type: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">Ligação</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="meeting">Reunião</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assunto</Label>
                      <Input value={newContact.subject} onChange={(e) => setNewContact({ ...newContact, subject: e.target.value })} placeholder="Assunto do contato" />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea value={newContact.description} onChange={(e) => setNewContact({ ...newContact, description: e.target.value })} placeholder="Detalhes do contato" />
                    </div>
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input type="date" value={newContact.date} onChange={(e) => setNewContact({ ...newContact, date: e.target.value })} />
                    </div>
                    <Button onClick={handleAddContact} className="w-full">Adicionar Contato</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {contacts.length > 0 ? (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="group relative bg-gradient-to-r from-card to-muted/30 border border-border/50 rounded-xl p-5 hover:shadow-md transition-all duration-300 hover:border-primary/20">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-primary/60 rounded-l-xl opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <div className="text-primary">{getContactIcon(contact.contact_type)}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors">{contact.subject}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs px-2 py-1">
                                  {contact.contact_type === 'call' && 'Ligação'}
                                  {contact.contact_type === 'email' && 'Email'}
                                  {contact.contact_type === 'whatsapp' && 'WhatsApp'}
                                  {contact.contact_type === 'meeting' && 'Reunião'}
                                  {contact.contact_type === 'other' && 'Outro'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(contact.contact_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <div className="text-sm font-medium">
                                {new Date(contact.contact_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(contact.contact_date).toLocaleDateString('pt-BR', { year: 'numeric' })}
                              </div>
                            </div>
                          </div>
                          {contact.description && (
                            <div className="mt-3 p-3 bg-muted/30 rounded-lg border-l-2 border-primary/30">
                              <p className="text-sm text-foreground/80 leading-relaxed">{contact.description}</p>
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                            <div className="text-xs text-muted-foreground">
                              Registrado em {new Date(contact.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} por "{contact.created_by_profile?.name || 'Usuário desconhecido'}"
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">Nenhum contato registrado</h3>
                  <p className="text-muted-foreground mb-4">Comece registrando o primeiro contato com este cliente.</p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Registrar Primeiro Contato
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Contato</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Tipo de Contato</Label>
                          <Select value={newContact.type} onValueChange={(value) => setNewContact({ ...newContact, type: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="call">Ligação</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="meeting">Reunião</SelectItem>
                              <SelectItem value="other">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Assunto</Label>
                          <Input value={newContact.subject} onChange={(e) => setNewContact({ ...newContact, subject: e.target.value })} placeholder="Assunto do contato" />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Textarea value={newContact.description} onChange={(e) => setNewContact({ ...newContact, description: e.target.value })} placeholder="Detalhes do contato" />
                        </div>
                        <div className="space-y-2">
                          <Label>Data</Label>
                          <Input type="date" value={newContact.date} onChange={(e) => setNewContact({ ...newContact, date: e.target.value })} />
                        </div>
                        <Button onClick={handleAddContact} className="w-full">Adicionar Contato</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Documentos */}
        <TabsContent value="documentos" className="space-y-6">
          <Card className="border-2 border-border/50 bg-gradient-to-br from-background to-background/80">
            <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b border-border/50">
              <div className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Documentos</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {documents.length} {documents.length === 1 ? 'documento' : 'documentos'} anexado{documents.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="relative group">
                  <Input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200">
                    <Upload className="mr-2 h-4 w-4" />
                    Enviar Documento
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="group relative border-2 border-border/50 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-card to-muted/20">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 pr-12">
                            {doc.document_name}
                          </h4>
                        </div>
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>{formatSize(doc.file_size)}</span>
                            <span className="uppercase">{doc.document_type?.split('/')?.pop() || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(doc.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Por: {doc.uploader_name}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
                          <Button variant="outline" size="sm" className="w-full hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200" onClick={() => handleDownloadDocument(doc)}>
                            <Download className="h-4 w-4 mr-2" />
                            Baixar
                          </Button>
                          <Button variant="secondary" size="sm" className="w-full" onClick={() => handlePreviewDocument(doc)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver
                          </Button>
                          <Button variant="destructive" size="sm" className="w-full" onClick={() => openDeleteDocumentDialog(doc)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950 dark:to-indigo-950 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Nenhum documento anexado</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">Comece enviando o primeiro documento para este cliente. Formatos aceitos: PDF, DOC, DOCX, JPG, PNG.</p>
                  <div className="relative inline-block">
                    <Input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <Upload className="mr-2 h-4 w-4" />
                      Enviar Primeiro Documento
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Financeiro */}
        <TabsContent value="financeiro" className="space-y-6">
          <Card className="border-2 border-border/50 bg-gradient-to-br from-background to-background/80">
            <CardHeader className="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-b border-border/50">
              <div className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                    <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Financeiro</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {financials.length} {financials.length === 1 ? 'transação' : 'transações'} registrada{financials.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all duration-200">
                        <Plus className="mr-2 h-4 w-4" />
                        Nova Transação
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Transação</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select value={newFinancial.type} onValueChange={(value) => setNewFinancial({ ...newFinancial, type: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="payment_received">Pagamento Recebido</SelectItem>
                              <SelectItem value="payment_sent">Pagamento Enviado</SelectItem>
                              <SelectItem value="income">Receita</SelectItem>
                              <SelectItem value="expense">Despesa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Input value={newFinancial.description} onChange={(e) => setNewFinancial({ ...newFinancial, description: e.target.value })} placeholder="Descrição da transação" />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor</Label>
                          <Input type="number" step="0.01" value={newFinancial.amount} onChange={(e) => setNewFinancial({ ...newFinancial, amount: e.target.value })} placeholder="0,00" />
                        </div>
                        <div className="space-y-2">
                          <Label>Data</Label>
                          <Input type="date" value={newFinancial.date} onChange={(e) => setNewFinancial({ ...newFinancial, date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={newFinancial.status} onValueChange={(value) => setNewFinancial({ ...newFinancial, status: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="completed">Concluído</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Forma de Pagamento</Label>
                          <Select value={newFinancial.payment_method} onValueChange={(value) => setNewFinancial({ ...newFinancial, payment_method: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a forma de pagamento" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="ted">TED</SelectItem>
                              <SelectItem value="doc">DOC</SelectItem>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                              <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                              <SelectItem value="boleto">Boleto</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                              <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="rounded-lg border bg-muted/50 p-3 flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">Pagamento parcelado</p>
                            <p className="text-xs text-muted-foreground">
                              Habilite para dividir o valor em parcelas mensais automaticamente.
                            </p>
                          </div>
                          <Switch
                            checked={newFinancial.isInstallment}
                            onCheckedChange={(checked) =>
                              setNewFinancial((prev) => {
                                const parsed = Number.parseInt(prev.installmentCount, 10);
                                return {
                                  ...prev,
                                  isInstallment: checked,
                                  installmentCount:
                                    checked && (!Number.isFinite(parsed) || parsed < 2)
                                      ? '2'
                                      : checked
                                        ? prev.installmentCount
                                        : '1',
                                };
                              })
                            }
                          />
                        </div>
                        {newFinancial.isInstallment && (
                          <div className="space-y-2">
                            <Label>Número de Parcelas</Label>
                            <Input
                              type="number"
                              min={1}
                              value={newFinancial.installmentCount}
                              onChange={(event) =>
                                setNewFinancial((prev) => ({
                                  ...prev,
                                  installmentCount: event.target.value,
                                }))
                              }
                              placeholder="2"
                            />
                          </div>
                        )}
                        {newFinancial.isInstallment && installmentPreview && (
                          <div className="text-xs text-muted-foreground rounded-md border bg-muted/40 p-3 space-y-1">
                            <p>
                              Serão criadas{' '}
                              <span className="font-medium text-foreground">{installmentPreview.count} parcelas</span>{' '}
                              com valor médio de{' '}
                              <span className="font-medium text-foreground">
                                {formatMoney(installmentPreview.averageAmount)}
                              </span>
                              .
                            </p>
                            {installmentPreview.firstDate && installmentPreview.lastDate && (
                              <p>
                                Vencimentos de {installmentPreview.firstDate.toLocaleDateString('pt-BR')} até{' '}
                                {installmentPreview.lastDate.toLocaleDateString('pt-BR')}.
                              </p>
                            )}
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Referência</Label>
                          <Input value={newFinancial.reference} onChange={(e) => setNewFinancial({ ...newFinancial, reference: e.target.value })} placeholder="Ex: PIX-001, TED-002" />
                        </div>
                        <Button onClick={handleAddFinancial} className="w-full">Adicionar Transação</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-green-200 text-green-700 hover:bg-green-100/80 dark:border-green-900 dark:text-green-300 dark:hover:bg-green-900/40"
                      >
                        <Mail className="h-4 w-4" />
                        Enviar resumo por email
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Enviar dados financeiros por email</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSendEmail} className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="email-to">Destinatário</Label>
                            <Input
                              id="email-to"
                              type="email"
                              value={emailForm.to}
                              onChange={(event) => setEmailForm((prev) => ({ ...prev, to: event.target.value }))}
                              placeholder="cliente@empresa.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email-cc">Cópia (CC)</Label>
                            <Input
                              id="email-cc"
                              value={emailForm.cc}
                              onChange={(event) => setEmailForm((prev) => ({ ...prev, cc: event.target.value }))}
                              placeholder="financeiro@empresa.com"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email-subject">Assunto</Label>
                          <Input
                            id="email-subject"
                            value={emailForm.subject}
                            onChange={(event) => setEmailForm((prev) => ({ ...prev, subject: event.target.value }))}
                            placeholder="Resumo Financeiro - Nome do Cliente"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email-message">Mensagem personalizada</Label>
                          <Textarea
                            id="email-message"
                            rows={6}
                            value={emailForm.message}
                            onChange={(event) => setEmailForm((prev) => ({ ...prev, message: event.target.value }))}
                            placeholder="Inclua orientações adicionais antes de enviar ao cliente."
                          />
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Button type="button" variant="outline" size="sm" onClick={handleUseSuggestedMessage}>
                              Usar resumo sugerido
                            </Button>
                            <span>Você pode ajustar o texto conforme necessário.</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label>Seções do resumo automático</Label>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="flex items-start gap-3 rounded-lg border border-green-100/80 bg-green-50/40 p-4 dark:border-green-900/50 dark:bg-green-950/20">
                              <Switch checked={emailForm.includeSummary} onCheckedChange={handleToggleEmailSection('includeSummary')} />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">Resumo geral</p>
                                <p className="text-xs text-muted-foreground">Receitas, despesas e saldo atual.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-lg border border-green-100/80 bg-green-50/40 p-4 dark:border-green-900/50 dark:bg-green-950/20">
                              <Switch checked={emailForm.includePending} onCheckedChange={handleToggleEmailSection('includePending')} />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">Pendências</p>
                                <p className="text-xs text-muted-foreground">Parcelas em aberto e valores previstos.</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-lg border border-green-100/80 bg-green-50/40 p-4 dark:border-green-900/50 dark:bg-green-950/20">
                              <Switch checked={emailForm.includeRecent} onCheckedChange={handleToggleEmailSection('includeRecent')} />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">Últimos lançamentos</p>
                                <p className="text-xs text-muted-foreground">Movimentações mais recentes registradas.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Resumo sugerido</Label>
                          <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{emailSummaryPreview}</pre>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label>Dados que serão destacados</Label>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Receitas</p>
                              <p className="text-lg font-semibold text-green-600 dark:text-green-300">{formatMoney(totalIncome)}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Despesas</p>
                              <p className="text-lg font-semibold text-red-600 dark:text-red-300">{formatMoney(totalExpenses)}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo atual</p>
                              <p className="text-lg font-semibold">
                                <span className={netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
                                  {formatMoney(netBalance)}
                                </span>
                              </p>
                            </div>
                            <div className="rounded-lg border border-border/60 bg-background p-4 shadow-sm">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pendências</p>
                              <p className="text-lg font-semibold text-amber-600 dark:text-amber-300">{formatMoney(totalPendingAmount)}</p>
                              <p className="text-xs text-muted-foreground mt-1">{pendingTransactions.length} {pendingTransactions.length === 1 ? 'lançamento' : 'lançamentos'}</p>
                            </div>
                          </div>

                          {pendingTransactions.length > 0 && (
                            <div className="rounded-lg border border-border/60 bg-background p-4 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium">Principais pendências</p>
                                  <p className="text-xs text-muted-foreground">Essas informações serão destacadas no email.</p>
                                </div>
                                <Badge variant="outline" className="text-xs font-medium">{formatMoney(totalPendingAmount)}</Badge>
                              </div>
                              <div className="space-y-2">
                                {(upcomingPendings.length > 0 ? upcomingPendings : pendingTransactions.slice(0, 3)).map((item) => (
                                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/30 p-3">
                                    <div>
                                      <p className="text-sm font-medium">{item.description || 'Lançamento'}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatDateToBR(item.transaction_date)} · {getFinancialStatusLabel(item.status)}
                                      </p>
                                    </div>
                                    <Badge variant="secondary" className="text-xs font-semibold">
                                      {formatMoney(item.amount)}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {recentTransactions.length > 0 && (
                            <div className="rounded-lg border border-border/60 bg-background p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">Últimos lançamentos</p>
                                <Badge variant="outline" className="text-xs font-medium">{recentTransactions.length} registro{recentTransactions.length === 1 ? '' : 's'}</Badge>
                              </div>
                              <div className="space-y-2">
                                {recentTransactions.map((item) => (
                                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-border/50 p-3">
                                    <div>
                                      <p className="text-sm font-medium">{item.description || 'Lançamento'}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatDateToBR(item.transaction_date)} · {getFinancialStatusLabel(item.status)}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs font-semibold">
                                      {formatMoney(item.amount)}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 border-t border-border/60 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                          <span>O envio será integrado a um serviço de email em breve. Esta ação apenas prepara o conteúdo.</span>
                          <Button type="submit" className="gap-2" disabled={!isEmailFormValid || isSendingEmail}>
                            <Send className="h-4 w-4" />
                            {isSendingEmail ? 'Preparando...' : 'Preparar envio'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {financials.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-full">
                          <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">Receitas</p>
                          <p className="text-xl font-bold text-green-800 dark:text-green-200">
                            {formatMoney(financials.filter(f => f.transaction_type === 'income' || f.transaction_type === 'payment_received').reduce((acc, f) => acc + f.amount, 0))}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-red-50/80 to-rose-50/80 dark:from-red-950/30 dark:to-rose-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
                          <DollarSign className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-700 dark:text-red-300">Despesas</p>
                          <p className="text-xl font-bold text-red-800 dark:text-red-200">
                            {formatMoney(financials.filter(f => f.transaction_type === 'expense' || f.transaction_type === 'payment_sent').reduce((acc, f) => acc + f.amount, 0))}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-full">
                          <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Saldo</p>
                          <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                            {formatMoney(
                              financials.filter(f => f.transaction_type === 'income' || f.transaction_type === 'payment_received').reduce((acc, f) => acc + f.amount, 0) -
                              financials.filter(f => f.transaction_type === 'expense' || f.transaction_type === 'payment_sent').reduce((acc, f) => acc + f.amount, 0)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(() => {
                      // Normalize description helper
                      const normalizeDesc = (description: string) => {
                        return description.replace(/\s*-\s*Parcela\s+\d+\/\d+\s*$/i, '').trim();
                      };

                      // Group installments
                      const groups = new Map<string, Financial[]>();
                      const standalone: Financial[] = [];

                      financials.forEach(financial => {
                        const normalizedDesc = normalizeDesc(financial.description);
                        const key = `${financial.transaction_type}|${normalizedDesc}`;
                        
                        // Check if description has installment pattern
                        const hasInstallmentPattern = /Parcela\s+\d+\/\d+/i.test(financial.description);
                        
                        if (hasInstallmentPattern) {
                          const existing = groups.get(key);
                          if (existing) {
                            existing.push(financial);
                          } else {
                            groups.set(key, [financial]);
                          }
                        } else {
                          standalone.push(financial);
                        }
                      });

                      const items: Array<{type: 'single', financial: Financial} | {type: 'group', key: string, transactions: Financial[], description: string, totalAmount: number}> = [];
                      
                      standalone.forEach(financial => {
                        items.push({ type: 'single', financial });
                      });

                      groups.forEach((transactions, key) => {
                        if (transactions.length > 1) {
                          const sortedTransactions = [...transactions].sort((a, b) => 
                            new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
                          );
                          const normalizedDesc = normalizeDesc(sortedTransactions[0].description);
                          items.push({
                            type: 'group',
                            key,
                            transactions: sortedTransactions,
                            description: normalizedDesc,
                            totalAmount: sortedTransactions.reduce((sum, t) => sum + t.amount, 0)
                          });
                        } else {
                          items.push({ type: 'single', financial: transactions[0] });
                        }
                      });

                      return items.map((item) => {
                        if (item.type === 'single') {
                          const financial = item.financial;
                          const formattedReference = formatReferenceDocument(financial.reference_document);
                          return (
                            <div key={financial.id} className="group border-2 border-border/50 rounded-xl p-5 hover:border-green-300 dark:hover:border-green-700 transition-all duration-300 hover:shadow-lg bg-gradient-to-r from-card to-muted/20">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`p-3 rounded-full ${financial.transaction_type === 'income' || financial.transaction_type === 'payment_received' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                                    <DollarSign className={`h-5 w-5 ${financial.transaction_type === 'income' || financial.transaction_type === 'payment_received' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                      <h4 className="font-semibold text-foreground">{financial.description}</h4>
                                      <Badge variant="secondary" className={`${financial.transaction_type === 'income' || financial.transaction_type === 'payment_received' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
                                        {financial.transaction_type}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(financial.transaction_date).toLocaleDateString('pt-BR')}
                                      </div>
                                      {financial.payment_method && (
                                        <div className="flex items-center gap-1">
                                          <CreditCard className="h-3 w-3" />
                                          {getPaymentMethodLabel(financial.payment_method)}
                                        </div>
                                      )}
                                      {formattedReference && (
                                        <div className="flex items-center gap-1">
                                          <FileText className="h-3 w-3" />
                                          {formattedReference}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-2xl font-bold ${financial.transaction_type === 'income' || financial.transaction_type === 'payment_received' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {financial.transaction_type === 'income' || financial.transaction_type === 'payment_received' ? '+' : '-'}
                                    {formatMoney(financial.amount)}
                                  </div>
                                  <div className="mt-1">
                                    <Badge
                                      variant={financial.status === 'completed' ? 'default' : financial.status === 'pending' ? 'secondary' : 'destructive'}
                                      className="text-xs"
                                    >
                                      {financial.status === 'completed' ? 'Concluído' : financial.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Group rendering
                        const isOpen = Boolean(openFinancialGroups[item.key]);
                        const firstTransaction = item.transactions[0];
                        const pendingCount = item.transactions.filter(t => t.status === 'pending').length;
                        const paidCount = item.transactions.filter(t => t.status === 'completed').length;
                        
                        return (
                          <div key={item.key} className="border-2 border-border/50 rounded-xl overflow-hidden bg-gradient-to-r from-card to-muted/20">
                            <div className="group p-5 hover:border-green-300 dark:hover:border-green-700 transition-all duration-300 hover:shadow-lg bg-muted/40">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className={`p-3 rounded-full ${firstTransaction.transaction_type === 'income' || firstTransaction.transaction_type === 'payment_received' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                                    <DollarSign className={`h-5 w-5 ${firstTransaction.transaction_type === 'income' || firstTransaction.transaction_type === 'payment_received' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                      <button
                                        type="button"
                                        onClick={() => setOpenFinancialGroups(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                        className="flex items-center gap-2 text-left"
                                      >
                                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? '-rotate-180' : 'rotate-0'}`} />
                                        <h4 className="font-semibold text-foreground">{item.description}</h4>
                                      </button>
                                      <Badge variant="outline">Parcelado ({item.transactions.length}x)</Badge>
                                      <Badge variant="secondary" className={`${firstTransaction.transaction_type === 'income' || firstTransaction.transaction_type === 'payment_received' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
                                        {firstTransaction.transaction_type}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      {pendingCount > 0 && <span>{pendingCount} pendente(s)</span>}
                                      {paidCount > 0 && <span>{paidCount} pago(s)</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-2xl font-bold ${firstTransaction.transaction_type === 'income' || firstTransaction.transaction_type === 'payment_received' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {firstTransaction.transaction_type === 'income' || firstTransaction.transaction_type === 'payment_received' ? '+' : '-'}
                                    {formatMoney(item.totalAmount)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {isOpen && (
                              <div className="border-t border-border/50 bg-muted/20 p-4">
                                <div className="space-y-3">
                                  {item.transactions.map((transaction, index) => {
                                    const formattedReference = formatReferenceDocument(transaction.reference_document);
                                    return (
                                      <div key={transaction.id} className="border border-border/50 rounded-lg p-4 bg-card">
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                              <span className="font-medium">Parcela {index + 1} de {item.transactions.length}</span>
                                              <Badge
                                                variant={transaction.status === 'completed' ? 'default' : transaction.status === 'pending' ? 'secondary' : 'destructive'}
                                                className="text-xs"
                                              >
                                                {transaction.status === 'completed' ? 'Concluído' : transaction.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                              </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                              <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(transaction.transaction_date).toLocaleDateString('pt-BR')}
                                              </div>
                                              {transaction.payment_method && (
                                                <div className="flex items-center gap-1">
                                                  <CreditCard className="h-3 w-3" />
                                                  {getPaymentMethodLabel(transaction.payment_method)}
                                                </div>
                                              )}
                                              {formattedReference && (
                                                <div className="flex items-center gap-1">
                                                  <FileText className="h-3 w-3" />
                                                  {formattedReference}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className={`text-xl font-bold ${firstTransaction.transaction_type === 'income' || firstTransaction.transaction_type === 'payment_received' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                              {formatMoney(transaction.amount)}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-950 dark:to-emerald-950 rounded-full flex items-center justify-center mx-auto mb-6">
                    <DollarSign className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Nenhuma transação registrada</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">Comece registrando a primeira transação financeira para este cliente.</p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Registrar Primeira Transação
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Transação</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select value={newFinancial.type} onValueChange={(value) => setNewFinancial({ ...newFinancial, type: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="payment_received">Pagamento Recebido</SelectItem>
                              <SelectItem value="payment_sent">Pagamento Enviado</SelectItem>
                              <SelectItem value="income">Receita</SelectItem>
                              <SelectItem value="expense">Despesa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Input value={newFinancial.description} onChange={(e) => setNewFinancial({ ...newFinancial, description: e.target.value })} placeholder="Descrição da transação" />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor</Label>
                          <Input type="number" step="0.01" value={newFinancial.amount} onChange={(e) => setNewFinancial({ ...newFinancial, amount: e.target.value })} placeholder="0,00" />
                        </div>
                        <div className="space-y-2">
                          <Label>Data</Label>
                          <Input type="date" value={newFinancial.date} onChange={(e) => setNewFinancial({ ...newFinancial, date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={newFinancial.status} onValueChange={(value) => setNewFinancial({ ...newFinancial, status: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="completed">Concluído</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="rounded-lg border bg-muted/50 p-3 flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">Pagamento parcelado</p>
                            <p className="text-xs text-muted-foreground">
                              Habilite para dividir o valor em parcelas mensais automaticamente.
                            </p>
                          </div>
                          <Switch
                            checked={newFinancial.isInstallment}
                            onCheckedChange={(checked) =>
                              setNewFinancial((prev) => {
                                const parsed = Number.parseInt(prev.installmentCount, 10);
                                return {
                                  ...prev,
                                  isInstallment: checked,
                                  installmentCount:
                                    checked && (!Number.isFinite(parsed) || parsed < 2)
                                      ? '2'
                                      : checked
                                        ? prev.installmentCount
                                        : '1',
                                };
                              })
                            }
                          />
                        </div>
                        {newFinancial.isInstallment && (
                          <div className="space-y-2">
                            <Label>Número de Parcelas</Label>
                            <Input
                              type="number"
                              min={1}
                              value={newFinancial.installmentCount}
                              onChange={(event) =>
                                setNewFinancial((prev) => ({
                                  ...prev,
                                  installmentCount: event.target.value,
                                }))
                              }
                              placeholder="2"
                            />
                          </div>
                        )}
                        {newFinancial.isInstallment && installmentPreview && (
                          <div className="text-xs text-muted-foreground rounded-md border bg-muted/40 p-3 space-y-1">
                            <p>
                              Serão criadas{' '}
                              <span className="font-medium text-foreground">{installmentPreview.count} parcelas</span>{' '}
                              com valor médio de{' '}
                              <span className="font-medium text-foreground">
                                {formatMoney(installmentPreview.averageAmount)}
                              </span>
                              .
                            </p>
                            {installmentPreview.firstDate && installmentPreview.lastDate && (
                              <p>
                                Vencimentos de {installmentPreview.firstDate.toLocaleDateString('pt-BR')} até{' '}
                                {installmentPreview.lastDate.toLocaleDateString('pt-BR')}.
                              </p>
                            )}
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Referência</Label>
                          <Input value={newFinancial.reference} onChange={(e) => setNewFinancial({ ...newFinancial, reference: e.target.value })} placeholder="Ex: PIX-001, TED-002" />
                        </div>
                        <Button onClick={handleAddFinancial} className="w-full">Adicionar Transação</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Projetos */}
        <TabsContent value="projetos" className="space-y-6">
          <ClientProjectsTab projects={projects} onUpdate={loadClientData} />
        </TabsContent>

        {/* Aba Orçamentos */}
        <TabsContent value="orcamentos" className="space-y-6">
          <ClientBudgetsTab clientId={id!} onProjectCreated={loadClientData} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeleteDocumentDialogOpen} onOpenChange={handleDeleteDocumentDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o documento{' '}
              <span className="font-semibold">{documentToDelete?.document_name}</span>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingDocument}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (event: ReactMouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                await handleDeleteDocument();
              }}
              disabled={isDeletingDocument}
            >
              {isDeletingDocument ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Timeline Dialog */}
      {selectedProjectForTimeline && (
        <ProjectTimeline
          projectId={selectedProjectForTimeline.id}
          projectTitle={selectedProjectForTimeline.title}
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
        />
      )}
    </div>
  );
}