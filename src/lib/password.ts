// Política de contraseña, espejo en cliente de la del servidor (GoTrue):
// minimum_password_length = 10 y password_requirements = "lower_upper_letters_digits".
// El servidor manda; esto es solo para validar y guiar en la UI. El servidor
// además rechaza contraseñas filtradas (HaveIBeenPwned), que no se puede comprobar aquí.

export const PWD_RULES: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 10, label: 'Al menos 10 caracteres' },
  { test: (p) => /[a-z]/.test(p), label: 'Una minúscula' },
  { test: (p) => /[A-Z]/.test(p), label: 'Una mayúscula' },
  { test: (p) => /[0-9]/.test(p), label: 'Un número' },
]

export function passwordValid(p: string): boolean {
  return PWD_RULES.every((r) => r.test(p))
}
