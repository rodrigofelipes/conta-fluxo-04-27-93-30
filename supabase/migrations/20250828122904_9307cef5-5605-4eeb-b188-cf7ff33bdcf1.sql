-- Inserir clientes fictícios (sem created_by por enquanto)
INSERT INTO public.clients (name, cpf, email, residential_address, construction_address, indication, birth_date, classification) 
VALUES 
  ('João Silva Santos', '123.456.789-01', 'joao.silva@email.com', 'Rua das Flores, 123 - Centro - São Paulo/SP', 'Av. Paulista, 456 - Bela Vista - São Paulo/SP', 'Indicação do arquiteto Carlos', '1985-03-15', 'cliente'),
  ('Maria Oliveira Costa', '987.654.321-02', 'maria.oliveira@email.com', 'Rua dos Pinheiros, 789 - Pinheiros - São Paulo/SP', 'Rua Augusta, 321 - Consolação - São Paulo/SP', 'Site da empresa', '1990-07-22', 'cliente'),
  ('Carlos Eduardo Lima', '456.789.123-03', 'carlos.lima@email.com', 'Av. Ibirapuera, 1500 - Ibirapuera - São Paulo/SP', 'Rua Oscar Freire, 200 - Jardins - São Paulo/SP', 'Referência de cliente anterior', '1982-11-10', 'cliente'),
  ('Ana Paula Ferreira', '321.654.987-04', 'ana.ferreira@email.com', 'Rua Consolação, 890 - Consolação - São Paulo/SP', 'Av. Faria Lima, 1000 - Itaim Bibi - São Paulo/SP', 'Instagram', '1988-05-18', 'cliente'),
  ('Roberto Construções Ltda', '12.345.678/0001-90', 'contato@roberto.com.br', 'Av. Rebouças, 3000 - Pinheiros - São Paulo/SP', 'Multiple locations', 'Parceria comercial', NULL, 'fornecedor');