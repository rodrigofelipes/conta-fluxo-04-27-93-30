-- Limpar registros duplicados em admin_setores
-- Manter apenas o registro mais recente para cada usuário
DELETE FROM admin_setores 
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id 
    FROM admin_setores 
    ORDER BY user_id, created_at DESC
);