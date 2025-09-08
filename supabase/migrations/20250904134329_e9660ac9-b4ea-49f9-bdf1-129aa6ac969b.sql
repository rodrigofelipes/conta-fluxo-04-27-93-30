-- Verificar o email na tabela auth.users
SELECT email FROM auth.users WHERE email LIKE '%teste%';

-- Se necessário, podemos atualizar o email na tabela auth.users
-- UPDATE auth.users SET email = 'marateste@gmail.com' WHERE email = 'teste123@gmail.com';