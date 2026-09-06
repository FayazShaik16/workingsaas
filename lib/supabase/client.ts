import { createBrowserClient } from "@supabase/ssr"
import { Database } from "@/lib/database.types"

const DEFAULT_URL = "https://bzgqvwqzbjqpfunnyfwe.supabase.co"
const PLACEHOLDER_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_ANON_KEY

  return createBrowserClient<Database>(url, anonKey)
}

