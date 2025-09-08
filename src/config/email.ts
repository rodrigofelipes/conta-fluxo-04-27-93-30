// Email configuration for the application
export const EMAIL_CONFIG = {
  // Configure this with your verified domain in Resend
  fromEmail: 'noreply@yourdomain.com', // Change this to your domain
  
  // Default email templates
  templates: {
    document: {
      getSubject: (documentName: string) => `Novo documento: ${documentName}`,
      getMessage: (recipientName: string, documentName: string, category: string, setor: string, ref?: string) => `
Olá ${recipientName || ''},

Você recebeu um novo documento: ${documentName}

Categoria: ${category}
Setor: ${setor}
${ref ? `Referência: ${ref}` : ''}

Você pode baixar o documento através do link abaixo:
{DOWNLOAD_LINK}

Este link expira em 1 hora por segurança.

Atenciosamente,
Equipe de Documentos
      `.trim()
    }
  }
};