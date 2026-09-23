# Deploy a producción (Vercel)

Guía para publicar el frontend de Kaze en Vercel, apuntando al proyecto Supabase
alojado que ya está en producción.

## Prerequisito

- Cuenta en [Vercel](https://vercel.com).
- Supabase de producción ya está listo: URL `https://nrysdnavawyhaqgruunl.supabase.co`
  — proyecto **compartido** con el Vento HUB y el Vento CMS, donde las tablas de Kaze
  viven en el esquema `kaze`. No hace falta tocar la base de datos para este deploy.

## Variables de entorno en Vercel

En el proyecto de Vercel: **Settings → Environment Variables**. Ojo con el **scope** de
cada una: no todas van en Preview.

| Variable | Valor | Scope | Tipo |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nrysdnavawyhaqgruunl.supabase.co` | Production + Preview | Config |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | el `anon`/`public` key del dashboard: **Project Settings → API** | Production + Preview | Config |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.ventosolutions.ca` (**con el punto inicial**) | **solo Production** | Config |

> ⚠️ **`NEXT_PUBLIC_COOKIE_DOMAIN` es lo único que enciende el SSO** entre Kaze, el Vento
> HUB y el Vento CMS: hace que la cookie de sesión se escriba en el dominio apex en vez de
> quedar host-only por subdominio (ver `lib/supabase/cookie-options.ts`, archivo compartido
> byte-idéntico con el HUB y el CMS).
>
> - **Falla en SILENCIO si falta.** El build sale verde, el login funciona y `/proyectos`
>   carga: la cookie simplemente queda host-only y **no hay SSO** — entrar en Kaze no vale
>   para el HUB. No hay error, ni log, ni test que lo detecte. Si el SSO "no hace nada",
>   sospecha de esta variable antes que del código.
> - **Solo en Production, a propósito.** En local no existe, y en los previews
>   (`*.vercel.app`) tampoco debe existir: fuera de producción la cookie tiene que ser
>   host-only o el login se rompe.
> - **Tipo Config, NO Secret.** Una variable `NEXT_PUBLIC_` marcada como Secret queda
>   bloqueada en Vercel y además es ilegible; su valor va inlined en el bundle del
>   navegador de todos modos, así que no hay nada que ocultar.
> - Debe valer **exactamente lo mismo** en las tres apps, y las tres deben apuntar al
>   **mismo proyecto Supabase**: la cookie se llama `sb-<project-ref>-auth-token`, así que
>   con refs distintos la cookie del apex no comparte nada.
> - Al activarla por primera vez, los usuarios con sesión abierta pueden necesitar **un**
>   re-login (las versiones actuales de `@supabase/ssr` limpian la cookie host-only vieja).

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` sí vive en Vercel, pero **solo como variable de
> SERVIDOR** (sin el prefijo `NEXT_PUBLIC_`), en Production y Preview. La usan
> exclusivamente las server actions del módulo admin (`/admin`) vía
> `lib/supabase/admin.ts` (`server-only`) para crear/invitar usuarios y cambiar
> roles. **Nunca** debe quedar como variable pública ni importarse desde código
> de cliente.

El cliente del navegador lee las tres variables `NEXT_PUBLIC_*` de la tabla
(ver `lib/supabase/server.ts`, `client.ts` y `lib/supabase/middleware.ts`: las tres
instanciaciones pasan las mismas `cookieOptions`). La service key es la única variable de
servidor adicional requerida por el módulo admin.

> **Invitar usuarios en producción:** entrar a `/admin` con una cuenta con rol
> `admin`, generar el enlace de invitación y compartirlo por el canal que uses
> (v1 es enlace copiable, sin envío de email por SMTP).

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
4. Configurar las variables de entorno de la tabla anterior (ojo con el scope de
   `NEXT_PUBLIC_COOKIE_DOMAIN`: solo Production).
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
vercel env add NEXT_PUBLIC_COOKIE_DOMAIN production   # valor: .ventosolutions.ca (NO agregarla a preview)
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
2. Entrar con el admin real `info@ventosolutions.ca` → debe redirigir a
   `/proyectos` y listar los 3 A3 sembrados: **A3-014, A3-012, A3-030**.
   (`/admin` debe renderizar solo para este usuario; un consultor es redirigido.)

## Nota sobre usuarios y contraseñas

Los usuarios demo `@cota.test` **fueron eliminados** de producción por
`scripts/create-admin.ts`; el único usuario de producción es el admin real
`info@ventosolutions.ca` (los demás entran por invitación desde `/admin`).
La contraseña temporal del admin se genera al correr ese script — cámbiala en
`/cuenta/contrasena` después del primer login. (El login de demo
`carmen@cota.test` / `cota-demo-2026` solo existe en el stack LOCAL, no en producción.)
