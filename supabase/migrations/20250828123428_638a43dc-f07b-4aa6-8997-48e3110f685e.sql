-- Inserir histórico de contatos fictícios usando IDs existentes
WITH first_profile AS (SELECT user_id FROM profiles LIMIT 1),
     first_client AS (SELECT id FROM clients WHERE name = 'João Silva Santos' LIMIT 1)
INSERT INTO public.client_contacts (client_id, contact_type, subject, description, contact_date, created_by)
SELECT 
  first_client.id,
  'email',
  'Primeira reunião de apresentação',
  'Discussão sobre o projeto de arquitetura residencial. Cliente demonstrou interesse em soluções sustentáveis e modernas.',
  NOW() - INTERVAL '15 days',
  first_profile.user_id
FROM first_client, first_profile;

WITH first_profile AS (SELECT user_id FROM profiles LIMIT 1),
     first_client AS (SELECT id FROM clients WHERE name = 'João Silva Santos' LIMIT 1)
INSERT INTO public.client_contacts (client_id, contact_type, subject, description, contact_date, created_by)
SELECT 
  first_client.id,
  'call',
  'Definição do orçamento',
  'Ligação para alinhar valores e prazos do projeto. Cliente aprovou o orçamento inicial.',
  NOW() - INTERVAL '10 days',
  first_profile.user_id
FROM first_client, first_profile;

WITH first_profile AS (SELECT user_id FROM profiles LIMIT 1),
     second_client AS (SELECT id FROM clients WHERE name = 'Maria Oliveira Costa' LIMIT 1)
INSERT INTO public.client_contacts (client_id, contact_type, subject, description, contact_date, created_by)
SELECT 
  second_client.id,
  'meeting',
  'Reunião de acompanhamento do projeto',
  'Apresentação dos primeiros esboços. Cliente solicitou algumas alterações na fachada.',
  NOW() - INTERVAL '5 days',
  first_profile.user_id
FROM second_client, first_profile;

WITH first_profile AS (SELECT user_id FROM profiles LIMIT 1),
     third_client AS (SELECT id FROM clients WHERE name = 'Carlos Eduardo Lima' LIMIT 1)
INSERT INTO public.client_contacts (client_id, contact_type, subject, description, contact_date, created_by)
SELECT 
  third_client.id,
  'whatsapp',
  'Envio de documentação',
  'Encaminhamento de documentos técnicos e plantas atualizadas via WhatsApp.',
  NOW() - INTERVAL '3 days',
  first_profile.user_id
FROM third_client, first_profile;

-- Inserir transações financeiras fictícias
WITH first_profile AS (SELECT user_id FROM profiles LIMIT 1),
     first_client AS (SELECT id FROM clients WHERE name = 'João Silva Santos' LIMIT 1)
INSERT INTO public.client_financials (client_id, transaction_type, description, amount, transaction_date, status, reference_document, created_by)
SELECT 
  first_client.id,
  'payment_received',
  'Entrada do projeto - 30%',
  15000.00,
  NOW() - INTERVAL '12 days',
  'completed',
  'PIX-001',
  first_profile.user_id
FROM first_client, first_profile;

WITH first_profile AS (SELECT user_id FROM profiles LIMIT 1),
     first_client AS (SELECT id FROM clients WHERE name = 'João Silva Santos' LIMIT 1)
INSERT INTO public.client_financials (client_id, transaction_type, description, amount, transaction_date, status, reference_document, created_by)
SELECT 
  first_client.id,
  'payment_received',
  'Segunda parcela - 40%',
  20000.00,
  NOW() - INTERVAL '5 days',
  'completed',
  'PIX-002',
  first_profile.user_id
FROM first_client, first_profile;

WITH first_profile AS (SELECT user_id FROM profiles LIMIT 1),
     second_client AS (SELECT id FROM clients WHERE name = 'Maria Oliveira Costa' LIMIT 1)
INSERT INTO public.client_financials (client_id, transaction_type, description, amount, transaction_date, status, reference_document, created_by)
SELECT 
  second_client.id,
  'payment_received',
  'Entrada do projeto comercial',
  25000.00,
  NOW() - INTERVAL '8 days',
  'completed',
  'TED-001',
  first_profile.user_id
FROM second_client, first_profile;