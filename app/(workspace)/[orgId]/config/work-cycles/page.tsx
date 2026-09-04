import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function WorkCyclesRedirectPage({ params }: PageProps) {
  const { orgId } = await params
  redirect(`/${orgId}/config/cycles`)
}
