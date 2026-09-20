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
  if (existing) {
    console.log(`Admin ya existe (${ADMIN_EMAIL}) — no se toca.`)
  } else {
    const password = `Kaze-${randomBytes(6).toString('hex')}!`
    const { data, error } = await db.auth.admin.createUser({
      email: ADMIN_EMAIL, password, email_confirm: true,
      user_metadata: { nombre: 'Vento Solutions', iniciales: 'VS' },
    })
    if (error) throw error
    // Ya no hay trigger que cree el profile: lo crea este script. upsert y no insert
    // porque en el proyecto compartido el perfil puede existir ya de una corrida previa.
    const { error: rErr } = await db.from('profiles').upsert({
      id: data.user!.id, nombre: 'Vento Solutions', iniciales: 'VS', rol: 'admin',
    })
    if (rErr) throw rErr
    console.log(`Admin creado: ${ADMIN_EMAIL}`)
    console.log(`CONTRASEÑA TEMPORAL (cámbiala en /cuenta/contrasena): ${password}`)
  }

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
