"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { DirectorWizard } from "@/components/onboarding/director-wizard"
import { Loader2 } from "lucide-react"

export default function DirectorWizardPage() {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any

  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const getOrgId = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData?.user) throw new Error("Not authenticated")

        const { data: user, error: userError } = await db
          .from("users")
          .select("organization_id")
          .eq("id", authData.user.id)
          .single()

        if (userError || !user) throw new Error("User not found")

        setOrganizationId(user.organization_id)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load"
        setError(message)
        console.error("[director-wizard page] load failed:", err)
      } finally {
        setLoading(false)
      }
    }

    getOrgId()
  }, [supabase, db])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !organizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || "Failed to load organization"}</p>
          <button
            onClick={() => router.push("/login")}
            className="text-primary hover:underline font-medium"
          >
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex items-center justify-center py-12">
        <DirectorWizard
          organizationId={organizationId}
          onComplete={() => router.push("/")}
        />
      </div>
    </div>
  )
}
