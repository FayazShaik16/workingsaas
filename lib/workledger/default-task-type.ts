import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Resolves or transactionally provisions the default UNSTRUCTURED task type
 * definition for an organization. Guarantees a non-null task_type_id.
 *
 * @param organizationId UUID of the tenant organization
 * @returns UUID string of the task type definition
 */
export async function getOrCreateDefaultTaskType(organizationId: string): Promise<string> {
  const admin = createAdminClient()
  const db = admin as any

  // 1. Try to find existing UNSTRUCTURED task type definition for this organization
  const { data: existing, error: findError } = await db
    .from("task_type_definitions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("category", "UNSTRUCTURED")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!findError && existing?.id) {
    return existing.id
  }

  // 2. Insert default UNSTRUCTURED task type definition using canonical columns
  const payload = {
    organization_id: organizationId,
    category: "UNSTRUCTURED",
    key: "DEFAULT_UNSTRUCTURED",
    label: "Unstructured Initiative",
    field_schema: [],
    verification_mode: "LEAD_AUDIT",
    requires_peer_review: false,
    default_credit_value: 1.0,
    is_active: true,
  }

  const { data: inserted, error: insertError } = await db
    .from("task_type_definitions")
    .insert(payload)
    .select("id")
    .maybeSingle()

  if (inserted?.id) {
    return inserted.id
  }

  // If insert conflicted or raced, fetch existing
  const { data: fallback, error: fallbackErr } = await db
    .from("task_type_definitions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("category", "UNSTRUCTURED")
    .limit(1)
    .maybeSingle()

  if (fallback?.id) {
    return fallback.id
  }

  console.error("[getOrCreateDefaultTaskType] failed to resolve task type:", insertError || fallbackErr)
  throw new Error("Unable to resolve default task type definition for organization.")
}
