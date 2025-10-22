from fastapi import FastAPI, File, UploadFile, HTTPException
from pyannote.audio import Pipeline
import torch
import tempfile
import subprocess
import os

app = FastAPI()

# Carregar modelo de diarização (usar HF_TOKEN)
HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise ValueError("HF_TOKEN environment variable is required")

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=HF_TOKEN
)

# Mover para GPU se disponível
if torch.cuda.is_available():
    pipeline.to(torch.device("cuda"))
    print("🚀 Usando GPU para diarização")
else:
    print("💻 Usando CPU para diarização")

def convert_to_wav(input_path: str, output_path: str) -> bool:
    """
    Converte WebM/Opus para WAV PCM 16kHz mono usando ffmpeg
    """
    try:
        command = [
            'ffmpeg',
            '-i', input_path,
            '-ar', '16000',      # Sample rate 16kHz
            '-ac', '1',          # Mono
            '-c:a', 'pcm_s16le', # PCM 16-bit little-endian
            '-y',                # Sobrescrever
            output_path
        ]
        
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro na conversão ffmpeg: {e.stderr.decode()}")
        return False

@app.post("/diarize")
async def diarize_audio(file: UploadFile = File(...)):
    """
    Recebe áudio WebM/Opus e retorna segmentos com falantes
    
    Returns:
        {
          "segments": [
            {"start": 0.5, "end": 3.2, "speaker": "spk_0"},
            {"start": 3.5, "end": 7.8, "speaker": "spk_1"},
            ...
          ],
          "num_speakers": 2
        }
    """
    input_tmp = None
    wav_tmp = None
    
    try:
        # Salvar arquivo de entrada temporariamente
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            content = await file.read()
            tmp.write(content)
            input_tmp = tmp.name
        
        print(f"📥 Arquivo recebido: {len(content)} bytes")
        
        # Criar arquivo WAV temporário
        wav_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
        
        # Converter para WAV PCM 16kHz mono
        print("🔄 Convertendo para WAV PCM 16kHz...")
        if not convert_to_wav(input_tmp, wav_tmp):
            raise HTTPException(
                status_code=500,
                detail="Falha ao converter áudio para formato compatível"
            )
        
        print("✅ Conversão concluída")
        
        # Executar diarização
        print("🎙️ Executando diarização...")
        diarization = pipeline(wav_tmp)
        
        segments = []
        speakers = set()
        
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": round(turn.start, 3),
                "end": round(turn.end, 3),
                "speaker": speaker
            })
            speakers.add(speaker)
        
        print(f"✅ Diarização concluída: {len(segments)} segmentos, {len(speakers)} falantes")
        
        return {
            "segments": segments,
            "num_speakers": len(speakers)
        }
    
    except Exception as e:
        print(f"❌ Erro na diarização: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao processar áudio: {str(e)}"
        )
    
    finally:
        # Limpar arquivos temporários
        if input_tmp and os.path.exists(input_tmp):
            os.unlink(input_tmp)
        if wav_tmp and os.path.exists(wav_tmp):
            os.unlink(wav_tmp)

@app.get("/health")
def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "gpu_available": torch.cuda.is_available(),
        "device": str(pipeline.device) if hasattr(pipeline, 'device') else "cpu"
    }

@app.get("/")
def root():
    """Root endpoint"""
    return {
        "service": "Diarization API",
        "version": "1.0.0",
        "model": "pyannote/speaker-diarization-3.1"
    }
