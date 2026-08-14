import { createClient } from "@/lib/supabase/server"

/**
 * execute_workflow_transition
 * Core state machine engine - ONLY way to change task/loan status
 * Returns: { success, newState, transitionLogId, errors }
 */
export async function executeWorkflowTransition(
  entityType: "tasks" | "loans",
  entityId: string,
  toState: string,
  actorId: string
) {
  const supabase = await createClient()

  try {
    // 1. Get entity + workflow definition
    const entityTable = entityType === "tasks" ? "tasks" : "loans"
    const { data: entity, error: entityError } = await supabase
      .from(entityTable)
      .select(
        `
        id,
        status,
        organization_id,
        ${entityType === "tasks" ? "task_type_id, task_type_definitions(verification_mode)" : ""}
      `
      )
      .eq("id", entityId)
      .single()

    if (entityError || !entity) throw new Error(`${entityType} not found`)

    // 2. Get workflow definition
    const { data: workflow, error: workflowError } = await supabase
      .from("workflow_definitions")
      .select("*")
      .eq("organization_id", entity.organization_id)
      .eq("entity_type", entityType)
      .eq("is_active", true)
      .single()

    if (workflowError || !workflow) throw new Error("Workflow not found")

    // 3. Get transition rule
    const { data: transition, error: transitionError } = await supabase
      .from("workflow_transitions")
      .select("*, workflow_definitions(id)")
      .eq("workflow_definition_id", workflow.id)
      .eq("from_state", entity.status)
      .eq("to_state", toState)
      .single()

    if (transitionError || !transition) {
      throw new Error(`Invalid transition: ${entity.status} → ${toState}`)
    }

    // 4. Check actor has permission
    const { data: actor, error: actorError } = await supabase
      .from("users")
      .select("user_roles(roles(scope_level))")
      .eq("id", actorId)
      .single()

    if (actorError || !actor) throw new Error("Actor not found")

    const actorScopes = actor.user_roles?.map((ur: any) => ur.roles?.scope_level) || []
    const allowedRoles = transition.allowed_role_scopes || []
    const hasPermission =
      allowedRoles.length === 0 || allowedRoles.some((role: string) => actorScopes.includes(role))

    if (!hasPermission) {
      throw new Error("Insufficient permissions for this transition")
    }

    // 5. Execute transition
    const { error: updateError } = await supabase
      .from(entityTable)
      .update({ status: toState })
      .eq("id", entityId)

    if (updateError) throw updateError

    // 6. Log transition
    const { data: log, error: logError } = await supabase
      .from("workflow_transition_log")
      .insert({
        organization_id: entity.organization_id,
        entity_type: entityType,
        entity_id: entityId,
        from_state: entity.status,
        to_state: toState,
        actor_id: actorId,
        transition_id: transition.id,
      })
      .select()
      .single()

    if (logError) throw logError

    // 7. Trigger business rules (in production, this would call apply_business_rules RPC)
    // For now, we'll keep it simple - this is where token txs, notifications, etc. would fire

    return {
      success: true,
      newState: toState,
      transitionLogId: log.id,
    }
  } catch (error) {
    console.error("[workflow] executeWorkflowTransition failed:", error)
    throw error
  }
}

/**
 * get_valid_transitions
 * Return all valid next states for an entity given its current state and actor scope
 */
export async function getValidTransitions(
  entityType: "tasks" | "loans",
  entityId: string,
  actorId: string
) {
  const supabase = await createClient()

  try {
    // Get entity
    const entityTable = entityType === "tasks" ? "tasks" : "loans"
    const { data: entity, error: entityError } = await supabase
      .from(entityTable)
      .select("organization_id, status")
      .eq("id", entityId)
      .single()

    if (entityError || !entity) throw new Error(`${entityType} not found`)

    // Get actor scope
    const { data: actor, error: actorError } = await supabase
      .from("users")
      .select("user_roles(roles(scope_level))")
      .eq("id", actorId)
      .single()

    if (actorError || !actor) throw new Error("Actor not found")

    const actorScopes = actor.user_roles?.map((ur: any) => ur.roles?.scope_level) || []

    // Get workflow definition
    const { data: workflow, error: workflowError } = await supabase
      .from("workflow_definitions")
      .select("*")
      .eq("organization_id", entity.organization_id)
      .eq("entity_type", entityType)
      .eq("is_active", true)
      .single()

    if (workflowError || !workflow) throw new Error("Workflow not found")

    // Get valid transitions from current state
    const { data: transitions, error: transitionsError } = await supabase
      .from("workflow_transitions")
      .select("*")
      .eq("workflow_definition_id", workflow.id)
      .eq("from_state", entity.status)

    if (transitionsError) throw transitionsError

    // Filter by actor scope
    const validTransitions = transitions.filter((t: any) => {
      const allowedRoles = t.allowed_role_scopes || []
      return (
        allowedRoles.length === 0 || allowedRoles.some((role: string) => actorScopes.includes(role))
      )
    })

    return validTransitions.map((t: any) => t.to_state)
  } catch (error) {
    console.error("[workflow] getValidTransitions failed:", error)
    return []
  }
}
