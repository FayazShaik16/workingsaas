"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Settings } from "lucide-react"

interface EmptyStatePlaceholderProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  variant?: "default" | "centered"
}

export function EmptyStatePlaceholder({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = "centered",
}: EmptyStatePlaceholderProps) {
  if (variant === "centered") {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            {icon || <FileText className="h-12 w-12 text-muted-foreground" />}
          </div>
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
          {actionLabel && onAction && (
            <Button onClick={onAction} variant="outline" size="sm">
              {actionLabel}
            </Button>
          )}
        </Card>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {icon || <Settings className="h-6 w-6 text-muted-foreground" />}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          {actionLabel && onAction && (
            <Button onClick={onAction} variant="outline" size="sm" className="mt-4">
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
