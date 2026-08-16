export default function WorkspaceLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted/60 rounded-lg" />
        <div className="h-4 w-96 bg-muted/40 rounded-md" />
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 rounded-xl border bg-card/50 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-muted/60 rounded" />
              <div className="h-4 w-4 bg-muted/40 rounded-full" />
            </div>
            <div className="h-7 w-28 bg-muted rounded-md" />
            <div className="h-3 w-36 bg-muted/30 rounded" />
          </div>
        ))}
      </div>

      {/* Main Table / Content Skeleton */}
      <div className="p-6 rounded-xl border bg-card/50 space-y-4">
        <div className="flex justify-between items-center pb-2">
          <div className="space-y-1">
            <div className="h-5 w-48 bg-muted/70 rounded" />
            <div className="h-3 w-64 bg-muted/40 rounded" />
          </div>
          <div className="h-8 w-24 bg-muted/50 rounded-lg" />
        </div>
        <div className="space-y-3 pt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 w-full bg-muted/30 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
