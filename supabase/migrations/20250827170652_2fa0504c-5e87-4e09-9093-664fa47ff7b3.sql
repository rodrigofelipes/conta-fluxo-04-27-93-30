-- Now migrate the tasks with the correct foreign key setup
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
  t.id,
  t.title,
  CASE 
    WHEN t.priority = 'BAIXA' THEN 'baixa'::task_priority
    WHEN t.priority = 'MEDIA' THEN 'media'::task_priority
    WHEN t.priority = 'ALTA' THEN 'alta'::task_priority
    WHEN t.priority = 'URGENTE' THEN 'urgente'::task_priority
    ELSE 'media'::task_priority
  END as priority,
  CASE 
    WHEN t.status = 'TODO' THEN 'aberta'::task_status
    WHEN t.status = 'IN_PROGRESS' THEN 'em_andamento'::task_status
    WHEN t.status = 'DONE' THEN 'concluida'::task_status
    WHEN t.status = 'ARCHIVED' THEN 'arquivada'::task_status
    ELSE 'aberta'::task_status
  END as status,
  t.client_id,
  t.created_by,
  t.created_at,
  t.updated_at,
  NULL as due_date
FROM tasks t
ON CONFLICT (id) DO NOTHING;