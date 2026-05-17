# monJARDIM · Portal de Marca

Portal interativo de identidade de marca. Lê dados do Supabase em tempo real e serve assets do Storage.

## Stack

- **React 18** + **Vite** (frontend)
- **Supabase** (banco Postgres + Storage + Auth)
- **Vercel** (hosting)
- **Sora** (Google Fonts)

## Mudar marca exibida

Edite a constante `BRAND_SLUG` em `src/App.jsx`.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abre em http://localhost:5173

## Deploy

Projeto conectado ao Vercel. Cada commit na branch `main` é auto-deployado.
