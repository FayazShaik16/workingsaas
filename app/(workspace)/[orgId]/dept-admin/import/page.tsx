import { requireAuth, requireScope } from "@/lib/auth/protect"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Upload, Download } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminImportPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Faculty & Staff Import</h1>
        <p className="text-muted-foreground mt-1">
          Upload CSV spreadsheets to onboard department faculty, designations & weekly hour quotas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> CSV Data Ingestion
          </CardTitle>
          <CardDescription>Upload structured CSV files with headers: name, email, designation, capacity_hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-3 hover:bg-muted/50 transition cursor-pointer">
            <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium">Drag & drop your CSV file here, or browse</p>
              <p className="text-xs text-muted-foreground mt-1">Supports UTF-8 formatted .csv files up to 10MB</p>
            </div>
            <Button size="sm" variant="outline">Select CSV File</Button>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <Download className="h-4 w-4" /> Download Sample CSV Template
            </Button>
            <Button size="sm" disabled>Process Import</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
