#!/usr/bin/env bash
# Pone el plan de la empresa de un usuario (por email) en el Supabase LOCAL.
# Útil en desarrollo para probar features de un plan sin pasar por Stripe.
#
#   scripts/set-plan.sh <email> <trial|esencial|pro|multi>
#   ej: scripts/set-plan.sh mario.rodriguez.aguado@gmail.com multi
#
# Requiere el stack local arrancado (supabase start). Solo afecta a local.
set -euo pipefail

EMAIL="${1:?Falta el email. Uso: scripts/set-plan.sh <email> <plan>}"
PLAN="${2:?Falta el plan. Uso: scripts/set-plan.sh <email> <plan>}"

case "$PLAN" in
  trial|esencial|pro|multi) ;;
  *) echo "Plan no válido: $PLAN (usa trial|esencial|pro|multi)"; exit 1 ;;
esac

CID="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -1)"
if [ -z "$CID" ]; then
  echo "No encuentro el contenedor de Postgres de Supabase. ¿Has hecho 'supabase start'?"
  exit 1
fi

docker exec "$CID" psql -U postgres -v ON_ERROR_STOP=1 -c \
  "update public.companies set plan='$PLAN'
     where id in (
       select m.company_id from public.memberships m
       join auth.users u on u.id = m.user_id
       where u.email = '$EMAIL'
     );"

echo "Listo. Si dice UPDATE 0, esa cuenta aún no tiene empresa: regístrate y haz el onboarding primero."
