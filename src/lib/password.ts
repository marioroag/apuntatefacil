// Política de contraseña, espejo en cliente de la del servidor (GoTrue):
// minimum_password_length = 8 y password_requirements = "lower_upper_letters_digits".
// El 8 es el que tiene producción (Mario, sep 2026): el cliente exigía 10 y el
// servidor 8, y dos políticas para la misma contraseña se separan solas.
// El servidor manda; esto es solo para validar y guiar en la UI. El servidor
// además rechaza contraseñas filtradas (HaveIBeenPwned), que no se puede comprobar aquí.
//
// Cada regla se dice de DOS formas y hacen falta las dos, porque se leen en sitios
// distintos: `label` es su nombre en una lista ("Al menos 8 caracteres") y `pide`
// es el trozo que encaja dentro de una frase ("Te falta: 8 caracteres, un
// número"). Con una sola, el medidor tendría que recortar el rótulo a mano y
// acabaría escribiendo la regla por segunda vez en otro fichero.

export const PWD_RULES: { test: (p: string) => boolean; label: string; pide: string }[] = [
  { test: (p) => p.length >= 8, label: 'Al menos 8 caracteres', pide: '8 caracteres' },
  { test: (p) => /[a-z]/.test(p), label: 'Una minúscula', pide: 'una minúscula' },
  { test: (p) => /[A-Z]/.test(p), label: 'Una mayúscula', pide: 'una mayúscula' },
  { test: (p) => /[0-9]/.test(p), label: 'Un número', pide: 'un número' },
]

export function passwordValid(p: string): boolean {
  return PWD_RULES.every((r) => r.test(p))
}

/** Los requisitos en una frase, para el tooltip del campo. Sale de la MISMA lista. */
export const PWD_AYUDA = `Mínimo ${PWD_RULES.map((r) => r.pide).join(', ')}.`
