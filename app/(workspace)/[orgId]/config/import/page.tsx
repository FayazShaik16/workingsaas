import { requireAuth, requireScope } from "@/lib/auth/protect"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, Upload, Download } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function ConfigImportPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("SYSTEM_ADMIN", "DIRECTOR")

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Bulk Data Import</h1>
        <p className="text-muted-foreground mt-1">
          Import organization structure, departments, roles, and employee records in batch
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Enterprise Data Importer
          </CardTitle>
          <CardDescription>Upload CSV files to populate your organization records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-xl p-8 text-center space-y-3 hover:bg-muted/50 transition cursor-pointer">
            <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium">Drop CSV data file here to import</p>
              <p className="text-xs text-muted-foreground mt-1">Supports users, departments, and task rosters</p>
            </div>
            <Button size="sm" variant="outline">Browse Files</Button>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <Download className="h-4 w-4" /> Download Import Template
            </Button>
            <Button size="sm" disabled>Start Ingestion</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
