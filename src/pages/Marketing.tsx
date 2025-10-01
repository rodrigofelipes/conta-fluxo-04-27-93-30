import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, TrendingUp, Users, FileText } from "lucide-react";

export default function Marketing() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Marketing"
        subtitle="Gestão de estratégias de marketing e comunicação do escritório"
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Campanhas
            </CardTitle>
            <CardDescription>
              Gerencie suas campanhas de marketing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Em breve: ferramentas para criar e acompanhar campanhas de marketing.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Análises
            </CardTitle>
            <CardDescription>
              Acompanhe métricas e resultados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Em breve: dashboards com métricas de marketing e performance.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Leads
            </CardTitle>
            <CardDescription>
              Gestão de leads e prospecção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Em breve: sistema de gestão de leads e oportunidades.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Conteúdo
            </CardTitle>
            <CardDescription>
              Planejamento de conteúdo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Em breve: calendário editorial e gestão de conteúdo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
