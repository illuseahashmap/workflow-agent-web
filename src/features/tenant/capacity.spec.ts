import { describe, expect, it } from 'vitest'
import { capacityError } from './capacity'

describe('capacity input boundaries', () => {
  const limits = { outstanding: 100, active: 4, calls: 8 }
  it('allows inheritance only on tenant overrides', () => {
    expect(capacityError({ outstanding: null, active: null, calls: null }, limits, true)).toBe('')
    expect(capacityError({ outstanding: null, active: 1, calls: 1 }, limits, false)).not.toBe('')
  })
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 9])(
    'rejects invalid call quota %s',
    (calls) => {
      expect(capacityError({ outstanding: 10, active: 1, calls }, limits, true)).not.toBe('')
    },
  )
  it('accepts exact platform limits', () => expect(capacityError(limits, limits, false)).toBe(''))
})
