import { Download, File, Image, Video, Volume2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

interface MediaMessageProps {
  attachment: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    downloadUrl: string;
    storagePath?: string;
  };
}

// Helper function to create proxy URL for media files
const getProxyUrl = (attachment: MediaMessageProps['attachment']) => {
  if (attachment.storagePath) {
    const supabaseUrl = "https://wcdyxxthaqzchjpharwh.supabase.co";
    return `${supabaseUrl}/functions/v1/media-proxy?path=${encodeURIComponent(attachment.storagePath)}&bucket=chat-files`;
  }
  return attachment.downloadUrl;
};

export function MediaMessage({ attachment }: MediaMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const proxyUrl = getProxyUrl(attachment);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          console.warn("Erro ao finalizar áudio:", error);
        }
      }

      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        } catch (error) {
          console.warn("Erro ao finalizar vídeo:", error);
        }
      }
    };
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Download iniciado");
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toast.error("Erro ao fazer download do arquivo");
    }
  };

  const toggleAudio = () => {
    const element = audioRef.current;
    if (!element) return;

    if (isPlaying) {
      element.pause();
      setIsPlaying(false);
      return;
    }

    element
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch((error) => {
        console.error("Erro ao reproduzir áudio:", error);
        toast.error("Não foi possível reproduzir o áudio");
        setIsPlaying(false);
      });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImage = attachment.fileType.startsWith('image/');
  const isVideo = attachment.fileType.startsWith('video/');
  const isAudio = attachment.fileType.startsWith('audio/');

  return (
    <div className="w-full max-w-sm bg-card border rounded-lg overflow-hidden">
      {isImage && (
        <div className="relative group">
          {!imageError ? (
            <img 
              src={proxyUrl} 
              alt={attachment.fileName}
              className="w-full h-auto max-h-64 object-cover"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-32 bg-muted flex items-center justify-center">
              <div className="text-center">
                <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Erro ao carregar imagem</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              onClick={handleDownload}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      )}

      {isVideo && (
        <div className="relative">
          <video 
            ref={videoRef}
            src={proxyUrl}
            className="w-full h-auto max-h-64"
            controls
            preload="metadata"
          />
        </div>
      )}

      {isAudio && (
        <div className="p-4 flex items-center gap-3">
          <Button
            onClick={toggleAudio}
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1">
            <p className="text-sm font-medium truncate">{attachment.fileName}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
          </div>
          <audio
            ref={audioRef}
            src={proxyUrl}
            preload="metadata"
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              toast.error("Erro ao carregar o áudio");
              setIsPlaying(false);
            }}
          />
        </div>
      )}

      {!isImage && !isVideo && !isAudio && (
        <div className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <File className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium truncate">{attachment.fileName}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
          </div>
        </div>
      )}

      <div className="border-t p-3 flex justify-between items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isImage && <Image className="h-3 w-3" />}
          {isVideo && <Video className="h-3 w-3" />}
          {isAudio && <Volume2 className="h-3 w-3" />}
          {!isImage && !isVideo && !isAudio && <File className="h-3 w-3" />}
          <span className="truncate max-w-20">{attachment.fileType}</span>
        </div>
        
        <Button
          onClick={handleDownload}
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
        >
          <Download className="h-3 w-3" />
          Download
        </Button>
      </div>
    </div>
  );
}