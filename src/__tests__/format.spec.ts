import { describe, expect, it } from 'vitest'
import { displayValue, formatDuration, joinValues, splitValues } from '@/utils/format'

describe('format utilities', () => {
  it('normalizes comma and line separated targets', () => {
    expect(splitValues('alice, bob\nops，reviewer')).toEqual(['alice', 'bob', 'ops', 'reviewer'])
    expect(joinValues(['alice', 'bob'])).toBe('alice, bob')
  })

  it('formats process duration and structured variables', () => {
    expect(formatDuration(3_661_000)).toBe('1 小时 1 分')
    expect(displayValue({ approved: true })).toBe('{"approved":true}')
  })
})
