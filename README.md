<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7a88b672-4757-4788-a88c-0b86770519e3

## Run Locally

**Prerequisites:** Node.js

1. `npm install`
2. Copie `.env.example` para `.env` e preencha:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Supabase → Settings → API)
   - `GEMINI_API_KEY` (ou `VITE_GEMINI_API_KEY` se preferir na Vercel)
3. No Supabase, execute o SQL em `supabase/migrations/00001_create_secrets_table.sql` e configure login Google + URLs em Authentication.
4. `npm run dev`

## Deploy (Vercel)

Defina as mesmas variáveis em **Project → Settings → Environment Variables** e inclua a URL de produção nas **Redirect URLs** do Supabase.
