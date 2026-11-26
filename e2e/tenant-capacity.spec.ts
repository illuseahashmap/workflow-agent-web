import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, admin = true) {
  page.on('console', (message) => {
    if (message.text().includes('Failed to resolve component:')) throw new Error(message.text())
  })
  const user = {
    userId: 'quota-admin',
    username: 'admin',
    displayName: '管理员',
    tenantCode: 'alpha',
    roles: admin ? ['PLATFORM_ADMIN'] : ['TENANT_ADMIN'],
    permissions: ['tenant:manage'],
    tokenType: 'Bearer',
    expiresIn: 3600,
    expiresAt: '2099-01-01T00:00:00Z',
  }
  await page.addInitScript(
    (session) => localStorage.setItem('workflow-agent.auth-session', JSON.stringify(session)),
    user,
  )
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname
      const data = path.endsWith('/auth/me')
        ? user
        : path.endsWith('/auth/csrf')
          ? 'test-csrf'
          : path.endsWith('/auth/tenants')
            ? [
                {
                  tenantCode: 'alpha',
                  tenantId: 'alpha',
                  tenantName: '租户甲',
                  enabled: true,
                  roles: user.roles,
                },
              ]
            : path.endsWith('/workflow/tenant')
              ? {
                  total: 1,
                  pageNum: 1,
                  pageSize: 20,
                  records: [
                    {
                      id: 1,
                      tenantId: 'alpha',
                      tenantCode: 'alpha',
                      tenantName: '租户甲',
                      enabled: true,
                    },
                  ],
                }
              : []
      await route.fulfill({ json: { code: 'SUCCESS', message: 'success', data } })
    },
  )
}
const initial = {
  revision: 0,
  platform: { outstanding: 1000, active: 16, calls: 32 },
  defaults: { outstanding: 100, active: 4, calls: 8 },
  overrides: { outstanding: null, active: null, calls: null },
  effective: { outstanding: 100, active: 4, calls: 8 },
  usage: { outstanding: 3, active: 1, calls: 2 },
}

test('tenant quota inherits, saves overrides, and restores inheritance', async ({ page }) => {
  await setup(page)
  let saved: unknown
  let current = {
    ...initial,
    overrides: { ...initial.overrides } as {
      outstanding: number | null
      active: number | null
      calls: number | null
    },
  }
  await page.route('**/api/agent-runtime/capacity/tenants/alpha', async (route) => {
    if (route.request().method() === 'PUT') {
      const request = route.request().postDataJSON()
      saved = request
      current = {
        ...current,
        revision: current.revision + 1,
        overrides: request.overrides,
        effective: {
          ...current.effective,
          calls: request.overrides.calls ?? initial.defaults.calls,
        },
      }
    }
    await route.fulfill({ json: { code: 'SUCCESS', data: current } })
  })
  await page.goto('/tenants')
  await page.getByRole('button', { name: '资源配额', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('3 / 100')
  await dialog.getByText('继承平台默认（8）').click()
  await dialog.getByRole('spinbutton', { name: '同时外部调用租户上限' }).fill('3')
  await dialog.getByRole('button', { name: '保存配额' }).click()
  await expect(dialog).toBeHidden()
  expect(saved).toEqual({ revision: 0, overrides: { outstanding: null, active: null, calls: 3 } })
  await page.getByRole('button', { name: '资源配额', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('spinbutton', { name: '同时外部调用租户上限' }),
  ).toHaveValue('3')
  await page.getByRole('dialog').getByText('继承平台默认（8）').click()
  await page.getByRole('dialog').getByRole('button', { name: '保存配额' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect(saved).toEqual({
    revision: 1,
    overrides: { outstanding: null, active: null, calls: null },
  })
})

test('platform quota handles stale saves and failed loading without discarding input', async ({
  page,
}) => {
  await setup(page)
  let reads = 0
  await page.route('**/api/agent-runtime/capacity', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 409,
        json: { code: 'CONFLICT', message: '配额已被其他管理员修改，请刷新后重试' },
      })
    } else if (++reads === 1) {
      await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '暂时无法读取' } })
    } else
      await route.fulfill({
        json: { code: 'SUCCESS', data: { ...initial, effective: initial.platform } },
      })
  })
  await page.goto('/tenants')
  await page.getByRole('button', { name: '平台配额', exact: true }).click()
  const dialog = page.getByRole('dialog')
  // Vue Query may automatically retry the initial transient failure.
  await expect(dialog.getByRole('spinbutton', { name: '同时外部调用平台总上限' })).toBeVisible()
  await dialog.getByRole('spinbutton', { name: '同时外部调用平台总上限' }).fill('20')
  await dialog.getByRole('button', { name: '保存配额' }).click()
  await expect(page.getByText('配额已被其他管理员修改，请刷新后重试')).toBeVisible()
  await expect(dialog.getByRole('spinbutton', { name: '同时外部调用平台总上限' })).toHaveValue('20')
})

test('tenant administrators cannot open capacity controls', async ({ page }) => {
  await setup(page, false)
  await page.goto('/tenants')
  await expect(page.getByRole('heading', { name: '租户管理中心' })).toBeVisible()
  await expect(page.getByRole('button', { name: '平台配额', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '资源配额', exact: true })).toHaveCount(0)
})
