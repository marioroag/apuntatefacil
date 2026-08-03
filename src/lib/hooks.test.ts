import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

// El guardián de los hooks.
//
// Vigila UNA sola regla de eslint, `react-hooks/rules-of-hooks`, y lo hace desde
// los tests porque `npm run lint` no está en el gate: hoy arrastra ~99 avisos
// heredados de subir eslint-plugin-react-hooks a la 7.x (reglas nuevas del React
// Compiler, contra código que ya estaba escrito), así que ponerlo entero en rojo
// no vigilaría nada. Esta sí: es la única cuya violación no es estilo, es una
// pantalla en blanco.
//
// Qué rompe. El número de hooks de un componente montado no puede cambiar entre
// renders. Un `return` temprano con hooks por debajo lo hace depender de una
// condición; si esa condición cambia con el componente montado, React lanza
// "Rendered more hooks than during the previous render" y la pantalla se cae,
// con el error a kilómetros de la línea que lo causa.
//
// Ya pasó: Entrevistas cortaba por plan (`planHas(company?.plan, ...)`) en mitad
// del componente, con un comentario encima pidiendo que todos los hooks quedaran
// por encima del corte. El comentario aguantó hasta que un `useMemo` se coló por
// debajo. La forma correcta es la que tiene ahora: el corte en un componente sin
// hooks, y el cuerpo en otro que solo se monta cuando ya hay permiso.
describe('el guardián de los hooks', () => {
  it('ningún componente cambia de hooks según una condición', async () => {
    const eslint = new ESLint({
      // Solo esta regla: las demás son otra conversación y no pueden tumbar esta.
      overrideConfig: { rules: { 'react-hooks/rules-of-hooks': 'error' } },
    })
    const results = await eslint.lintFiles(['src/**/*.{ts,tsx}'])
    const fallos = results.flatMap((r) =>
      r.messages
        .filter((m) => m.ruleId === 'react-hooks/rules-of-hooks')
        .map((m) => `  ${r.filePath.split('/src/')[1]}:${m.line}  ${m.message.split('\n')[0]}`),
    )

    expect(
      fallos,
      `Hooks llamados de forma condicional:\n${fallos.join('\n')}\n\n` +
        `Un componente montado tiene que llamar SIEMPRE los mismos hooks y en el mismo ` +
        `orden. Casi siempre esto es un \`return\` temprano (un corte por plan, por rol o ` +
        `por carga) con hooks por debajo. No lo arregles subiendo el \`return\`: eso vuelve ` +
        `a colarse en cuanto alguien añada un useMemo al final. Parte el componente en dos, ` +
        `uno que decide y otro que pinta, y que el que pinta no tenga ningún corte (mira ` +
        `\`Entrevistas\` / \`Agenda\` en src/screens/Entrevistas.tsx).`,
    ).toEqual([])
  }, 60_000)
})
