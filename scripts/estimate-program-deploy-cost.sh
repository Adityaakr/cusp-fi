#!/usr/bin/env bash
set -euo pipefail

# Estimate deploy rent for one or more Solana programs using current CLI rent rules.
#
# Usage:
#   chmod +x scripts/estimate-program-deploy-cost.sh
#   ./scripts/estimate-program-deploy-cost.sh
#   PROGRAM_HEADROOM=4096 ./scripts/estimate-program-deploy-cost.sh
#   PROGRAM_HEADROOM=0 ./scripts/estimate-program-deploy-cost.sh

PROGRAM_HEADROOM="${PROGRAM_HEADROOM:-4096}"

PROGRAMS=(
  "cusp_vault"
  "cusp_leverage"
  "cusp_earn_vault"
)

if ! command -v solana >/dev/null 2>&1; then
  echo "ERROR: solana CLI not found in PATH"
  exit 1
fi

echo "══════════════════════════════════════════════════════════════"
echo "  CUSP Program Deploy Cost Estimate"
echo "══════════════════════════════════════════════════════════════"
echo "  Headroom per program: $PROGRAM_HEADROOM bytes"
echo ""

total_rent_sol="0"

for program in "${PROGRAMS[@]}"; do
  program_so="target/deploy/${program}.so"

  if [ ! -f "$program_so" ]; then
    echo "Skipping $program: $program_so not found"
    echo ""
    continue
  fi

  program_size=$(wc -c < "$program_so" | tr -d '[:space:]')
  alloc_size=$((program_size + PROGRAM_HEADROOM))
  rent_output=$(solana rent "$alloc_size")
  rent_sol=$(printf '%s\n' "$rent_output" | awk '/Rent-exempt minimum:/ {print $3}')
  total_rent_sol=$(awk -v a="$total_rent_sol" -v b="$rent_sol" 'BEGIN { printf "%.9f", a + b }')

  echo "$program"
  echo "  Binary size: $program_size bytes"
  echo "  Alloc size:  $alloc_size bytes"
  echo "  Rent:        $rent_sol SOL"
  echo ""
done

echo "Total estimated rent: $total_rent_sol SOL"
echo "Note: add a little extra for transaction fees."

