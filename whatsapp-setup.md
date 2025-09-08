# Configuração WhatsApp Business API

## Quando você conseguir o token do WhatsApp, siga estes passos:

### 1. Adicionar Secrets no Supabase
Você precisará adicionar esses secrets:
- `WHATSAPP_ACCESS_TOKEN` - Token de acesso do WhatsApp Business API
- `WHATSAPP_VERIFY_TOKEN` - Token para verificação do webhook (pode ser qualquer string que você definir)

### 2. Configurar Webhook no WhatsApp
No painel do WhatsApp Business API, configure o webhook para:
- **URL**: `https://xagbhvhqtgybmzfkcxoa.supabase.co/functions/v1/whatsapp-webhook`
- **Verify Token**: O mesmo valor que você colocar em `WHATSAPP_VERIFY_TOKEN`

### 3. Como Funciona
1. Cliente envia mensagem via WhatsApp
2. WhatsApp envia para nosso webhook
3. Sistema busca cliente pelo telefone na tabela `clientes`
4. Encontra um admin disponível
5. Salva mensagem na tabela `messages` com prefixo `[WhatsApp]`
6. Mensagem aparece no chat do admin em tempo real

### 4. Requisitos
- Cliente precisa estar cadastrado na tabela `clientes` com o telefone correto
- Cliente precisa ter um perfil na tabela `profiles` com o mesmo email
- Pelo menos um admin deve existir no sistema

### 5. Testando
Depois de configurar, você pode testar enviando uma mensagem via WhatsApp para o número vinculado à sua conta Business API.