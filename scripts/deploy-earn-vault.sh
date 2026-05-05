#!/usr/bin/env bash
set -euo pipefail

# ─── Cusp Earn Vault — Mainnet Deployment & Initialization ───────────────────
#
# Prerequisites:
#   1. solana CLI installed (sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)")
#   2. Funded deployer wallet: solana airdrop doesn't work on mainnet —
#      transfer SOL to the wallet in ~/.config/solana/id.json
#      You need ~3-5 SOL for deployment + init transactions
#   3. cargo-build-sbf installed (comes with solana CLI)
#   4. avm + anchor 0.30.1 installed
#
# Usage:
#   chmod +x scripts/deploy-earn-vault.sh
#   ./scripts/deploy-earn-vault.sh

echo "══════════════════════════════════════════════════════════════"
echo "  Cusp Earn Vault — Mainnet Deployment"
echo "══════════════════════════════════════════════════════════════"
echo ""

# ─── Configuration ───────────────────────────────────────────────────────────

PROGRAM_KEYPAIR="./target/deploy/cusp_earn_vault-keypair.json"
PROGRAM_SO="./target/deploy/cusp_earn_vault.so"

# Mainnet token mints
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT="Es9vMFrzaCERn2QytQkwT4NSr8F3rzA4XB9vNehqWj6q"

# Cluster
CLUSTER="mainnet-beta"
RPC_URL="https://api.mainnet-beta.solana.com"

# ─── Step 0: Preflight checks ────────────────────────────────────────────────

echo "[0/6] Preflight checks..."

DEPLOYER=$(solana config get keypath 2>/dev/null | awk '{print $3}' || echo "$HOME/.config/solana/id.json")
if [ ! -f "$DEPLOYER" ]; then
  echo "ERROR: No wallet found at $DEPLOYER"
  echo "Create one with: solana-keygen new --outfile ~/.config/solana/id.json"
  exit 1
fi

DEPLOYER_PUBKEY=$(solana-keygen pubkey "$DEPLOYER")
BALANCE=$(solana balance --url "$RPC_URL" "$DEPLOYER_PUBKEY" 2>/dev/null | awk '{print $1}')

echo "  Deployer: $DEPLOYER_PUBKEY"
echo "  Balance:  ${BALANCE:-0} SOL"
echo ""

if [ -z "$BALANCE" ] || [ "$(echo "$BALANCE < 2" | bc -l)" -eq 1 ]; then
  echo "WARNING: Deployer has less than 2 SOL. Deployment + init may fail."
  echo "Transfer SOL to $DEPLOYER_PUBKEY and re-run."
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# ─── Step 1: Build ───────────────────────────────────────────────────────────

echo "[1/6] Building cusp-earn-vault program..."
cargo-build-sbf --manifest-path programs/cusp-earn-vault/Cargo.toml --sbf-out-dir target/deploy
echo "  Built: $PROGRAM_SO"
echo ""

# ─── Step 2: Get program ID ──────────────────────────────────────────────────

PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "[2/6] Program ID: $PROGRAM_ID"
echo "  Keypair: $PROGRAM_KEYPAIR"
echo ""

# ─── Step 3: Deploy ──────────────────────────────────────────────────────────

echo "[3/6] Deploying to mainnet..."
echo "  This will cost ~2-4 SOL for program buffer + deployment"
echo ""

# Check if program already exists on-chain
PROGRAM_INFO=$(solana program show --url "$RPC_URL" "$PROGRAM_ID" 2>/dev/null || true)
if [ -n "$PROGRAM_INFO" ]; then
  echo "  Program already deployed. Upgrading..."
  solana program deploy --url "$RPC_URL" \
    "$PROGRAM_SO" \
    --program-id "$PROGRAM_KEYPAIR" \
    --max-len 400000
else
  echo "  First-time deployment. Creating program buffer..."
  solana program deploy --url "$RPC_URL" \
    "$PROGRAM_SO" \
    --program-id "$PROGRAM_KEYPAIR" \
    --max-len 400000
fi

echo "  Deployed successfully!"
echo ""

# ─── Step 4: Initialize vault ───────────────────────────────────────────────
#
# We use `solana program invoke` with Anchor IDL to call initialize.
# Alternatively, use the TypeScript init script (see scripts/init-earn-vault.ts).

echo "[4/6] Initializing vault state + cUSDT mint..."
echo ""
echo "  Run the TypeScript init script instead for reliability:"
echo ""
echo "    npx ts-node scripts/init-earn-vault.ts"
echo ""
echo "  Or call initialize manually with:"

# Derive PDAs for reference
VAULT_STATE=$(solana program show --url "$RPC_URL" --programs "$PROGRAM_ID" 2>/dev/null | head -1 || echo "derive via PDA")
echo ""
echo "  Program:          $PROGRAM_ID"
echo "  Vault State PDA:  derive with seeds=[b'earn-vault']"
echo "  cUSDT Mint PDA:   derive with seeds=[b'cusdt-mint']"
echo "  Vault USDC ATA:   derive with seeds=[b'earn-vault-usdc']"
echo "  USDC Mint:        $USDC_MINT"
echo "  USDT Mint:        $USDT_MINT"
echo ""

# ─── Step 5: Verify ─────────────────────────────────────────────────────────

echo "[5/6] Verifying deployment..."
PROGRAM_DATA=$(solana program show --url "$RPC_URL" "$PROGRAM_ID" 2>/dev/null | head -5 || echo "Not found")
echo "  $PROGRAM_DATA"
echo ""

# ─── Step 6: Print next steps ───────────────────────────────────────────────

echo "[6/6] Next steps:"
echo ""
echo "  1. Run the init script to create vault state + cUSDT mint:"
echo "     npx ts-node scripts/init-earn-vault.ts"
echo ""
echo "  2. Add these to your .env file:"
echo "     VITE_EARN_VAULT_PROGRAM_ID=$PROGRAM_ID"
echo ""
echo "  3. Fund the vault's USDC ATA with initial liquidity (optional):"
echo "     Transfer USDC to the vault's ATA after init"
echo ""
echo "  4. Set up the yield crank (off-chain):"
echo "     - Deposit vault USDC into Kamino Steakhouse vault via REST API"
echo "     - Periodically call sync_yield to update the exchange rate"
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Deployment complete!"
echo "══════════════════════════════════════════════════════════════"