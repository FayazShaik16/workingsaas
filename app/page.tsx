import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getRedirectPath } from "@/lib/auth/get-redirect"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function Home() {
  const user = await getSessionUser()
  const workspacePath = user?.organizationId ? getRedirectPath(user) : null

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">WorkLedger</h1>
          <p className="text-xl text-muted-foreground">
            Enterprise Performance & Work-Accountability Platform
          </p>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Token-backed ledger system for salary release eligibility verification
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {workspacePath ? (
            <Link href={workspacePath} className="w-full sm:w-auto">
              <Button size="lg" className="w-full">
                Go to Workspace
              </Button>
            </Link>
          ) : null}
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" variant={workspacePath ? "outline" : "default"} className="w-full">
              Sign In
            </Button>
          </Link>
          <Link href="/accept-invite" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full">
              Accept Invitation
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Returning Users</CardTitle>
              <CardDescription>Already have an account?</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>✓ Sign in with your email</p>
              <p>✓ Access your workspace</p>
              <p>✓ View your tasks & wallet</p>
              <p>✓ Manage your profile</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Members</CardTitle>
              <CardDescription>Got an invitation email?</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>✓ Click the invitation link</p>
              <p>✓ Create your password</p>
              <p>✓ Join your organization</p>
              <p>✓ Start completing work</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
