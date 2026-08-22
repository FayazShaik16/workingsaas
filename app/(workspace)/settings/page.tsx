import { requireAuth } from "@/lib/auth/protect"
import { redirect } from "next/navigation"

export default async function LegacySettingsRedirect() {
  const user = await requireAuth()
  redirect(`/${user.organizationId}/settings`)
}
