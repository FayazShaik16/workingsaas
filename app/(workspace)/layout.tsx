import { requireAuth } from "@/lib/auth/protect"

export const metadata = {
  title: "WorkLedger",
  description: "Enterprise performance and work-accountability platform",
}

export default async function WorkspaceRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Enforce session authentication at the boundary root
  await requireAuth()

  return <>{children}</>
}
