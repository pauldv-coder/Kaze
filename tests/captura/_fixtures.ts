// tests/captura/_fixtures.ts  (no termina en .test.ts: Vitest no lo corre)
import { readFileSync } from 'node:fs'
import path from 'node:path'
const EJ = path.resolve(__dirname, '../../reference/captura/ejemplos')
export const leerEjemplo = (n: string) => readFileSync(path.join(EJ, n), 'utf8').replace(/\r\n/g, '\n')
export const semillaPrototipo = () => JSON.parse(leerEjemplo('semilla.json'))
export const grandePrototipo = () => JSON.parse(leerEjemplo('grande.json'))
