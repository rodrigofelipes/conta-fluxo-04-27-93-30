-- Atualizar as tarefas existentes para serem criadas por um supervisor
-- As tarefas devem ser criadas por supervisores/admins, não pelo próprio colaborador
UPDATE tasks 
SET created_by = '233e4f45-61fb-46c7-b889-9a9f0ef6a8ed'  -- Thuany (supervisor)
WHERE assigned_to = 'c3e8234a-2a1d-445a-a2f4-510ea29b33f7'  -- Filype
  AND created_by = 'c3e8234a-2a1d-445a-a2f4-510ea29b33f7';  -- Eram criadas pelo próprio Filype