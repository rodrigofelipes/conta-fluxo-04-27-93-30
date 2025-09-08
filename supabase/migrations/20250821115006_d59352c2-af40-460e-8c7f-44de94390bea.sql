-- Corrigir search_path das funções criadas
CREATE OR REPLACE FUNCTION public.normalize_phone(phone_text text) 
RETURNS text 
LANGUAGE plpgsql
IMMUTABLE STRICT
SET search_path = ''
AS $$
BEGIN
  -- Remove tudo exceto números
  RETURN regexp_replace(COALESCE(phone_text, ''), '[^0-9]', '', 'g');
END;
$$;

CREATE OR REPLACE FUNCTION public.find_client_by_phone(phone_input text)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  telefone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_input text;
  clean_input text;
BEGIN
  -- Normalizar entrada
  normalized_input := public.normalize_phone(phone_input);
  
  -- Versão sem código do país (assumindo Brasil +55)
  clean_input := CASE 
    WHEN normalized_input LIKE '55%' AND length(normalized_input) >= 12 THEN 
      substring(normalized_input from 3)
    ELSE normalized_input
  END;
  
  -- Buscar por telefone exato
  RETURN QUERY
  SELECT c.id, c.nome, c.email, c.telefone
  FROM public.clientes c
  WHERE public.normalize_phone(c.telefone) = normalized_input
     OR public.normalize_phone(c.telefone) = clean_input
     OR public.normalize_phone(c.telefone) = '55' || clean_input
  LIMIT 1;
  
  -- Se não encontrou, tentar busca fuzzy
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT c.id, c.nome, c.email, c.telefone
    FROM public.clientes c
    WHERE public.normalize_phone(c.telefone) LIKE '%' || right(clean_input, 8) || '%'
       OR public.normalize_phone(c.telefone) LIKE '%' || right(normalized_input, 8) || '%'
    LIMIT 1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_unknown_contact(
  phone_input text,
  message_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  contact_id uuid;
  normalized_phone text;
BEGIN
  normalized_phone := public.normalize_phone(phone_input);
  
  -- Verificar se já existe
  SELECT id INTO contact_id 
  FROM public.unknown_contacts 
  WHERE normalized_phone = public.normalize_phone(phone_input);
  
  IF contact_id IS NOT NULL THEN
    -- Atualizar contato existente
    UPDATE public.unknown_contacts 
    SET 
      message_count = message_count + 1,
      last_message_at = now()
    WHERE id = contact_id;
  ELSE
    -- Criar novo contato
    INSERT INTO public.unknown_contacts (
      phone_number, 
      normalized_phone, 
      first_message
    ) 
    VALUES (
      phone_input, 
      normalized_phone, 
      message_text
    ) 
    RETURNING id INTO contact_id;
  END IF;
  
  RETURN contact_id;
END;
$$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_unknown_contacts_normalized_phone ON public.unknown_contacts(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_unknown_contacts_status ON public.unknown_contacts(status);
CREATE INDEX IF NOT EXISTS idx_clientes_normalized_phone ON public.clientes(public.normalize_phone(telefone));