# Deploy a producción (Vercel)

Guía para publicar el frontend de Kaze en Vercel, apuntando al proyecto Supabase
alojado que ya está en producción.

## Prerequisito

- Cuenta en [Vercel](https://vercel.com).
- Supabase de producción ya está listo: URL `https://kvjpxnswvlxzxdzgycbh.supabase.co`,
  esquema (3 migraciones) + seed de 3 casos ya desplegados y verificados. No hace
  falta tocar la base de datos para este deploy.

## Variables de entorno en Vercel

En el proyecto de Vercel: **Settings → Environment Variables**. Agregar ambas para
**Production** (y también **Preview**, si vas a usar preview deployments):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kvjpxnswvlxzxdzgycbh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | el `anon`/`public` key del dashboard: **Project Settings → API** |

> ⚠️ **NUNCA** setear `SUPABASE_SERVICE_ROLE_KEY` en Vercel. Esa key solo la usa
> el script de seed local (`scripts/seed.ts`) y los tests — tiene permisos de
> administrador y no debe existir en el host del frontend.

El build y el runtime de la app **solo** leen esas dos variables `NEXT_PUBLIC_*`
(ver `lib/supabase/server.ts`, `client.ts` y `lib/supabase/middleware.ts`). No hay
ninguna otra variable de entorno requerida.

## Camino A — recomendado: CI/CD por push (GitHub → Vercel)

1. Crear el repo en GitHub (con `gh repo create` o desde la web).
2. Conectar el remoto y pushear:
   ```bash
   git remote add origin <url-del-repo>
   git push -u origin master
   ```
3. En Vercel: **Add New Project → Import** ese repositorio. El framework
   (Next.js) se detecta automáticamente — no hace falta configurar build
   command ni output directory.
4. Configurar las dos variables de entorno de la tabla anterior.
5. **Deploy.**

A partir de ahí, cada push a `master` redespliega automáticamente.

## Camino B — rápido, sin GitHub (Vercel CLI)

```bash
npm i -g vercel        # o usar npx vercel sin instalar global
vercel login
vercel                 # primer deploy (preview); responde los prompts:
                        #   scope, link a proyecto nuevo, framework = Next.js
vercel --prod           # promueve a producción
```

Para las variables de entorno con la CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

(o cargarlas desde el dashboard del proyecto, igual que en el Camino A).

## Post-deploy en Supabase (dashboard del proyecto alojado)

Estos pasos son necesarios porque el `config.toml` local **no aplica** al
proyecto alojado — hay que replicarlos a mano en el dashboard:

1. **Authentication → URL Configuration**:
   - **Site URL**: el dominio que asignó Vercel (ej. `https://kaze.vercel.app`
     o el dominio custom).
   - **Redirect URLs**: agregar ese mismo dominio (necesario para los flujos
     de email — reset de password, invitaciones, etc.).
2. **Authentication → Sign In / Providers**: desactivar **"Allow new users to
   sign up"**. El modelo de Kaze es solo-por-invitación (los usuarios los crea
   el seed / un admin), igual que en local (`enable_signup = false`).

## Verificación post-deploy

1. Abrir el dominio de Vercel → debe redirigir a `/login` (usuario no
   autenticado, vía `proxy.ts`).
2. Entrar con `carmen@cota.test` → debe redirigir a `/proyectos` y listar los
   3 A3 sembrados: **A3-014, A3-012, A3-030**.

## Nota sobre la contraseña

El login de producción usa la contraseña que se sembró con la variable
`SEED_PASSWORD` al correr el seed contra el proyecto alojado — **no** es la
contraseña de demo local (`cota-demo-2026`). Rótala después del primer login.
