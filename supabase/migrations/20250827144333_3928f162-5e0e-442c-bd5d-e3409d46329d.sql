-- Create a mapping between old client_ids and new profile user_ids
-- Then migrate the remaining tasks using the correct client_id mapping
WITH client_mapping AS (
  SELECT 
    c.id as old_client_id,
    p.user_id as new_client_id
  FROM clientes c
  JOIN profiles p ON (c.email = p.email OR c.telefone = p.telefone)
)
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
  cm.old_client_id, -- Keep the original client_id that points to clientes table
  t.created_by,
  t.created_at,
  t.updated_at,
  NULL as due_date
FROM tasks t
JOIN client_mapping cm ON t.client_id = cm.old_client_id
WHERE NOT EXISTS (
  SELECT 1 FROM tasks_new WHERE tasks_new.id = t.id
);