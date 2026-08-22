"use client"

import React from "react"

interface CircularProgressRingProps {
  percentage: number | null
  size?: number
  strokeWidth?: number
  className?: string
}

export function CircularProgressRing({
  percentage,
  size = 130,
  strokeWidth = 10,
  className = "",
}: CircularProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const cappedPct = percentage !== null ? Math.min(100, Math.max(0, percentage)) : 0
  const strokeDashoffset = circumference - (cappedPct / 100) * circumference

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-muted/40"
        />
        {/* Progress Value Stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-primary transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center Percentage Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold font-mono text-foreground leading-none">
          {percentage !== null ? `${percentage.toFixed(0)}%` : "0%"}
        </span>
      </div>
    </div>
  )
}
