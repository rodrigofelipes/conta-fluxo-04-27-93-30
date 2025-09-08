-- Inserir tarefas de exemplo para o cliente logado
-- Client ID identificado nos logs: 7accb00e-1d31-4398-ad7e-d94d3b0a23d2

INSERT INTO tasks_new (
  title,
  description, 
  client_id,
  created_by,
  status,
  priority,
  due_date
) VALUES 
(
  'Entrega de Documentos Mensais',
  'Preparação e entrega dos documentos contábeis do mês de agosto/2025',
  '7accb00e-1d31-4398-ad7e-d94d3b0a23d2',
  '3d1b15b2-6d20-4e08-950d-2edeee2b9add', -- Um admin qualquer
  'aberta',
  'alta',
  '2025-09-15 17:00:00+00'
),
(
  'Análise de Impostos Trimestrais',
  'Revisão e cálculo dos impostos do terceiro trimestre de 2025',
  '7accb00e-1d31-4398-ad7e-d94d3b0a23d2',
  '3d1b15b2-6d20-4e08-950d-2edeee2b9add',
  'em_andamento',
  'media',
  '2025-09-30 17:00:00+00'
),
(
  'Atualização Cadastral na Receita',
  'Atualização dos dados cadastrais da empresa junto aos órgãos competentes',
  '7accb00e-1d31-4398-ad7e-d94d3b0a23d2',
  '54c5ac63-1545-47df-b7e7-a1c032ab1ac6', -- Outro admin
  'aberta',
  'baixa',
  '2025-10-05 17:00:00+00'
),
(
  'Relatório Gerencial Mensal',
  'Elaboração do relatório gerencial com análise financeira do mês',
  '7accb00e-1d31-4398-ad7e-d94d3b0a23d2',
  '3d1b15b2-6d20-4e08-950d-2edeee2b9add',
  'concluida',
  'media',
  '2025-08-31 17:00:00+00'
);