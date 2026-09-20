// Bootstrap del admin real + limpieza de usuarios demo. Idempotente.
// USO (producción):
//   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/create-admin.ts
// Sin env explícitas usa .env.local (stack LOCAL) — ahí NO borra demos salvo DELETE_DEMO=yes.
import { config } from 'dotenv'
config({ path: '.env.local' })
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'

const ADMIN_EMAIL = 'info@ventosolutions.ca'
const DEMO_DOMAIN = '@cota.test'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const isProd = !url.includes('127.0.0.1') && !url.includes('localhost')
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  db: { schema: 'kaze' },
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`Target: ${url} (${isProd ? 'PRODUCCIÓN' : 'local'})`)
  const { data: list, error: lErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (lErr) throw lErr

  // 1) admin
  const existing = list.users.find(u => u.email === ADMIN_EMAIL)
  let adminId: string
  if (existing) {
    console.log(`Admin ya existe en auth.users (${ADMIN_EMAIL}) — no se toca la cuenta.`)
    adminId = existing.id
  } else {
    const password = `Kaze-${randomBytes(6).toString('hex')}!`
    const { data, error } = await db.auth.admin.createUser({
      email: ADMIN_EMAIL, password, email_confirm: true,
      user_metadata: { nombre: 'Vento Solutions', iniciales: 'VS' },
    })
    if (error) throw error
    adminId = data.user!.id
    console.log(`Admin creado: ${ADMIN_EMAIL}`)
    console.log(`CONTRASEÑA TEMPORAL (cámbiala en /cuenta/contrasena): ${password}`)
  }

  // La membresía se crea SIEMPRE, exista ya la cuenta o no. En el proyecto compartido
  // info@ventosolutions.ca ya existe en auth.users (está en hub.staff), así que si esto
  // viviera dentro del `else` el admin entraría sin perfil y no vería absolutamente nada:
  // ya no hay trigger que lo cree. upsert para que re-ejecutar el script sea inofensivo.
  const { error: rErr } = await db.from('profiles').upsert({
    id: adminId, nombre: 'Vento Solutions', iniciales: 'VS', rol: 'admin',
  })
  if (rErr) throw rErr
  console.log(`Membresía de Kaze asegurada para ${ADMIN_EMAIL} (rol admin).`)

  // 2) demos
  const demos = list.users.filter(u => u.email?.endsWith(DEMO_DOMAIN))
  if (!isProd && process.env.DELETE_DEMO !== 'yes') {
    console.log(`Local: se conservan ${demos.length} usuarios demo (usa DELETE_DEMO=yes para borrarlos).`)
  } else {
    for (const u of demos) {
      const { error } = await db.auth.admin.deleteUser(u.id)
      if (error) throw error
      console.log(`Demo eliminado: ${u.email}`)
    }
  }
  console.log('Bootstrap OK')
}
main().catch(e => { console.error(e); process.exit(1) })
