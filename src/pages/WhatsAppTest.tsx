import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import WhatsAppAgendaManager from "@/components/WhatsAppAgendaManager";
import WhatsAppTestComponent from "@/components/WhatsAppTest";
import WhatsAppDebugger from "@/components/WhatsAppDebugger";
import { MessageSquare, Calendar, Send, Bug } from "lucide-react";

export default function WhatsAppTestPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Teste WhatsApp" 
        subtitle="Teste das funcionalidades de WhatsApp - Agenda da Débora e Envio de Mensagens" 
      />
      
      <Tabs defaultValue="debug" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="debug" className="flex items-center gap-2">
            <Bug className="size-4" />
            Debug Config
          </TabsTrigger>
          <TabsTrigger value="agenda" className="flex items-center gap-2">
            <Calendar className="size-4" />
            Agenda Débora
          </TabsTrigger>
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="size-4" />
            Envio Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debug" className="space-y-4">
          <WhatsAppDebugger />
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5" />
                Teste - Agenda WhatsApp Débora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WhatsAppAgendaManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-5" />
                Teste - Envio Manual WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WhatsAppTestComponent />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}