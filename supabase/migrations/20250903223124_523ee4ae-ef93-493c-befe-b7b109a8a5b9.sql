-- Adicionar Débora como colaboradora na reunião "Teste 2"
UPDATE agenda 
SET collaborators_ids = array_append(collaborators_ids, 'f0785830-4d6c-4924-8847-533544e9eec7'::uuid)
WHERE titulo = 'Teste 2' AND data = '2025-09-03';