# Como fazer Deploy no Vercel

## Opção 1: Pelo navegador (mais fácil)

### Passo 1: Criar conta

1. Vai no site https://vercel.com
2. Clica em **Sign Up**
3. Escolhe **Continue with GitHub** (ou Google)
4. Se não tiver GitHub, cria uma conta em https://github.com signup
5. Faz login com GitHub

### Step 2: Importar projeto

1. Depois de logged in, clica em **Add New...** → **Project**
2. Clica em **Import Project**
3. Se o projeto está no seu GitHub, seleciona o repositório
4. Se não tem no GitHub, clica em **Continue** e arrasta a pasta `fluxo-caixa` do seu computador
5. O Vercel vai fazer upload automatico

### Step 3: Configurar variáveis

1. No projeto, vai na aba **Settings**
2. Clica em **Environment Variables**
3. Adiciona:

| Variável | Valor |
|----------|-------|
| NEXT_PUBLIC_SUPABASE_URL | https://ecyflusfzmlieinvzoix.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjeWZsdXNmem1saWVpbnZ6b2l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjU4NTIsImV4cCI6MjA5MjIwMTg1Mn0.xLqCkDstcTdBeFh698OwQf3nppePmnr42EeYe7SV1CE |
| JWT_SECRET | fluxo-caixa-secret-key-2024-fixo |

4. Clica em **Save**

### Step 4: Redeploy

1. Vai na aba **Deployments**
2. Clica no último deployment
3. Clica em **Redeploy**

---

## Opção 2: Por linha de comando

Se preferir usar o terminal:

```
npm i -g vercel
vercel login   # só se já tiver conta Vercel
vercel
```

Responde as perguntas e pronto!