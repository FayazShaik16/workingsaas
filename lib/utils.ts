import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDisplayDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—"
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return "—"
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = months[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

export interface SessionTimingStatus {
  canComplete: boolean
  isUpcoming: boolean
  label: string
}

export function checkSessionTiming(
  workDate: string,
  startTime?: string | null
): SessionTimingStatus {
  if (!workDate) return { canComplete: true, isUpcoming: false, label: "Ready to Complete" }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const todayStr = `${year}-${month}-${day}`

  // 1. If date is in the future
  if (workDate > todayStr) {
    return {
      canComplete: false,
      isUpcoming: true,
      label: `Scheduled for ${workDate}`,
    }
  }

  // 2. If date was in the past
  if (workDate < todayStr) {
    return {
      canComplete: true,
      isUpcoming: false,
      label: "Ready to Complete",
    }
  }

  // 3. Date is today: verify start time has arrived
  if (!startTime) {
    return {
      canComplete: true,
      isUpcoming: false,
      label: "Ready to Complete",
    }
  }

  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()
  const parts = startTime.split(":")
  const startHours = Number(parts[0]) || 0
  const startMinutes = Number(parts[1]) || 0
  const sessionStartTotalMinutes = startHours * 60 + startMinutes

  if (currentTotalMinutes < sessionStartTotalMinutes) {
    const formattedStartTime = `${String(startHours).padStart(2, "0")}:${String(startMinutes).padStart(2, "0")}`
    return {
      canComplete: false,
      isUpcoming: true,
      label: `Starts at ${formattedStartTime}`,
    }
  }

  return {
    canComplete: true,
    isUpcoming: false,
    label: "Ready to Complete",
  }
}

