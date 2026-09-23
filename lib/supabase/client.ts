import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { sharedCookieOptions } from '@/lib/supabase/cookie-options'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'kaze' }, cookieOptions: sharedCookieOptions }
  )
}
