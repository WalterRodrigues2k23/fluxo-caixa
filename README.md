# Fluxo de Caixa - Next.js

## Configuração

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Copie o arquivo `.env.local.example` para `.env.local`:
   ```bash
   copy .env.local.example .env.local
   ```
4. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Deploy no Vercel

1. Crie uma conta no [Vercel](https://vercel.com)
2. Instale a CLI do Vercel:
   ```bash
   npm i -g vercel
   ```
3. Execute o deploy:
   ```bash
   vercel
   ```
4. Configure as variáveis de ambiente no dashboard do Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `JWT_SECRET`

## Estrutura do Projeto

- `src/app/api/` - Rotas da API (Next.js API Routes)
- `src/components/` - Componentes React
- `src/lib/` - Configurações e utilitários

## Funcionalidades

- Login e registro de usuários
- Cadastro de transações (entradas/saídas)
- Categorias personalizáveis
- Dashboard com gráficos
- Relatórios