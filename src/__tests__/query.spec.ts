import { describe, expect, it } from 'vitest'
import { areQueryParamsEqual } from '@/utils/query'

describe('areQueryParamsEqual', () => {
  it('treats independently created query objects with the same values as equal', () => {
    expect(
      areQueryParamsEqual(
        { keyword: '', status: undefined, pageNum: 1, pageSize: 20 },
        { keyword: '', status: undefined, pageNum: 1, pageSize: 20 },
      ),
    ).toBe(true)
  })

  it('detects changed values and changed query shapes', () => {
    expect(areQueryParamsEqual({ pageNum: 1 }, { pageNum: 2 })).toBe(false)
    expect(areQueryParamsEqual({ pageNum: 1 }, { pageNum: 1, pageSize: 20 })).toBe(false)
  })
})
