"use client"

import { useState, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, X } from "lucide-react"

interface OrgUnit {
  name: string
  unitType: string
}

interface WizardProps {
  organizationId: string
  onComplete: () => void
}

export function DirectorWizard({ organizationId, onComplete }: WizardProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Org Structure
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([
    { name: "Engineering", unitType: "DEPARTMENT" },
    { name: "Operations", unitType: "DEPARTMENT" },
  ])
  const [newUnitName, setNewUnitName] = useState("")
  const [newUnitType, setNewUnitType] = useState("DEPARTMENT")

  // Step 2: Role Configuration
  const [roles, setRoles] = useState([
    { name: "Department Head", scopeLevel: "ORG_UNIT_LEAD" },
    { name: "Senior Engineer", scopeLevel: "MEMBER" },
    { name: "Engineer", scopeLevel: "MEMBER" },
  ])
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleScope, setNewRoleScope] = useState("MEMBER")

  const addOrgUnit = () => {
    if (!newUnitName.trim()) {
      setError("Unit name is required")
      return
    }
    setOrgUnits([...orgUnits, { name: newUnitName, unitType: newUnitType }])
    setNewUnitName("")
    setError(null)
  }

  const removeOrgUnit = (index: number) => {
    setOrgUnits(orgUnits.filter((_, i) => i !== index))
  }

  const addRole = () => {
    if (!newRoleName.trim()) {
      setError("Role name is required")
      return
    }
    setRoles([...roles, { name: newRoleName, scopeLevel: newRoleScope }])
    setNewRoleName("")
    setError(null)
  }

  const removeRole = (index: number) => {
    setRoles(roles.filter((_, i) => i !== index))
  }

  const handleNext = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (step === 1) {
      if (orgUnits.length === 0) {
        setError("Please add at least one organizational unit")
        return
      }
      setStep(2)
    } else if (step === 2) {
      if (roles.length === 0) {
        setError("Please add at least one role")
        return
      }
      setStep(3)
    }
  }

  const handleComplete = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Call API to save org structure
      const response = await fetch("/api/onboarding/director-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          orgUnits,
          roles,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Setup failed")
      }

      onComplete()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Setup failed"
      setError(message)
      console.error("[director-wizard] complete failed:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Step 1: Organization Structure */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Organization Structure</CardTitle>
            <CardDescription>Define your organization&apos;s departments or divisions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>}

            <div className="space-y-4">
              {orgUnits.map((unit, idx) => (
                <div key={idx} className="flex items-center justify-between bg-muted p-3 rounded-md">
                  <div>
                    <p className="font-medium">{unit.name}</p>
                    <p className="text-xs text-muted-foreground">{unit.unitType}</p>
                  </div>
                  <button
                    onClick={() => removeOrgUnit(idx)}
                    className="text-destructive hover:bg-destructive/10 p-1 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t pt-4">
              <Label htmlFor="unitName">Add Organization Unit</Label>
              <div className="flex gap-2">
                <Input
                  id="unitName"
                  placeholder="e.g., Engineering, Sales"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                />
                <select
                  value={newUnitType}
                  onChange={(e) => setNewUnitType(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="DEPARTMENT">Department</option>
                  <option value="TEAM">Team</option>
                  <option value="DIVISION">Division</option>
                </select>
                <Button onClick={addOrgUnit} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button onClick={handleNext} disabled={loading}>
                Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Role Configuration */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Role Configuration</CardTitle>
            <CardDescription>Define roles and their access scopes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>}

            <div className="space-y-4">
              {roles.map((role, idx) => (
                <div key={idx} className="flex items-center justify-between bg-muted p-3 rounded-md">
                  <div>
                    <p className="font-medium">{role.name}</p>
                    <p className="text-xs text-muted-foreground">{role.scopeLevel}</p>
                  </div>
                  <button
                    onClick={() => removeRole(idx)}
                    className="text-destructive hover:bg-destructive/10 p-1 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t pt-4">
              <Label htmlFor="roleName">Add Role</Label>
              <div className="flex gap-2">
                <Input
                  id="roleName"
                  placeholder="e.g., Manager, Lead"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
                <select
                  value={newRoleScope}
                  onChange={(e) => setNewRoleScope(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ORG_UNIT_LEAD">Unit Lead</option>
                  <option value="DIRECTOR">Director</option>
                </select>
                <Button onClick={addRole} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button onClick={() => setStep(1)} variant="outline" disabled={loading}>
                Back
              </Button>
              <Button onClick={handleNext} disabled={loading}>
                Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Complete */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Review & Complete</CardTitle>
            <CardDescription>Review your organization setup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>}

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Organization Units ({orgUnits.length})</h4>
                <ul className="space-y-1 text-sm">
                  {orgUnits.map((unit, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      • {unit.name} ({unit.unitType})
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Roles ({roles.length})</h4>
                <ul className="space-y-1 text-sm">
                  {roles.map((role, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      • {role.name} ({role.scopeLevel})
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button onClick={() => setStep(2)} variant="outline" disabled={loading}>
                Back
              </Button>
              <Button onClick={handleComplete} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Setup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
