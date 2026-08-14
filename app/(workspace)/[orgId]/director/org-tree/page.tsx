"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, GitBranch, Shield, ZoomIn, ZoomOut, Maximize2, User, Building, Search, Copy, Check, Trash2, X } from "lucide-react"

export default function OrgTreePage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [units, setUnits] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])

  // Search and view states
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState(false)

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addNodeType, setAddNodeType] = useState<"unit" | "member">("unit")

  // Inspector Form State
  const [inspectorName, setInspectorName] = useState("")
  const [inspectorEmployeeId, setInspectorEmployeeId] = useState("")
  const [inspectorDesignation, setInspectorDesignation] = useState("")
  const [inspectorUnitId, setInspectorUnitId] = useState("")
  const [inspectorRoleId, setInspectorRoleId] = useState("")
  const [inspectorWalletAddress, setInspectorWalletAddress] = useState("")
  const [inspectorPermissions, setInspectorPermissions] = useState<Record<string, boolean>>({})

  // Add Node Form State
  const [newUnitName, setNewUnitName] = useState("")
  const [newUnitType, setNewUnitType] = useState("DEPARTMENT")
  const [newUnitParentId, setNewUnitParentId] = useState("")

  const [newMemberName, setNewMemberName] = useState("")
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [newMemberEmployeeId, setNewMemberEmployeeId] = useState("")
  const [newMemberDesignation, setNewMemberDesignation] = useState("")
  const [newMemberUnitId, setNewMemberUnitId] = useState("")
  const [newMemberRoleId, setNewMemberRoleId] = useState("")
  const [newMemberWallet, setNewMemberWallet] = useState("")

  useEffect(() => {
    loadData()
  }, [orgId, supabase])

  const loadData = async () => {
    try {
      if (!orgId) return
      setLoading(true)

      // 1. Fetch organizational units
      const { data: unitsData } = await supabase
        .from("org_units")
        .select("*")
        .eq("organization_id", orgId)
      setUnits(unitsData || [])

      // 2. Fetch users
      const { data: usersData } = await supabase
        .from("users")
        .select(`
          *,
          user_roles(role_id, roles(name, scope_level))
        `)
        .eq("organization_id", orgId)
      
      const formattedUsers = (usersData || []).map((u: any) => ({
        ...u,
        role: u.user_roles?.[0]?.roles || null,
        roleId: u.user_roles?.[0]?.role_id || ""
      }))
      setUsers(formattedUsers)

      // 3. Fetch organization roles
      const { data: rolesData } = await supabase
        .from("roles")
        .select("*")
        .eq("organization_id", orgId)
      setRoles(rolesData || [])

      // 4. Fetch permissions seed
      const { data: permissionsData } = await supabase
        .from("permissions")
        .select("*")
      setPermissions(permissionsData || [])

      // Set initial selected member
      if (formattedUsers.length > 0 && !selectedMemberId) {
        handleSelectMember(formattedUsers[0])
      }
    } catch (err) {
      console.error("Failed to load hierarchy data:", err)
      setError("Failed to load organization hierarchy.")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectMember = async (member: any) => {
    setSelectedMemberId(member.id)
    setInspectorName(member.name || "")
    setInspectorEmployeeId(member.employee_id || "")
    setInspectorDesignation(member.designation || "")
    setInspectorUnitId(member.org_unit_id || "")
    setInspectorRoleId(member.roleId || "")

    // Fetch user wallet
    const { data: walletData } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("owner_user_id", member.id)
      .eq("purpose", "PERSONAL")
      .single()
    setInspectorWalletAddress(walletData?.id || "No Wallet Provisioned")

    // Fetch user permission overrides
    const { data: overrides } = await supabase
      .from("permission_overrides")
      .select("permission_id, is_allowed")
      .eq("user_id", member.id)

    const initialPermissions: Record<string, boolean> = {}
    permissions.forEach((p) => {
      const match = overrides?.find((o) => o.permission_id === p.id)
      initialPermissions[p.id] = match ? match.is_allowed : false
    })
    setInspectorPermissions(initialPermissions)
  }

  const handleSaveChanges = async () => {
    if (!selectedMemberId) return
    setError(null)
    setSuccess(null)
    setActionLoading(true)

    try {
      // 1. Update user primary details
      const { error: userError } = await supabase
        .from("users")
        .update({
          name: inspectorName,
          employee_id: inspectorEmployeeId,
          designation: inspectorDesignation,
          org_unit_id: inspectorUnitId || null,
        })
        .eq("id", selectedMemberId)

      if (userError) throw userError

      // 2. Update role mapping if changed
      if (inspectorRoleId) {
        // Delete old role maps
        await supabase.from("user_roles").delete().eq("user_id", selectedMemberId)
        // Add new role map
        await supabase.from("user_roles").insert({
          user_id: selectedMemberId,
          role_id: inspectorRoleId
        })
      }

      // 3. Update permission overrides
      for (const [permId, isChecked] of Object.entries(inspectorPermissions)) {
        await supabase.from("permission_overrides").upsert({
          user_id: selectedMemberId,
          permission_id: permId,
          is_allowed: isChecked
        })
      }

      setSuccess("Changes saved successfully!")
      await loadData()
    } catch (err) {
      setError("Failed to save changes: " + (err instanceof Error ? err.message : ""))
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddNode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setActionLoading(true)

    try {
      if (addNodeType === "unit") {
        if (!newUnitName.trim()) throw new Error("Unit name is required")
        const { error: insertError } = await supabase
          .from("org_units")
          .insert({
            organization_id: orgId,
            name: newUnitName.trim(),
            unit_type: newUnitType,
            parent_id: (newUnitParentId && newUnitParentId !== "none") ? newUnitParentId : null,
          })
        if (insertError) throw insertError
        setSuccess(`Department unit "${newUnitName}" created.`)
      } else {
        if (!newMemberName.trim() || !newMemberEmail.trim()) {
          throw new Error("Name and Email are required")
        }

        // Mock generate a UUID for the user profile
        const userUuid = crypto.randomUUID()
        const { error: userError } = await supabase
          .from("users")
          .insert({
            id: userUuid,
            organization_id: orgId,
            name: newMemberName,
            email: newMemberEmail,
            employee_id: newMemberEmployeeId || null,
            designation: newMemberDesignation || null,
            org_unit_id: newMemberUnitId || null,
            status: "ACTIVE"
          })
        
        if (userError) throw userError

        if (newMemberRoleId) {
          await supabase.from("user_roles").insert({
            user_id: userUuid,
            role_id: newMemberRoleId
          })
        }

        // Provision a mock personal wallet id
        await supabase.from("wallets").insert({
          organization_id: orgId,
          owner_user_id: userUuid,
          purpose: "PERSONAL",
          balance: 0
        })

        setSuccess(`Member "${newMemberName}" added successfully.`)
      }

      // Reset forms
      setNewUnitName("")
      setNewUnitParentId("")
      setNewMemberName("")
      setNewMemberEmail("")
      setNewMemberEmployeeId("")
      setNewMemberDesignation("")
      setNewMemberUnitId("")
      setNewMemberRoleId("")
      setNewMemberWallet("")
      setShowAddModal(false)

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add node")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedMemberId) return
    if (!confirm("Are you sure you want to remove this member from the organization?")) return
    setError(null)
    setSuccess(null)
    setActionLoading(true)

    try {
      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("id", selectedMemberId)

      if (deleteError) throw deleteError

      setSuccess("Member removed successfully.")
      setSelectedMemberId(null)
      await loadData()
    } catch (err) {
      setError("Failed to remove member.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(inspectorWalletAddress)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  // Sibling auto-collapse toggle
  const toggleUnit = (unitId: string) => {
    if (expandedUnitId === unitId) {
      setExpandedUnitId(null)
    } else {
      setExpandedUnitId(unitId)
    }
  }

  // Filtered members by search queries
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    return (u.name?.toLowerCase().includes(q) || 
            u.email?.toLowerCase().includes(q) || 
            u.employee_id?.toLowerCase().includes(q) ||
            u.designation?.toLowerCase().includes(q))
  })

  // Find top level director (first user with DIRECTOR role, or fallback)
  const topDirector = users.find(u => u.role?.scope_level === "DIRECTOR") || users[0]

  return (
    <div className="space-y-6 p-8 min-h-screen bg-linear-to-b from-background to-muted/20">
      
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground/90">Organization Hierarchy</h1>
          <p className="text-muted-foreground font-light mt-1">
            Build and audit departments, supervisors, credentials, and ledger access parameters.
          </p>
        </div>
      </div>

      {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl border border-destructive/20">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Institution Structure */}
        <Card className="lg:col-span-2 rounded-2xl border border-muted/80 bg-background/50 backdrop-blur-xs shadow-xs flex flex-col h-[700px]">
          <div className="p-5 border-b flex items-center justify-between gap-4 shrink-0">
            <h2 className="text-lg font-light text-foreground/90">Institution Structure</h2>
            <div className="flex items-center gap-3 w-72">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl h-9"
                />
              </div>
              <Button size="sm" onClick={() => setShowAddModal(true)} className="rounded-xl flex items-center gap-1 shrink-0">
                <Plus className="h-4 w-4" /> Add Node
              </Button>
            </div>
          </div>

          {/* Tree View Canvas */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Top Leader Node */}
            {topDirector && (
              <div className="flex flex-col items-center">
                <div 
                  onClick={() => handleSelectMember(topDirector)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 w-96 cursor-pointer hover:shadow-md ${
                    selectedMemberId === topDirector.id 
                      ? "border-primary bg-primary/5 ring-3 ring-primary/10" 
                      : "border-muted bg-background/80"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
                    {topDirector.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <span className="font-light text-foreground/90 block truncate">{topDirector.name}</span>
                    <span className="text-xs text-muted-foreground font-light">{topDirector.role?.name || "Director"}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Active</Badge>
                </div>

                {/* Vertical tree link line down */}
                <div className="w-[1px] h-8 bg-muted-foreground/30 border-dashed border-l" />
              </div>
            )}

            {/* Department tree folder lists */}
            <div className="max-w-2xl mx-auto space-y-4">
              {units.map((unit) => {
                const isExpanded = expandedUnitId === unit.id
                const deptMembers = filteredUsers.filter(u => u.org_unit_id === unit.id)
                
                return (
                  <div key={unit.id} className="space-y-2">
                    {/* Collapsible Department Folder */}
                    <div 
                      onClick={() => toggleUnit(unit.id)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 cursor-pointer hover:bg-muted/40 ${
                        isExpanded ? "border-primary bg-muted/20" : "border-muted bg-background/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Building className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-light text-sm text-foreground/95">{unit.name}</span>
                      </div>
                      <Badge variant="secondary" className="font-light text-[10px] rounded-md">
                        {deptMembers.length} {deptMembers.length === 1 ? "member" : "members"}
                      </Badge>
                    </div>

                    {/* Leaf node members list inside department */}
                    {isExpanded && (
                      <div className="pl-6 border-l-2 border-muted-foreground/20 ml-5 space-y-2 py-1 animate-in fade-in duration-200">
                        {deptMembers.length === 0 ? (
                          <div className="text-xs text-muted-foreground pl-4 py-2 font-light">No members in this unit.</div>
                        ) : (
                          deptMembers.map((m) => (
                            <div 
                              key={m.id}
                              onClick={() => handleSelectMember(m)}
                              className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-2xs ${
                                selectedMemberId === m.id 
                                  ? "border-primary bg-primary/5 shadow-2xs" 
                                  : "border-muted/60 bg-background/40"
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-secondary/80 text-secondary-foreground flex items-center justify-center font-medium text-xs">
                                {m.name?.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="text-left flex-1 min-w-0">
                                <span className="text-xs font-light text-foreground/90 block truncate">{m.name}</span>
                                <span className="text-[10px] text-muted-foreground font-light">{m.designation || m.role?.name || "Member"}</span>
                              </div>
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        {/* RIGHT COLUMN: Member Details / Inspector */}
        <div className="space-y-6">
          {selectedMemberId ? (
            (() => {
              const activeMember = users.find(u => u.id === selectedMemberId)
              if (!activeMember) return null

              return (
                <Card className="rounded-2xl border border-muted/80 bg-background/50 backdrop-blur-xs shadow-sm flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xl shadow-xs">
                        {activeMember.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left flex-1">
                        <CardTitle className="text-xl font-light text-foreground/90">{activeMember.name}</CardTitle>
                        <CardDescription className="font-light mt-0.5">{activeMember.designation || "No Designation"}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Primary fields */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={inspectorName}
                          onChange={(e) => setInspectorName(e.target.value)}
                          className="rounded-xl h-9"
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="empId">Employee ID</Label>
                        <Input
                          id="empId"
                          value={inspectorEmployeeId}
                          onChange={(e) => setInspectorEmployeeId(e.target.value)}
                          className="rounded-xl h-9"
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="designation">Designation</Label>
                        <Input
                          id="designation"
                          value={inspectorDesignation}
                          onChange={(e) => setInspectorDesignation(e.target.value)}
                          className="rounded-xl h-9"
                          disabled={actionLoading}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="dept">Department</Label>
                        <Select value={inspectorUnitId} onValueChange={setInspectorUnitId} disabled={actionLoading}>
                          <SelectTrigger id="dept" className="rounded-xl h-9">
                            <SelectValue placeholder="Unassigned / Root" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="role">Role</Label>
                        <Select value={inspectorRoleId} onValueChange={setInspectorRoleId} disabled={actionLoading}>
                          <SelectTrigger id="role" className="rounded-xl h-9">
                            <SelectValue placeholder="Assign organizational role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>{r.name} ({r.scope_level})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Wallet Address</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={inspectorWalletAddress}
                            readOnly
                            className="bg-muted/50 rounded-xl h-9 font-mono text-xs"
                          />
                          <Button size="icon" variant="outline" onClick={handleCopyWallet} className="rounded-xl h-9 w-9 shrink-0">
                            {copiedAddress ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Permission list checkboxes */}
                    <div className="space-y-3 pt-3 border-t">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Access Permissions</Label>
                      {permissions.map((p) => (
                        <div key={p.id} className="flex items-start gap-3 py-1">
                          <input
                            type="checkbox"
                            id={p.id}
                            checked={inspectorPermissions[p.id] || false}
                            onChange={(e) => {
                              setInspectorPermissions((prev) => ({
                                ...prev,
                                [p.id]: e.target.checked
                              }))
                            }}
                            disabled={actionLoading}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                          />
                          <div className="grid gap-1.5 leading-none">
                            <label htmlFor={p.id} className="text-xs font-light text-foreground/90 cursor-pointer">
                              {p.description || `${p.scope}.${p.action}`}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-4 border-t gap-3">
                      <Button variant="outline" onClick={() => handleSelectMember(activeMember)} disabled={actionLoading} className="rounded-xl flex-1">
                        Reset
                      </Button>
                      <Button onClick={handleSaveChanges} disabled={actionLoading} className="rounded-xl flex-1 shadow-xs">
                        {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                      </Button>
                    </div>

                    <Button variant="outline" onClick={handleRemoveMember} disabled={actionLoading} className="w-full rounded-xl border-destructive/30 hover:bg-destructive/10 text-destructive mt-2">
                      <Trash2 className="h-4 w-4 mr-2" /> Remove Member
                    </Button>

                  </CardContent>
                </Card>
              )
            })()
          ) : (
            <Card className="rounded-2xl border border-muted/80 bg-background/50 backdrop-blur-xs p-6 text-center text-muted-foreground font-light">
              Select a node or member in the structure to view and manage details.
            </Card>
          )}
        </div>

      </div>

      {/* Add Node Popup Dialog Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md rounded-2xl shadow-xl border bg-background animate-in zoom-in duration-150">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-light text-lg">Add New Structure Node</h3>
              <Button size="icon" variant="ghost" onClick={() => setShowAddModal(false)} className="rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <form onSubmit={handleAddNode}>
              <CardContent className="p-6 space-y-4">
                
                <div className="flex border-b pb-4 mb-4 gap-4">
                  <button
                    type="button"
                    onClick={() => setAddNodeType("unit")}
                    className={`flex-1 pb-2 text-center text-sm font-medium border-b-2 transition-all ${
                      addNodeType === "unit" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                    }`}
                  >
                    Department/Unit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddNodeType("member")}
                    className={`flex-1 pb-2 text-center text-sm font-medium border-b-2 transition-all ${
                      addNodeType === "member" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                    }`}
                  >
                    Team Member
                  </button>
                </div>

                {addNodeType === "unit" ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="newUnitName">Unit Name</Label>
                      <Input
                        id="newUnitName"
                        placeholder="e.g. Mechanical Engineering"
                        value={newUnitName}
                        onChange={(e) => setNewUnitName(e.target.value)}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="newUnitType">Unit Type</Label>
                      <Select value={newUnitType} onValueChange={setNewUnitType}>
                        <SelectTrigger id="newUnitType" className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DEPARTMENT">Department</SelectItem>
                          <SelectItem value="TEAM">Team</SelectItem>
                          <SelectItem value="DIVISION">Division</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="newUnitParent">Parent Unit (Optional)</Label>
                      <Select value={newUnitParentId} onValueChange={setNewUnitParentId}>
                        <SelectTrigger id="newUnitParent" className="rounded-xl">
                          <SelectValue placeholder="Root / None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 h-[400px] overflow-y-auto pr-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="mName">Full Name</Label>
                      <Input
                        id="mName"
                        placeholder="e.g. Dr. Jyothi"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mEmail">Email Address</Label>
                      <Input
                        id="mEmail"
                        type="email"
                        placeholder="e.g. jyothi@institution.edu"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mEmpId">Employee ID</Label>
                      <Input
                        id="mEmpId"
                        placeholder="e.g. EMP-2026-042"
                        value={newMemberEmployeeId}
                        onChange={(e) => setNewMemberEmployeeId(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mDesignation">Designation</Label>
                      <Input
                        id="mDesignation"
                        placeholder="e.g. Assistant Professor"
                        value={newMemberDesignation}
                        onChange={(e) => setNewMemberDesignation(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mDept">Department</Label>
                      <Select value={newMemberUnitId} onValueChange={setNewMemberUnitId}>
                        <SelectTrigger id="mDept" className="rounded-xl">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mRole">Role</Label>
                      <Select value={newMemberRoleId} onValueChange={setNewMemberRoleId}>
                        <SelectTrigger id="mRole" className="rounded-xl">
                          <SelectValue placeholder="Choose role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="rounded-xl flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={actionLoading} className="rounded-xl flex-1 shadow-xs">
                    {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

    </div>
  )
}
