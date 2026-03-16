import { useState, useEffect } from 'react'

export type CountdownStatus =
  | { type: 'overdue' }
  | { type: 'hours'; hours: number; minutes: number }
  | { type: 'days'; days: number }
  | { type: 'far' }
  | null

export function getCountdown(dateStr: string | null): CountdownStatus {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()

  if (diffMs < 0) return { type: 'overdue' }

  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays  = diffMs / (1000 * 60 * 60 * 24)

  if (diffHours < 24) {
    const hours   = Math.floor(diffHours)
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return { type: 'hours', hours, minutes }
  }

  const days = Math.ceil(diffDays)
  if (days <= 3) return { type: 'days', days }

  return { type: 'far' }
}

export function useCountdown(dateStr: string | null): CountdownStatus {
  const [status, setStatus] = useState<CountdownStatus>(() => getCountdown(dateStr))

  useEffect(() => {
    if (!dateStr) return
    setStatus(getCountdown(dateStr))

    const interval = setInterval(() => {
      setStatus(getCountdown(dateStr))
    }, 60_000) // atualiza a cada minuto

    return () => clearInterval(interval)
  }, [dateStr])

  return status
}

export function formatCountdown(status: CountdownStatus): string {
  if (!status) return ''
  if (status.type === 'overdue') return 'Atrasado!'
  if (status.type === 'hours') {
    if (status.hours === 0) return `${status.minutes}min`
    return status.minutes > 0 ? `${status.hours}h ${status.minutes}min` : `${status.hours}h`
  }
  if (status.type === 'days') return `${status.days} dia${status.days > 1 ? 's' : ''}`
  return ''
}

export function countdownColor(status: CountdownStatus): string {
  if (!status || status.type === 'far') return ''
  if (status.type === 'overdue')
    return 'bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
  if (status.type === 'hours')
    return 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400'
  if (status.type === 'days' && status.days === 1)
    return 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400'
  if (status.type === 'days' && status.days === 2)
    return 'bg-yellow-50 border-yellow-200 text-yellow-600 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-400'
  // 3 dias
  return 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400'
}
