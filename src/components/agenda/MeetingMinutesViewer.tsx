import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, ClipboardList, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface MeetingMinutesViewerProps {
  ataId: string;
}

interface Ata {
  id: string;
  meeting_date: string;
  duration_minutes: number;
  processed_summary: string;
  decisions: any;
  action_items: any;
  status: string;
}

interface Utterance {
  id: string;
  start_ms: number;
  end_ms: number;
  diar_label: string;
  identified_name: string | null;
  transcript: string;
}

export function MeetingMinutesViewer({ ataId }: MeetingMinutesViewerProps) {
  const [ata, setAta] = useState<Ata | null>(null);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAta();
  }, [ataId]);

  const loadAta = async () => {
    try {
      setIsLoading(true);
      
      // Carregar ata
      const { data: ataData, error: ataError } = await supabase
        .from('meeting_atas')
        .select('*')
        .eq('id', ataId)
        .single();
      
      if (ataError) throw ataError;
      setAta(ataData);

      // Carregar utterances
      const { data: uttData, error: uttError } = await supabase
        .from('utterances')
        .select('*')
        .eq('ata_id', ataId)
        .order('start_ms', { ascending: true });
      
      if (uttError) throw uttError;
      setUtterances(uttData || []);
      
    } catch (error) {
      console.error('Erro ao carregar ata:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!ata) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Ata não encontrada
      </div>
    );
  }

  const uniqueSpeakers = [...new Set(utterances.map(u => u.diar_label))];

  return (
    <div className="space-y-6">
      {/* Informações gerais */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Reunião</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Data</dt>
              <dd>{format(new Date(ata.meeting_date), "dd/MM/yyyy HH:mm")}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Duração</dt>
              <dd>{ata.duration_minutes} minutos</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={ata.status === 'completed' ? 'default' : 'secondary'}>
                  {ata.status}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Participantes */}
      <Card>
        <CardHeader>
          <CardTitle>Participantes Identificados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {uniqueSpeakers.map((speaker) => (
              <Badge key={speaker} variant="outline">{speaker}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sumário */}
      {ata.processed_summary && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo Executivo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{ata.processed_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Decisões */}
      {ata.decisions && Array.isArray(ata.decisions) && ata.decisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Decisões Tomadas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {ata.decisions.map((decision: any, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{decision}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tarefas */}
      {ata.action_items && Array.isArray(ata.action_items) && ata.action_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {ata.action_items.map((item: any, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">{item.task}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{item.responsible}</Badge>
                      {item.deadline && (
                        <Badge variant="outline" className="text-xs">{item.deadline}</Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Transcrição completa */}
      {utterances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transcrição Completa</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {utterances.map((utt) => (
              <div key={utt.id} className="mb-3 p-2 border-l-2 border-primary bg-muted/50 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {utt.identified_name || utt.diar_label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(utt.start_ms / 60000)}:{String(Math.floor((utt.start_ms % 60000) / 1000)).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-sm">{utt.transcript}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
