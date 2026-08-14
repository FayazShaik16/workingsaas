"use client"

import { DataTablePrimitive } from "@/components/shared/data-table-primitive"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowRight } from "lucide-react"

type TeamMember = {
  id: string
  name: string
  email: string
  scope_levels: string[]
  org_unit_id: string | null
}

interface TeamRosterTableProps {
  teamMembers: TeamMember[]
  orgId: string
}

export function TeamRosterTable({ teamMembers, orgId }: TeamRosterTableProps) {
  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-light text-foreground/90">{row.original.name}</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-sm font-light text-muted-foreground">{row.original.email}</span>,
    },
    {
      accessorKey: "scope_levels",
      header: "Roles",
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {row.original.scope_levels?.map((scope) => (
            <Badge key={scope} variant="secondary" className="text-xs font-light rounded-md px-2 py-0.5">
              {scope}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          asChild
          className="text-primary hover:text-primary/80 transition-colors"
        >
          <a href={`/${orgId}/director/team/${row.original.id}`} className="flex items-center gap-1">
            Manage <ArrowRight className="h-3 w-3" />
          </a>
        </Button>
      ),
    },
  ]

  return (
    <DataTablePrimitive
      columns={columns}
      data={teamMembers}
      pageSize={15}
      searchPlaceholder="Search team members..."
    />
  )
}
