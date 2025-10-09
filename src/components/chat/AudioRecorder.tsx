

import { useCallback, useEffect, useRef, useState } from "react";


import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Mic, Square, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { uploadFileToDrive } from "@/integrations/googleDrive/storage";
import { createHash } from "@/utils/fileValidation";
import type { UploadedFileInfo } from "@/components/chat/FileUpload";

interface AudioRecorderProps {
  onRecordingComplete: (file: UploadedFileInfo) => void;
  disabled?: boolean;
  clientId?: string;
  clientName?: string;




}

const sanitizeFilename = (filename: string) =>
  filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_");

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export function AudioRecorder({
  onRecordingComplete,
  disabled,
  clientId,
  clientName,




}: AudioRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldSaveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const resetState = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    chunksRef.current = [];
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setRecordingTime(0);
    setIsRecording(false);
  };

  const handleStop = useCallback(async () => {
    const blob = new Blob(chunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || "audio/webm",
    });

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];

    if (!shouldSaveRef.current) {
      shouldSaveRef.current = true;
      resetState();
      return;
    }

    if (blob.size === 0) {
      resetState();
      toast({
        title: "Falha na gravação",
        description: "Nenhum áudio foi capturado.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const mimeType = blob.type || "audio/webm";
      const extension = mimeType.includes("mp4") ? "m4a" : "webm";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = sanitizeFilename(`gravacao-${timestamp}.${extension}`);
      const file = new File([blob], filename, { type: mimeType });
      const hash = await createHash(file);

      const uploadResult = await uploadFileToDrive({
        file,
        clientId: clientId || "chat-internal",
        clientName: clientName || "Chat Interno",
        sanitizedName: filename,
        hash,
        subfolder: "Chat",
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
      });

      const uploadedFile: UploadedFileInfo = {
        id: crypto.randomUUID(),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        driveFileId: uploadResult.id,
        webViewLink: uploadResult.webViewLink ?? null,
        webContentLink: uploadResult.webContentLink ?? null,
      };

      onRecordingComplete(uploadedFile);

      toast({
        title: "Áudio gravado",
        description: "Sua gravação foi adicionada como anexo.",
      });
    } catch (err) {
      console.error("Erro ao processar gravação:", err);
      toast({
        title: "Erro na gravação",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível processar o áudio gravado.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      resetState();
    }
  }, [clientId, clientName, onRecordingComplete]);

  const startRecording = async () => {
    if (disabled || isRecording || isUploading) return;

    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const message = "Seu navegador não suporta gravação de áudio.";
      setError(message);
      toast({
        title: "Recurso indisponível",
        description: message,
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      chunksRef.current = [];
      shouldSaveRef.current = true;
      mediaRecorderRef.current = mediaRecorder;
      streamRef.current = stream;

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener("stop", handleStop);

      mediaRecorder.start();

      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao iniciar gravação:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível acessar o microfone."
      );
      toast({
        title: "Permissão negada",
        description:
          "Precisamos de acesso ao microfone para gravar áudios. Verifique as permissões do navegador.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    mediaRecorderRef.current.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    shouldSaveRef.current = false;
    mediaRecorderRef.current.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    toast({
      title: "Gravação cancelada",
      description: "O áudio gravado não foi salvo.",
    });
  };




  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isRecording ? "destructive" : "outline"}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isUploading}
          className="gap-2"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {isRecording ? "Parar gravação" : "Gravar áudio"}
        </Button>

        {isRecording && (
          <>
            <span className="text-sm font-medium text-destructive">
              {formatDuration(recordingTime)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={cancelRecording}
              className="h-9 w-9"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}

        {isUploading && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando áudio...
          </span>
        )}
      </div>

      {(isUploading || uploadProgress > 0) && (
        <Progress value={uploadProgress} className="h-2" />
      )}

      {error && !isRecording && !isUploading && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
