# PALCO

Plataforma brasileira de musica ao vivo interativa. Uma sala representa um ambiente ou genero e pode ter varios artistas ao vivo; o ouvinte escolhe o artista, assiste a transmissao e interage com chat, pedidos, gorjetas, votos e batalhas.

## Stack

- React 19, Vite e Tailwind CSS
- Supabase Auth, Postgres, Realtime e Edge Functions
- WebRTC para o streaming MVP
- Stripe Checkout para creditos e assinaturas de estabelecimentos
- Vercel para a aplicacao web

## Desenvolvimento

```bash
npm install
cp .env.example .env
npm run dev
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`. Nunca coloque a `service_role` no frontend.

Validacao completa:

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
```

## Supabase

Aplicar migrations:

```bash
npx supabase link --project-ref eqqtvgygdiiqjjlidfnf
npx supabase db push
```

Publicar funcoes:

```bash
npx supabase functions deploy create-checkout
npx supabase functions deploy confirm-checkout
npx supabase functions deploy stripe-webhook
npx supabase functions deploy create-subscription
```

Secrets obrigatorios nas Edge Functions:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL`
- `ALLOWED_ORIGINS`
- `STRIPE_BASIC_PRICE_ID` e `STRIPE_PREMIUM_PRICE_ID` para assinaturas

O webhook Stripe deve apontar para `stripe-webhook` e ouvir `checkout.session.completed` e os eventos `customer.subscription.*`.

## Streaming

O MVP usa WebRTC P2P e garante que o ouvinte seja somente receptor. Para redes restritas, configure as variaveis opcionais de TURN descritas no `.env.example`. Antes de escalar para muitas pessoas simultaneas por artista, o transporte deve migrar para uma SFU como LiveKit; os componentes de sala e interacao podem continuar iguais.

## Administracao

O painel `/admin` valida permissao no banco. A conta master configurada e `felipedosreis2002@gmail.com`. Saques sao debitados ao solicitar e exigem que o administrador confirme manualmente que o PIX foi pago; recusas devolvem o valor ao artista.
