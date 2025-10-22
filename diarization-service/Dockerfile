FROM python:3.10-slim

WORKDIR /app

# Instalar ffmpeg para conversão de áudio
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências Python
RUN pip install --no-cache-dir \
    fastapi==0.109.0 \
    uvicorn==0.27.0 \
    pyannote.audio==3.1.1 \
    torch==2.1.2 \
    torchaudio==2.1.2 \
    python-multipart==0.0.6

COPY main.py /app/

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
