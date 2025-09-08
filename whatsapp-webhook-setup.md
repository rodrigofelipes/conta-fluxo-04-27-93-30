# Configuração do Webhook WhatsApp

## Pré-requisitos

1. **Conta Meta for Developers**: Acesse https://developers.facebook.com
2. **WhatsApp Business App**: Crie ou configure um app WhatsApp Business
3. **Secrets configurados no Supabase**:
   - `WHATSAPP_API_TOKEN`: Token de acesso da API do WhatsApp
   - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: Token de verificação do webhook (você escolhe este valor)
   - `WHATSAPP_PHONE_NUMBER_ID`: ID do número de telefone do WhatsApp Business

## URL do Webhook

Sua URL do webhook é:
```
https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/whatsapp-webhook
```

## Configuração no Meta for Developers

1. **Acesse o App WhatsApp Business**:
   - Vá para https://developers.facebook.com
   - Selecione seu app WhatsApp Business

2. **Configure o Webhook**:
   - Vá para "WhatsApp" > "Configuration"
   - Na seção "Webhook", clique em "Edit"
   - Cole a URL do webhook: `https://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/whatsapp-webhook`
   - No campo "Verify Token", use o mesmo valor que você configurou na secret `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

3. **Subscrever aos Eventos**:
   - Marque as opções:
     - ✅ messages
     - ✅ message_deliveries (opcional)
     - ✅ message_reads (opcional)

4. **Salvar Configurações**:
   - Clique em "Verify and Save"
   - O Meta irá verificar se o webhook está funcionando

## Teste de Funcionamento

1. **Verificar Logs**:
   - Acesse os logs da edge function em: https://supabase.com/dashboard/project/wcdyxxthaqzchjpharwh/functions/whatsapp-webhook/logs

2. **Enviar Mensagem de Teste**:
   - Envie uma mensagem para o número do WhatsApp Business
   - Verifique se apareceu nos logs e na aba Chat do sistema

3. **Responder Mensagem**:
   - Use a aba Chat para responder
   - Verifique se a mensagem chegou no WhatsApp do cliente

## Problemas Comuns

### Webhook não verifica
- Verifique se o `WHATSAPP_WEBHOOK_VERIFY_TOKEN` está correto
- Confirme se a URL do webhook está acessível

### Mensagens não chegam
- Verifique se o `WHATSAPP_API_TOKEN` está válido
- Confirme se o `WHATSAPP_PHONE_NUMBER_ID` está correto
- Verifique os logs da edge function

### Clientes não aparecem na lista
- Confirme se o cliente tem um número de telefone cadastrado
- Verifique se o número está no formato correto (com código do país)

## Formato de Número de Telefone

Os números devem estar no formato internacional:
- Brasil: `5511999999999` (55 + DDD + número)
- Exemplo: `5511987654321`