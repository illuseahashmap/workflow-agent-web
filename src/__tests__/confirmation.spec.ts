import { beforeEach, describe, expect, it, vi } from 'vitest'

const { confirm, prompt } = vi.hoisted(() => ({
  confirm: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  prompt: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))

vi.mock('element-plus', () => ({
  ElMessageBox: { confirm, prompt },
}))

import { confirmAction, promptRequired } from '@/utils/confirmation'

describe('confirmation helpers', () => {
  beforeEach(() => {
    confirm.mockReset()
    prompt.mockReset()
  })

  it('returns false only when the user cancels confirmation', async () => {
    confirm.mockRejectedValueOnce('cancel')

    await expect(confirmAction('message', 'title')).resolves.toBe(false)
  })

  it('does not hide confirmation programming failures', async () => {
    const failure = new TypeError('render failed')
    confirm.mockRejectedValueOnce(failure)

    await expect(confirmAction('message', 'title')).rejects.toBe(failure)
  })

  it('returns a trimmed prompt value and treats close as dismissal', async () => {
    prompt.mockResolvedValueOnce({ value: '  maintenance  ' })
    await expect(promptRequired('message', 'title')).resolves.toBe('maintenance')

    prompt.mockRejectedValueOnce({ action: 'close' })
    await expect(promptRequired('message', 'title')).resolves.toBeNull()
  })

  it('does not hide prompt programming failures', async () => {
    const failure = new TypeError('prompt failed')
    prompt.mockRejectedValueOnce(failure)

    await expect(promptRequired('message', 'title')).rejects.toBe(failure)
  })
})
