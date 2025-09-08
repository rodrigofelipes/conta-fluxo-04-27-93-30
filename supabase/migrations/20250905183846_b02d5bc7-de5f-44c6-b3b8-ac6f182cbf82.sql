-- Criar algumas tarefas de exemplo para o Filype
INSERT INTO tasks (
  title,
  description,
  status,
  priority,
  task_type,
  assigned_to,
  created_by,
  due_date
) VALUES
(
  'Revisão do projeto de arquitetura',
  'Revisar os desenhos técnicos e especificações do projeto residencial',
  'pendente',
  'alta',
  'geral',
  'c3e8234a-2a1d-445a-a2f4-510ea29b33f7', -- Filype's profile ID
  'c3e8234a-2a1d-445a-a2f4-510ea29b33f7', -- Created by Filype
  '2025-09-10 17:00:00'::timestamp with time zone
),
(
  'Análise de viabilidade técnica',
  'Analisar a viabilidade técnica da reforma proposta pelo cliente',
  'em_andamento', 
  'média',
  'geral',
  'c3e8234a-2a1d-445a-a2f4-510ea29b33f7', -- Filype's profile ID
  'c3e8234a-2a1d-445a-a2f4-510ea29b33f7', -- Created by Filype
  '2025-09-08 15:30:00'::timestamp with time zone
),
(
  'Preparação de relatório mensal',
  'Compilar dados e preparar o relatório mensal de progresso dos projetos',
  'pendente',
  'baixa',
  'geral', 
  'c3e8234a-2a1d-445a-a2f4-510ea29b33f7', -- Filype's profile ID
  'c3e8234a-2a1d-445a-a2f4-510ea29b33f7', -- Created by Filype
  '2025-09-15 18:00:00'::timestamp with time zone
);