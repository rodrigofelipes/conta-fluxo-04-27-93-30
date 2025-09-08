-- Adicionar coluna value_percentage à tabela project_phases para armazenar a porcentagem do valor do projeto
ALTER TABLE project_phases 
ADD COLUMN IF NOT EXISTS value_percentage NUMERIC DEFAULT 0 NOT NULL;

-- Adicionar comentário para documentar a coluna
COMMENT ON COLUMN project_phases.value_percentage IS 'Porcentagem do valor total do projeto alocada para esta fase (0-100)';

-- Criar índice para melhor performance nas consultas por projeto
CREATE INDEX IF NOT EXISTS idx_project_phases_project_id_order 
ON project_phases(project_id, order_index);