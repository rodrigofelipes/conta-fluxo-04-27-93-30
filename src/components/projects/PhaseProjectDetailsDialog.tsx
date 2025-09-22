import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ProjectDocuments } from "./ProjectDocuments";

interface ProjectDetails {
  id: string;
  title: string;
  description?: string | null;
  address?: string | null;
  status?: string | null;
  contracted_hours?: number | null;
  executed_hours?: number | null;
  created_at?: string | null;
  client?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

interface PhaseProjectDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectTitle?: string;
  phaseName?: string;
}

export function PhaseProjectDetailsDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  phaseName
}: PhaseProjectDetailsDialogProps) {
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!projectId) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            title,
            description,
            address,
            status,
            contracted_hours,
            executed_hours,
            created_at,
            client:clients(name, email)
          `)
          .eq('id', projectId)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          toast({
            title: "Projeto não encontrado",
            description: "Não foi possível localizar os detalhes do projeto.",
            variant: "destructive"
          });
          setProjectDetails(null);
          return;
        }

        setProjectDetails(data as ProjectDetails);
      } catch (error) {
        console.error('Erro ao carregar detalhes do projeto:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os detalhes do projeto.",
          variant: "destructive"
        });
        setProjectDetails(null);
      } finally {
        setLoading(false);
      }
    };

    if (open && projectId) {
      fetchProjectDetails();
    }

    if (!open) {
      setProjectDetails(null);
      setLoading(false);
    }
  }, [open, projectId]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setProjectDetails(null);
      setLoading(false);
    }
    onOpenChange(nextOpen);
  };

  const contractedHours = projectDetails?.contracted_hours ?? 0;
  const executedHours = projectDetails?.executed_hours ?? 0;
  const progressValue = contractedHours > 0
    ? Math.min((executedHours / contractedHours) * 100, 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{projectDetails?.title || projectTitle || 'Detalhes do Projeto'}</DialogTitle>
          <DialogDescription>
            {phaseName ? `Etapa atual: ${phaseName}` : 'Visualização da etapa selecionada'}
          </DialogDescription>
        </DialogHeader>

        {projectId ? (
          <Tabs defaultValue="info" className="mt-4">
            <TabsList>
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4">
              {loading ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Carregando detalhes do projeto...
                  </CardContent>
                </Card>
              ) : projectDetails ? (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Cliente</p>
                          <p className="font-medium">
                            {projectDetails.client?.name || 'Não informado'}
                          </p>
                          {projectDetails.client?.email && (
                            <p className="text-sm text-muted-foreground">
                              {projectDetails.client.email}
                            </p>
                          )}
                        </div>
                        {projectDetails.status && (
                          <Badge variant="outline" className="self-start uppercase">
                            {projectDetails.status}
                          </Badge>
                        )}
                      </div>

                      {projectDetails.description && (
                        <div>
                          <p className="text-sm text-muted-foreground">Descrição</p>
                          <p className="text-sm leading-relaxed">
                            {projectDetails.description}
                          </p>
                        </div>
                      )}

                      {projectDetails.address && (
                        <div>
                          <p className="text-sm text-muted-foreground">Endereço</p>
                          <p className="text-sm">{projectDetails.address}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Progresso das Horas</span>
                          <span className="text-muted-foreground">
                            {executedHours.toFixed(1)}h / {contractedHours.toFixed(1)}h
                          </span>
                        </div>
                        <Progress value={progressValue} />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium block text-foreground">Horas Executadas</span>
                          {executedHours.toFixed(1)}h
                        </div>
                        <div>
                          <span className="font-medium block text-foreground">Horas Contratadas</span>
                          {contractedHours.toFixed(1)}h
                        </div>
                        <div className="sm:col-span-2">
                          <span className="font-medium block text-foreground">Criado em</span>
                          {projectDetails.created_at
                            ? new Date(projectDetails.created_at).toLocaleDateString('pt-BR')
                            : 'Não informado'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Não foi possível carregar os detalhes do projeto.
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <ProjectDocuments projectId={projectId} allowManage={false} />
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="mt-4">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Projeto não vinculado a esta etapa.
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
