import { requireAuth } from "@/lib/auth/protect"
import { getRedirectPath } from "@/lib/auth/get-redirect"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const user = await requireAuth()
  
  // Auto-redirect to the appropriate role-based B2B SaaS dashboard route
  const redirectPath = getRedirectPath(user)
  redirect(redirectPath)
}
