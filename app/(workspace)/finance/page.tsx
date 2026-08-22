import { requireAuth } from "@/lib/auth/protect"
import { redirect } from "next/navigation"

export default async function LegacyFinanceRedirect() {
  const user = await requireAuth()
  redirect(`/${user.organizationId}/finance`)
}
