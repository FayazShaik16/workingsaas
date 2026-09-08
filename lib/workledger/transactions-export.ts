import { createAdminClient } from "@/lib/supabase/admin"

export type TransactionPeriodFilter =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "last_90_days"
  | "all"
  | "custom"

export interface TransactionFilterOptions {
  period?: TransactionPeriodFilter
  startDate?: string
  endDate?: string
  deptId?: string
  creditType?: string
  searchQuery?: string
}

export interface TransactionRecord {
  id: string
  createdAt: string
  monthStart: string
  facultyId: string
  facultyName: string
  facultyEmail: string
  departmentId: string
  departmentName: string
  creditType: string
  amount: number
  reason: string
  sourceEntityType: string
  sourceEntityId: string
  approverName?: string
  idempotencyKey: string
}

export interface TransactionsExportResult {
  summary: {
    totalTransactions: number
    totalTokensDisbursed: number
    uniqueFacultyCount: number
    departmentCount: number
  }
  transactions: TransactionRecord[]
}

/**
 * Fetch filtered transaction logs from credit_ledger_entries.
 */
export async function getFilteredTransactionLogs(
  orgId: string,
  filters: TransactionFilterOptions = {}
): Promise<TransactionsExportResult> {
  const admin = createAdminClient()
  const db = admin as any

  const {
    period = "this_month",
    startDate,
    endDate,
    deptId,
    creditType = "ALL",
    searchQuery = "",
  } = filters

  // 1. Determine date boundaries
  const now = new Date()
  let rangeStart: string | null = null
  let rangeEnd: string | null = null

  switch (period) {
    case "today": {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      rangeStart = d.toISOString()
      break
    }
    case "yesterday": {
      const dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      const dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      rangeStart = dStart.toISOString()
      rangeEnd = dEnd.toISOString()
      break
    }
    case "this_week": {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      rangeStart = d.toISOString()
      break
    }
    case "this_month": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      rangeStart = d.toISOString()
      break
    }
    case "last_month": {
      const dStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const dEnd = new Date(now.getFullYear(), now.getMonth(), 1)
      rangeStart = dStart.toISOString()
      rangeEnd = dEnd.toISOString()
      break
    }
    case "last_90_days": {
      const d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      rangeStart = d.toISOString()
      break
    }
    case "custom": {
      if (startDate) rangeStart = new Date(startDate).toISOString()
      if (endDate) {
        const e = new Date(endDate)
        e.setHours(23, 59, 59, 999)
        rangeEnd = e.toISOString()
      }
      break
    }
    case "all":
    default:
      break
  }

  // 2. Query credit_ledger_entries with joins
  let query = db
    .from("credit_ledger_entries")
    .select(`
      id,
      amount,
      credit_type,
      month_start,
      source_entity_type,
      source_entity_id,
      idempotency_key,
      metadata,
      created_at,
      users:user_id(id, name, email, org_unit_id, org_units:org_unit_id(name)),
      creator:created_by(name)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  if (rangeStart) {
    query = query.gte("created_at", rangeStart)
  }
  if (rangeEnd) {
    query = query.lte("created_at", rangeEnd)
  }
  if (creditType && creditType !== "ALL") {
    query = query.eq("credit_type", creditType)
  }

  const { data: rawEntries } = await query

  // 3. Map & filter by department or search
  const uniqueFacultySet = new Set<string>()
  const uniqueDeptSet = new Set<string>()
  let totalVolume = 0

  const allRecords: TransactionRecord[] = []

  for (const row of rawEntries || []) {
    const user = row.users
    const userDeptId = user?.org_unit_id || ""
    const deptName = user?.org_units?.name || "General / Unassigned"

    if (deptId && deptId !== "ALL" && userDeptId !== deptId) {
      continue
    }

    const facultyName = user?.name || "Faculty Member"
    const facultyEmail = user?.email || ""
    const meta = row.metadata || {}
    const reason = meta.task_title || meta.feedback || row.reason || `Disbursement: ${row.credit_type}`
    const approverName = meta.approver_name || row.creator?.name || "System Automated"

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = facultyName.toLowerCase().includes(q)
      const matchEmail = facultyEmail.toLowerCase().includes(q)
      const matchDept = deptName.toLowerCase().includes(q)
      const matchReason = reason.toLowerCase().includes(q)
      const matchId = row.id.toLowerCase().includes(q)
      if (!matchName && !matchEmail && !matchDept && !matchReason && !matchId) {
        continue
      }
    }

    const amt = Number(row.amount || 0)
    totalVolume += amt
    if (user?.id) uniqueFacultySet.add(user.id)
    if (deptName) uniqueDeptSet.add(deptName)

    allRecords.push({
      id: row.id,
      createdAt: row.created_at,
      monthStart: row.month_start,
      facultyId: user?.id || "",
      facultyName,
      facultyEmail,
      departmentId: userDeptId,
      departmentName: deptName,
      creditType: row.credit_type,
      amount: amt,
      reason,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      approverName,
      idempotencyKey: row.idempotency_key,
    })
  }

  return {
    summary: {
      totalTransactions: allRecords.length,
      totalTokensDisbursed: Number(totalVolume.toFixed(2)),
      uniqueFacultyCount: uniqueFacultySet.size,
      departmentCount: uniqueDeptSet.size,
    },
    transactions: allRecords,
  }
}

/**
 * Generate RFC 4180 compliant CSV string from transaction records.
 */
export function generateTransactionsCSV(transactions: TransactionRecord[]): string {
  const headers = [
    "Transaction ID",
    "Timestamp (UTC)",
    "Work Cycle Month",
    "Faculty Name",
    "Faculty Email",
    "Department",
    "Credit Type",
    "Amount (WORK Tokens)",
    "Reason / Task Source",
    "Approver / Signer",
    "Idempotency Key",
  ]

  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined) return '""'
    const str = String(val).replace(/"/g, '""')
    return `"${str}"`
  }

  const rows = transactions.map((t) => [
    escapeCSV(t.id),
    escapeCSV(t.createdAt),
    escapeCSV(t.monthStart),
    escapeCSV(t.facultyName),
    escapeCSV(t.facultyEmail),
    escapeCSV(t.departmentName),
    escapeCSV(t.creditType),
    t.amount.toFixed(2),
    escapeCSV(t.reason),
    escapeCSV(t.approverName),
    escapeCSV(t.idempotencyKey),
  ])

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
}
