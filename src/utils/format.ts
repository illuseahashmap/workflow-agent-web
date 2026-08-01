import dayjs from 'dayjs'

export function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'
}

export function formatVersion(value?: number | null) {
  return value === null || value === undefined ? '-' : `第 ${value} 版`
}

export function formatDuration(value?: number | null) {
  if (value === null || value === undefined) return '-'
  const seconds = Math.floor(value / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分 ${seconds % 60} 秒`
  const hours = Math.floor(minutes / 60)
  return `${hours} 小时 ${minutes % 60} 分`
}

export function splitValues(value: string) {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function joinValues(values?: string[]) {
  return values?.join(', ') || ''
}

export function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
