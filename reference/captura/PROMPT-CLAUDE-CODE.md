# Prompt de arranque para Claude Code

Descomprime el paquete en la raíz del repo (`C:\Users\pauld\dev\cota`). Deben quedar
`docs/superpowers/specs/2026-09-24-kaze-captura-procesos-design.md` y `reference/captura/`. Después abre
Claude Code en esa carpeta y pega esto:

```
Vamos a integrar a Kaze el módulo de Captura de procesos (BPMN), que construí como prototipo con Claude
en Cowork. Repo: C:\Users\pauld\dev\cota.

1. Lee AGENTS.md y docs/superpowers/START-HERE.md, y verifica git log + git status (rama main, origin
   github.com/pauldv-coder/Kaze).

2. Lee el spec docs/superpowers/specs/2026-09-24-kaze-captura-procesos-design.md y
   reference/captura/README.md. El spec reemplaza al del diagramador (2026-07-26). El prototipo de
   reference/captura/prototipo/ es la especificación de comportamiento: ábrelo (kaze-captura.html) y lee
   su código antes de diseñar nada. Los escenarios de aceptación están en reference/captura/ESCENARIOS.md.

3. Primer commit: el spec y reference/captura/ tal como están
   ("docs: spec y referencia del módulo de captura de procesos"). No hagas push sin preguntarme.

4. Antes de escribir el plan, pregúntame:
   a) si cerramos primero las T11–T14 del plan de SSO o avanzamos con este módulo;
   b) si confirmo las decisiones de §1.3 del spec (sin SMTP, sin IA, documento jsonb, Word generado en el
      navegador) y lo que quieras ajustar de §4–§7.
   Lo de §1.2 son decisiones mías: no las re-litigues.

5. Con eso, escribe el plan con superpowers:writing-plans en
   docs/superpowers/plans/<fecha>-kaze-captura-procesos.md, siguiendo las fases F0–F8 del spec (§11),
   con tareas pequeñas y TDD, y ejecútalo con superpowers:subagent-driven-development: un subagente por
   tarea, TODO en primer plano (nunca run_in_background).

6. Porta, no rediseñes: la lógica pura del prototipo va casi línea por línea a TypeScript en lib/captura/,
   con tests que comparen contra reference/captura/ejemplos/. El copy en español ya está revisado conmigo.

7. Reglas del repo que más pesan aquí (AGENTS.md):
   - Todo en el esquema kaze (nada en public).
   - Migraciones con timestamp al nivel superior de supabase/migrations/.
   - Sin triggers sobre auth.users. RLS con kaze.es_miembro(). Tests de RLS con miembro, no-miembro y anon.
   - selectAllRows con count 'exact' (techo de 1000 filas). .order() con desempate.
   - Fechas en America/Bogota.
   - Tailwind v4 sin tailwind.config.
   - proxy.ts, no middleware.ts. Lee node_modules/next/dist/docs antes de escribir código de Next 16.
   - Archivos UTF-8 sin BOM. En bash, rutas /c/Users/...

8. Seguridad (§4.2 y §6.5 del spec, todo con tests):
   - La clave de servicio va solo en código de servidor (server-only).
   - La evidencia de aprobación y el número de versión solo se escriben con funciones SQL del servidor;
     los miembros solo los leen, y esas funciones no se pueden llamar por RPC.
   - La única ruta pública nueva es /aprobar/[token].
   - No toques lib/supabase/cookie-options.ts (es idéntico en los tres repos).
   - Nunca corras scripts/seed.ts contra producción.

9. Push a main = deploy a producción. Coordina conmigo cada push y cada `npx supabase db push` al
   proyecto compartido nrysdnavawyhaqgruunl. No introduzcas contraseñas ni pegues claves: eso lo hago yo.

10. Si `npm run lint` falla por archivos de reference/, dímelo y agrego "reference/**" a globalIgnores (un
    hook no te deja editar eslint.config.mjs).

11. Antes de trabajar en local: Docker Desktop encendido y `npx supabase start` (puertos 553xx; no toques
    los contenedores *_loro). Al cerrar cada fase, actualiza START-HERE.md.
```

## Material de apoyo que no está en el repo

- **Sistema de diseño publicado:** https://claude.ai/artifact/3LyHmwsvk4aUQuzUYARCTY. Es privado; Claude
  Code no lo abre, así que la copia de `reference/captura/sistema-de-diseno/` es la que cuenta.
- **Prototipo publicado:** https://claude.ai/artifact/JoaKmksLwYtmrDWkeiLsej. Es la misma versión que
  `reference/captura/prototipo/kaze-captura.html`.
