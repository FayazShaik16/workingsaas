import { requireAuth } from "@/lib/auth/protect"
import { redirect } from "next/navigation"

export default async function LegacyLeadRedirect() {
  const user = await requireAuth()
  redirect(`/${user.organizationId}/lead`)
}
