import { getSessionUser } from "@/lib/auth/session"
import { getRedirectPath } from "@/lib/auth/get-redirect"
import { LandingPage } from "@/components/landing/landing-page"

export default async function Home() {
  const user = await getSessionUser()
  const workspacePath = user?.organizationId ? getRedirectPath(user) : null

  return (
    <LandingPage
      userSession={{
        organizationId: user?.organizationId || null,
        workspacePath: workspacePath || null,
      }}
    />
  )
}
