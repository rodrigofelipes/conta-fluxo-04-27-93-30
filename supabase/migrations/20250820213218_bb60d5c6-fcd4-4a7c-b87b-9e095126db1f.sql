-- Inserir apenas o cliente de teste com telefone 31997810730
INSERT INTO public.clientes (
  nome,
  email,
  telefone,
  setor,
  situacao,
  apelido
) VALUES (
  'Cliente Teste WhatsApp',
  'testecliente@whatsapp.com',
  '31997810730',
  'CONTABIL'::setor,
  'ATIVO',
  'Teste WA'
) ON CONFLICT DO NOTHING;