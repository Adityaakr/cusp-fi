FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_PHASE
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SOLANA_RPC_URL
ARG VITE_MAINNET_RPC_URL
ARG VITE_CUSDC_MINT
ARG VITE_VAULT_USDC_ACCOUNT
ARG VITE_VAULT_PUBLIC_KEY
ARG VITE_TEST_USDC_MINT
ARG VITE_VAULT_PROGRAM_ID
ARG VITE_LEVERAGE_PROGRAM_ID
ARG VITE_DFLOW_WS_URL
ARG VITE_PHANTOM_APP_ID

RUN npm run build

FROM node:20-slim

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js

RUN echo '{"type":"module","dependencies":{"express":"^4.21.0"}}' > package.json && npm install

EXPOSE 3000
CMD ["node", "server.js"]
