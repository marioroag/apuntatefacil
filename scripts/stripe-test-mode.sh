#!/usr/bin/env bash
# Pone Stripe en modo TEST en producción (secretos de Supabase del proyecto enlazado).
# Pega los valores de TEST de tu dashboard de Stripe (arriba a la izquierda: "Modo de prueba" ON).
# La clave secreta y el secreto del webhook NO se ven al teclear.
#
#   bash scripts/stripe-test-mode.sh
#
# Necesitas (todo de TEST, no mezclar con live):
#  - Clave secreta de test: sk_test_...                (Developers > API keys, en modo test)
#  - Secreto del webhook de test: whsec_...            (Developers > Webhooks, endpoint de test)
#       URL del endpoint: https://qhbatotfhpovxsjirxas.supabase.co/functions/v1/stripe-webhook
#  - 3 IDs de precio de test: price_...                (Products, en modo test)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Stripe -> modo TEST en producción. Pega los valores de TEST (Ctrl+C para cancelar)."
read -rsp "STRIPE_SECRET_KEY (sk_test_...): " SK; echo
read -rsp "STRIPE_WEBHOOK_SECRET de test (whsec_...): " WH; echo
read -rp  "STRIPE_PRICE_ESENCIAL (price_... de test): " PE
read -rp  "STRIPE_PRICE_PRO (price_... de test): " PP
read -rp  "STRIPE_PRICE_MULTI (price_... de test): " PM

# Validaciones para evitar errores tontos
case "$SK" in
  sk_test_*) ;;
  sk_live_*) echo "ESA es una clave LIVE, no test. Aborto."; exit 1 ;;
  *) echo "La clave secreta no parece válida (sk_test_...). Aborto."; exit 1 ;;
esac
[ -n "$WH" ] && [ -n "$PE" ] && [ -n "$PP" ] && [ -n "$PM" ] || { echo "Falta algún valor. Aborto."; exit 1; }

supabase secrets set \
  STRIPE_SECRET_KEY="$SK" \
  STRIPE_WEBHOOK_SECRET="$WH" \
  STRIPE_PRICE_ESENCIAL="$PE" \
  STRIPE_PRICE_PRO="$PP" \
  STRIPE_PRICE_MULTI="$PM"

echo
echo "Hecho. Stripe en modo TEST. Las edge functions usan los nuevos secretos en la próxima llamada (no hace falta redeploy)."
echo "Comprueba con: supabase secrets list  (verás los 'updated_at' al día de hoy)"
