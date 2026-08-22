import { requireAuth } from "@/lib/auth/protect"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarDays, ArrowRight, ShieldCheck } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LegacyBatchesRedirectPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()

  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto">
      <Card className="border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">
            Academic Batches Module Retired
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1.5">
            WorkLedger has simplified faculty scheduling. Student batch and section structures have been retired in favor of direct session management.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            You can organize all department sessions directly in the Schedule Matrix.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link href={`/${orgId}/dept-admin/schedules`} className="gap-2 text-xs">
                <CalendarDays className="h-4 w-4" />
                <span>Go to Schedule Matrix</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
