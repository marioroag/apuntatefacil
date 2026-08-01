#!/usr/bin/env bash
# Recoge las claves de WhatsApp y las deja donde tienen que estar.
#
# Por qué existe: un token de producción NO debe pasar por un chat, ni por un
# commit, ni por una captura. Este script las pide por teclado (sin que se vean
# al escribirlas), y las escribe directamente en el fichero local (que está en
# .gitignore) o las manda a los secrets de Supabase. Nadie más las ve.
#
#   ./scripts/whatsapp-secrets.sh local   -> escribe supabase/functions/.env
#   ./scripts/whatsapp-secrets.sh prod    -> supabase secrets set (proyecto enlazado)
#
# Se puede ejecutar las veces que haga falta: solo cambia lo que rellenes, y
# dejar una respuesta en blanco conserva el valor que ya hubiera.

set -euo pipefail

DESTINO="${1:-}"
if [[ "$DESTINO" != "local" && "$DESTINO" != "prod" ]]; then
  echo "Uso: $0 local|prod" >&2
  exit 1
fi

ENV_FILE="supabase/functions/.env"
if [[ ! -f "$ENV_FILE" && "$DESTINO" == "local" ]]; then
  echo "No encuentro $ENV_FILE. Ejecuta esto desde la raíz del proyecto." >&2
  exit 1
fi

valor_actual() {
  [[ -f "$ENV_FILE" ]] || { echo ""; return; }
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || echo ""
}

# Pide un valor. Con -s no se ve al teclearlo (para tokens y secretos).
pedir() {
  local nombre="$1" ayuda="$2" oculto="${3:-no}" actual nuevo
  actual="$(valor_actual "$nombre")"
  echo
  echo "$nombre"
  echo "  $ayuda"
  if [[ -n "$actual" ]]; then
    if [[ "$oculto" == "si" ]]; then
      echo "  (ya hay uno puesto: ${actual:0:6}...${actual: -4}. Enter para dejarlo)"
    else
      echo "  (ahora: $actual. Enter para dejarlo)"
    fi
  fi
  if [[ "$oculto" == "si" ]]; then
    read -r -s -p "  > " nuevo || true
    echo
  else
    read -r -p "  > " nuevo || true
  fi
  [[ -z "$nuevo" ]] && nuevo="$actual"
  RESPUESTA="$nuevo"
}

escribir_env() {
  local clave="$1" valor="$2"
  [[ -z "$valor" ]] && return
  if grep -qE "^$clave=" "$ENV_FILE"; then
    # Reemplazo con awk para no pelearse con las barras y los signos del token.
    awk -v k="$clave" -v v="$valor" \
      'BEGIN{FS=OFS="="} $1==k {print k "=" v; hecho=1; next} {print} END{if(!hecho) print k "=" v}' \
      "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$clave" "$valor" >> "$ENV_FILE"
  fi
}

declare -a CLAVES=() VALORES=()
recoger() { CLAVES+=("$1"); VALORES+=("$2"); }

echo "=============================================================="
echo " Claves de WhatsApp para $DESTINO"
echo "=============================================================="
echo
echo "Todo esto sale del panel de Meta. Si no sabes de dónde, mira"
echo "docs/whatsapp-meta.md, que lleva el paso a paso con las rutas exactas."

pedir WHATSAPP_PHONE_NUMBER_ID \
  "API de WhatsApp -> Configuración de la API. Es el 'Identificador de número de teléfono'."
recoger WHATSAPP_PHONE_NUMBER_ID "$RESPUESTA"

pedir WHATSAPP_WABA_ID \
  "En la misma pantalla: 'Identificador de la cuenta de WhatsApp Business'."
recoger WHATSAPP_WABA_ID "$RESPUESTA"

pedir WHATSAPP_TOKEN \
  "El token de acceso. Para producción tiene que ser PERMANENTE (usuario del sistema), no el temporal de 24 h." si
recoger WHATSAPP_TOKEN "$RESPUESTA"

pedir WHATSAPP_APP_SECRET \
  "Configuración de la app -> Información básica -> Clave secreta de la aplicación. Firma los webhooks." si
recoger WHATSAPP_APP_SECRET "$RESPUESTA"

pedir WHATSAPP_VERIFY_TOKEN \
  "Una cadena que te inventas tú. La misma que pondrás en Meta al dar de alta el webhook."
recoger WHATSAPP_VERIFY_TOKEN "$RESPUESTA"

pedir INTERVIEW_TICK_SECRET \
  "Otra cadena que te inventas. Protege el latido de la cola. Larga y aleatoria." si
recoger INTERVIEW_TICK_SECRET "$RESPUESTA"

echo
if [[ "$DESTINO" == "local" ]]; then
  for i in "${!CLAVES[@]}"; do escribir_env "${CLAVES[$i]}" "${VALORES[$i]}"; done
  echo "Escrito en $ENV_FILE (que está fuera de git)."
  echo
  echo "Siguiente: reinicia las funciones para que las lean."
  echo "  supabase functions serve --env-file $ENV_FILE"
else
  ARGS=()
  for i in "${!CLAVES[@]}"; do
    [[ -n "${VALORES[$i]}" ]] && ARGS+=("${CLAVES[$i]}=${VALORES[$i]}")
  done
  if [[ ${#ARGS[@]} -eq 0 ]]; then echo "No has puesto nada. No hago nada."; exit 0; fi
  # Los valores van por argumento al CLI, que los manda por HTTPS. No quedan en
  # ningún fichero, pero SÍ en el historial del shell: por eso el aviso de abajo.
  supabase secrets set "${ARGS[@]}"
  echo
  echo "Hecho. Despliega las funciones para que los cojan:"
  echo "  supabase functions deploy interview-tick whatsapp-webhook"
  echo
  echo "Ojo: estos valores han pasado por la línea de comandos. Si tu shell guarda"
  echo "historial, límpialo:  history -c   (zsh: rm -f ~/.zsh_history y reabre)"
fi

echo
echo "Y en la base, el número desde el que escribimos:"
echo "  select public.upsert_whatsapp_sender('<phone_number_id>', '<waba_id>', '<número visible>');"
