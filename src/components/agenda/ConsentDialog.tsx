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

interface ConsentDialogProps {
  open: boolean;
  onConsent: () => void;
  onDecline: () => void;
}

export function ConsentDialog({ open, onConsent, onDecline }: ConsentDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Consentimento de Gravação</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <p>
              Esta reunião será <strong>gravada e transcrita automaticamente</strong>.
            </p>
            
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="font-medium mb-2">Uso dos dados:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Transcrição e análise da reunião</li>
                <li>Geração de sumário e decisões</li>
                <li>Armazenamento seguro por <strong>90 dias</strong></li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Ao clicar em "Concordo", você autoriza a gravação e o processamento 
              dos dados conforme nossa Política de Privacidade (LGPD).
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDecline}>
            Não Concordo
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConsent}>
            Concordo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
