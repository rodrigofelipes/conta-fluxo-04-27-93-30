-- Adicionar campo mime_type à tabela documents para suporte completo a diferentes formatos
ALTER TABLE public.documents 
ADD COLUMN mime_type TEXT;

-- Atualizar documentos existentes com mime_type genérico
UPDATE public.documents 
SET mime_type = 'application/octet-stream' 
WHERE mime_type IS NULL;

-- Adicionar índice para facilitar busca por tipo de arquivo
CREATE INDEX idx_documents_mime_type ON public.documents (mime_type);

-- Adicionar campo file_extension para facilitar filtragem por extensão
ALTER TABLE public.documents 
ADD COLUMN file_extension TEXT;

-- Popular extensões dos arquivos existentes baseado no nome
UPDATE public.documents 
SET file_extension = lower(substring(name from '\.([^.]*)$'))
WHERE file_extension IS NULL AND name ~ '\.[^.]*$';