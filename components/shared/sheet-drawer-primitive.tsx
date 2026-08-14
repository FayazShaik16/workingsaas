"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface SheetDrawerPrimitiveProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  variant?: "sheet" | "dialog"
  side?: "top" | "right" | "bottom" | "left"
}

export function SheetDrawerPrimitive({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  variant = "sheet",
  side = "right",
}: SheetDrawerPrimitiveProps) {
  if (variant === "dialog") {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="py-4">{children}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="py-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
