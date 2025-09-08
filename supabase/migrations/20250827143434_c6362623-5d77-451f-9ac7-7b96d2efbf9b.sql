-- Migrar tarefas da tabela 'tasks' para 'tasks_new'
INSERT INTO tasks_new (
  id,
  title,
  priority,
  status,
  client_id,
  created_by,
  created_at,
  updated_at,
  due_date
)
SELECT 
  id,
  title,
  CASE 
    WHEN priority = 'BAIXA' THEN 'baixa'::task_priority
    WHEN priority = 'MEDIA' THEN 'media'::task_priority
    WHEN priority = 'ALTA' THEN 'alta'::task_priority
    WHEN priority = 'URGENTE' THEN 'urgente'::task_priority
    ELSE 'media'::task_priority
  END as priority,
  CASE 
    WHEN status = 'TODO' THEN 'aberta'::task_status
    WHEN status = 'IN_PROGRESS' THEN 'em_andamento'::task_status
    WHEN status = 'DONE' THEN 'concluida'::task_status
    WHEN status = 'ARCHIVED' THEN 'arquivada'::task_status
    ELSE 'aberta'::task_status
  END as status,
  client_id,
  created_by,
  created_at,
  updated_at,
  NULL as due_date -- A tabela antiga não tem due_date
FROM tasks
WHERE NOT EXISTS (
  SELECT 1 FROM tasks_new WHERE tasks_new.id = tasks.id
);