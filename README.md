# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/0c820cc3-3ae1-4ced-95e7-49572265031a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/0c820cc3-3ae1-4ced-95e7-49572265031a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/0c820cc3-3ae1-4ced-95e7-49572265031a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Configuração do armazenamento no Google Drive

O envio de documentos de clientes agora utiliza o Google Drive. Para que o upload funcione corretamente, configure os itens abaixo:

1. **Credenciais do serviço Google**
   - Crie uma conta de serviço no [Google Cloud Console](https://console.cloud.google.com/).
   - Compartilhe a pasta do Drive (ou drive compartilhado) desejada com o e-mail da conta de serviço.
   - No projeto Supabase, defina a variável de ambiente `GOOGLE_SERVICE_ACCOUNT` com o JSON completo das credenciais da conta de serviço.

2. **Variáveis de ambiente do frontend**
   - `VITE_GOOGLE_DRIVE_ROOT_FOLDER_ID`: ID da pasta no Drive onde os arquivos devem ser gravados (opcional, quando omitido os arquivos ficam na raiz da conta de serviço).
   - `VITE_GOOGLE_DRIVE_TOKEN_CACHE_MS` (opcional): tempo de cache, em milissegundos, para reutilização do token emitido pela conta de serviço (valor padrão: `50000`).

3. **Função Edge no Supabase**
   - Implante a função `google-drive-token` localizada em `supabase/functions/google-drive-token`.
   - Garanta que a função possua acesso à variável `GOOGLE_SERVICE_ACCOUNT` e às permissões de execução adequadas.

Após configurar os itens acima, os uploads e exclusões de documentos passarão a ocorrer diretamente no Google Drive.
