-- Inserir clientes fictícios
INSERT INTO public.clients (name, cpf, email, residential_address, construction_address, indication, birth_date, classification, created_by) 
VALUES 
  ('João Silva Santos', '123.456.789-01', 'joao.silva@email.com', 'Rua das Flores, 123 - Centro - São Paulo/SP', 'Av. Paulista, 456 - Bela Vista - São Paulo/SP', 'Indicação do arquiteto Carlos', '1985-03-15', 'cliente', (SELECT user_id FROM profiles LIMIT 1)),
  ('Maria Oliveira Costa', '987.654.321-02', 'maria.oliveira@email.com', 'Rua dos Pinheiros, 789 - Pinheiros - São Paulo/SP', 'Rua Augusta, 321 - Consolação - São Paulo/SP', 'Site da empresa', '1990-07-22', 'cliente', (SELECT user_id FROM profiles LIMIT 1)),
  ('Carlos Eduardo Lima', '456.789.123-03', 'carlos.lima@email.com', 'Av. Ibirapuera, 1500 - Ibirapuera - São Paulo/SP', 'Rua Oscar Freire, 200 - Jardins - São Paulo/SP', 'Referência de cliente anterior', '1982-11-10', 'cliente', (SELECT user_id FROM profiles LIMIT 1)),
  ('Ana Paula Ferreira', '321.654.987-04', 'ana.ferreira@email.com', 'Rua Consolação, 890 - Consolação - São Paulo/SP', 'Av. Faria Lima, 1000 - Itaim Bibi - São Paulo/SP', 'Instagram', '1988-05-18', 'cliente', (SELECT user_id FROM profiles LIMIT 1)),
  ('Roberto Construções Ltda', '12.345.678/0001-90', 'contato@roberto.com.br', 'Av. Rebouças, 3000 - Pinheiros - São Paulo/SP', 'Multiple locations', 'Parceria comercial', NULL, 'fornecedor', (SELECT user_id FROM profiles LIMIT 1));

-- Inserir histórico de contatos fictícios
INSERT INTO public.client_contacts (client_id, contact_type, subject, description, contact_date, created_by)
SELECT 
  c.id,
  'email',
  'Primeira reunião de apresentação',
  'Discussão sobre o projeto de arquitetura residencial. Cliente demonstrou interesse em soluções sustentáveis e modernas.',
  NOW() - INTERVAL '15 days',
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'João Silva Santos';

INSERT INTO public.client_contacts (client_id, contact_type, subject, description, contact_date, created_by)
SELECT 
  c.id,
  'call',
  'Definição do orçamento',
  'Ligação para alinhar valores e prazos do projeto. Cliente aprovou o orçamento inicial.',
  NOW() - INTERVAL '10 days',
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'João Silva Santos';

INSERT INTO public.client_contacts (client_id, contact_type, subject, description, contact_date, created_by)
SELECT 
  c.id,
  'meeting',
  'Reunião de acompanhamento do projeto',
  'Apresentação dos primeiros esboços. Cliente solicitou algumas alterações na fachada.',
  NOW() - INTERVAL '5 days',
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'Maria Oliveira Costa';

INSERT INTO public.client_contacts (client_id, contact_type, subject, description, contact_date, created_by)
SELECT 
  c.id,
  'whatsapp',
  'Envio de documentação',
  'Encaminhamento de documentos técnicos e plantas atualizadas via WhatsApp.',
  NOW() - INTERVAL '3 days',
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'Carlos Eduardo Lima';

-- Inserir transações financeiras fictícias
INSERT INTO public.client_financials (client_id, transaction_type, description, amount, transaction_date, status, reference_document, created_by)
SELECT 
  c.id,
  'payment_received',
  'Entrada do projeto - 30%',
  15000.00,
  NOW() - INTERVAL '12 days',
  'completed',
  'PIX-001',
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'João Silva Santos';

INSERT INTO public.client_financials (client_id, transaction_type, description, amount, transaction_date, status, reference_document, created_by)
SELECT 
  c.id,
  'payment_received',
  'Segunda parcela - 40%',
  20000.00,
  NOW() - INTERVAL '5 days',
  'completed',
  'PIX-002',
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'João Silva Santos';

INSERT INTO public.client_financials (client_id, transaction_type, description, amount, transaction_date, status, reference_document, created_by)
SELECT 
  c.id,
  'income',
  'Pagamento restante - 30%',
  15000.00,
  NOW() + INTERVAL '30 days',
  'pending',
  'CONTRATO-001',
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'João Silva Santos';

INSERT INTO public.client_financials (client_id, transaction_type, description, amount, transaction_date, status, reference_document, created_by)
SELECT 
  c.id,
  'payment_received',
  'Entrada do projeto comercial',
  25000.00,
  NOW() - INTERVAL '8 days',
  'completed',
  'TED-001',
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'Maria Oliveira Costa';

-- Inserir projetos fictícios
INSERT INTO public.projects (title, description, address, client_id, status, contracted_hours, executed_hours, created_by)
SELECT 
  'Residência Moderna Vila Madalena',
  'Projeto arquitetônico completo para residência de 300m² com conceito sustentável e design contemporâneo.',
  'Rua dos Pinheiros, 789 - Vila Madalena - São Paulo/SP',
  c.id,
  'execução',
  120,
  45,
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'João Silva Santos';

INSERT INTO public.projects (title, description, address, client_id, status, contracted_hours, executed_hours, created_by)
SELECT 
  'Escritório Corporativo Faria Lima',
  'Design de interiores para escritório de 500m² com foco em produtividade e bem-estar.',
  'Av. Faria Lima, 1000 - Itaim Bibi - São Paulo/SP',
  c.id,
  'orçamento',
  80,
  15,
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'Maria Oliveira Costa';

INSERT INTO public.projects (title, description, address, client_id, status, contracted_hours, executed_hours, created_by)
SELECT 
  'Reforma Apartamento Jardins',
  'Reforma completa de apartamento de 180m² incluindo mudança de layout e design de interiores.',
  'Rua Oscar Freire, 200 - Jardins - São Paulo/SP',
  c.id,
  'planejamento',
  60,
  8,
  (SELECT user_id FROM profiles LIMIT 1)
FROM clients c WHERE c.name = 'Carlos Eduardo Lima';