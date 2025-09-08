# Configuração de Email com Resend

Este documento explica como configurar o envio de emails para documentos usando o Resend.

## Pré-requisitos

1. **Conta no Resend**: Crie uma conta em [resend.com](https://resend.com)
2. **Domínio verificado**: Configure um domínio verificado no Resend para envio de emails
3. **Supabase configurado**: Certifique-se de que o Supabase está conectado ao projeto

## Configuração

### 1. Configurar API Key do Resend

A API key do Resend já foi adicionada aos secrets do Supabase. Para configurá-la:

1. Acesse seu dashboard do Resend
2. Vá em "API Keys" e crie uma nova chave
3. A chave será configurada automaticamente nos secrets do Supabase

### 2. Configurar Domínio

1. No arquivo `supabase/functions/send-document-email/index.ts`, linha 82, altere:
   ```typescript
   from: 'documentos@seudominio.com'
   ```
   Para seu domínio verificado no Resend.

### 3. Executar SQL para Tabela de Logs

Execute o arquivo `supabase-setup-email.sql` no seu banco Supabase para criar a tabela de logs de email:

```sql
-- Execute este SQL no Supabase SQL Editor
-- [conteúdo do arquivo supabase-setup-email.sql]
```

## Como Usar

### Na Página de Documentos

1. Acesse a página "Documentos"
2. Na tabela de documentos, clique no botão "Enviar por Email"
3. Preencha os dados do destinatário
4. Clique em "Enviar Email"

### Na Página de Detalhes do Cliente

1. Acesse um cliente específico
2. Na tabela de documentos, clique no ícone de email (✉️)
3. O email e nome do cliente serão pré-preenchidos
4. Adicione uma mensagem personalizada se desejar
5. Clique em "Enviar Email"

## Recursos

- **Links seguros**: Os links de download expiram em 1 hora por segurança
- **Logs de email**: Todos os emails enviados são registrados na tabela `email_logs`
- **Personalização**: Assunto e mensagem podem ser personalizados
- **Pré-preenchimento**: Na página do cliente, email e nome são automaticamente preenchidos

## Troubleshooting

### Erro: "RESEND_API_KEY não configurada"
- Verifique se a API key foi adicionada corretamente nos secrets do Supabase

### Erro: "Documento não encontrado"
- Verifique se o documento existe na tabela `documents`
- Verifique se o arquivo existe no storage `task-files`

### Erro de domínio
- Certifique-se de que o domínio está verificado no Resend
- Use um email válido do domínio verificado no campo `from`

## Estrutura dos Arquivos

- `supabase/functions/send-document-email/index.ts`: Edge function para envio de emails
- `src/components/DocumentEmailDialog.tsx`: Componente do modal de envio
- `src/config/email.ts`: Configurações de email
- `supabase-setup-email.sql`: SQL para criar tabela de logs