import { requireAuth } from "@/lib/auth/protect"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldCheck, ArrowRight, Calendar } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LegacyMemberLeavePage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()

  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto">
      <Card>
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">
            Leave Surveillance Module Retired
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1.5">
            WorkLedger operates on trust-based delivery. If you are away or swap a class with a colleague, you can complete additional sessions or ad-hoc initiatives across the month to meet your 85% authorization target.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            View your scheduled sessions or discover new initiative tasks from your dashboard.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <Link href={`/${orgId}/member`} className="gap-2 text-xs">
                <Calendar className="h-4 w-4" />
                <span>Go to Member Dashboard</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
