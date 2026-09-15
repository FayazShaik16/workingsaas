import { getSessionUser, hasScope } from "@/lib/auth/session"
import { getFilteredTransactionLogs, generateTransactionsCSV, TransactionPeriodFilter } from "@/lib/workledger/transactions-export"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scopes = user.scopeLevels || []
    if (!hasScope(scopes, "DIRECTOR") && !hasScope(scopes, "SYSTEM_ADMIN") && !hasScope(scopes, "FINANCE_ADMIN")) {
      return NextResponse.json({ error: "Forbidden: Executive role required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get("format") || "json"
    const period = (searchParams.get("period") || "this_month") as TransactionPeriodFilter
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const deptId = searchParams.get("deptId") || undefined
    const creditType = searchParams.get("creditType") || "ALL"
    const searchQuery = searchParams.get("searchQuery") || undefined

    const result = await getFilteredTransactionLogs(user.organizationId, {
      period,
      startDate,
      endDate,
      deptId,
      creditType,
      searchQuery,
    })

    if (format === "csv") {
      const csvData = generateTransactionsCSV(result.transactions)
      const dateTag = new Date().toISOString().slice(0, 10)
      return new NextResponse(csvData, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="organization_transactions_${dateTag}.csv"`,
        },
      })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[director/transactions/export] error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
