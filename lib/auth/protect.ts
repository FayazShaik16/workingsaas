import { redirect } from "next/navigation"
import { getSessionUser, hasScope } from "./session"

/**
 * requireAuth
 * Use in Server Components to require authentication
 * Redirects to /login if not authenticated
 */
export async function requireAuth() {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

/**
 * requireScope
 * Require specific scope level (e.g., "DIRECTOR", "ORG_UNIT_LEAD")
 * Redirects to /workspace if insufficient scope
 */
export async function requireScope(...scopes: string[]) {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }

  const hasRequiredScope = scopes.some((scope) => hasScope(user.scopeLevels, scope))
  if (!hasRequiredScope) {
    const { getRedirectPath } = await import("./get-redirect")
    redirect(getRedirectPath(user))
  }

  return user
}

/**
 * requireDirector
 * Shorthand for DIRECTOR or SYSTEM_ADMIN scope
 */
export async function requireDirector() {
  return requireScope("DIRECTOR", "SYSTEM_ADMIN")
}

/**
 * requireLead
 * Shorthand for DIRECTOR, SYSTEM_ADMIN, or ORG_UNIT_LEAD scope
 */
export async function requireLead() {
  return requireScope("DIRECTOR", "SYSTEM_ADMIN", "ORG_UNIT_LEAD")
}
