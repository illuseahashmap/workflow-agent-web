import { expect, test, type Page } from '@playwright/test'

async function mockApi(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url())
      let data: unknown = null
      if (url.pathname.endsWith('/auth/me')) {
        data = {
          userId: 'admin-id',
          username: 'admin',
          displayName: '平台管理员',
          tenantCode: 'default',
          roles: ['PLATFORM_ADMIN'],
          permissions: [],
        }
      } else if (url.pathname.endsWith('/auth/tenants')) {
        data = [
          {
            tenantId: 'default',
            tenantCode: 'default',
            tenantName: '默认租户',
            enabled: true,
            current: true,
            roles: ['PLATFORM_ADMIN'],
          },
        ]
      } else if (url.pathname.endsWith('/definitions/page')) {
        data = {
          total: 1,
          pageNum: 1,
          pageSize: 20,
          records: [
            {
              processDefinitionId: 'expense:2:100',
              processDefinitionKey: 'expense_approval',
              processDefinitionName: '费用审批',
              latestVersion: 2,
              latestDeployTime: '2026-08-01T08:00:00+08:00',
              activeVersion: 2,
              publishStatus: 'published',
              tenantId: 'default',
            },
          ],
        }
      } else if (url.pathname.endsWith('/instances/page')) {
        data = {
          total: 1,
          pageNum: 1,
          pageSize: 20,
          records: [
            {
              processInstanceId: 'instance-100',
              processDefinitionName: '费用审批',
              businessKey: 'EXP-2026-001',
              startUserId: 'alice',
              startTime: '2026-08-01T08:00:00+08:00',
              status: 'RUNNING',
            },
          ],
        }
      } else if (url.pathname.endsWith('/node-assignment-rule')) {
        data = { total: 0, pageNum: 1, pageSize: 20, records: [] }
      } else if (url.pathname.endsWith('/tenant')) {
        data = {
          total: 1,
          pageNum: 1,
          pageSize: 20,
          records: [
            {
              id: 1,
              tenantId: 'default',
              tenantCode: 'DEFAULT',
              tenantName: '默认租户',
              enabled: true,
            },
          ],
        }
      } else if (url.pathname.endsWith('/definitions')) {
        data = []
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'SUCCESS', message: 'success', data }),
      })
    },
  )
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      console.error(`console ${message.type()}: ${message.text()}`)
    }
  })
  await page.addInitScript(() => {
    localStorage.setItem(
      'workflow-agent.auth-session',
      JSON.stringify({
        userId: 'admin-id',
        username: 'admin',
        displayName: '平台管理员',
        tenantCode: 'default',
        roles: ['PLATFORM_ADMIN'],
        permissions: [],
        tokenType: 'Bearer',
        accessToken: 'e2e-access-token',
        expiresIn: 3600,
        expiresAt: '2099-01-01T00:00:00Z',
      }),
    )
  })
  await mockApi(page)
})

test('manages process definitions from the workspace', async ({ page }) => {
  await page.goto('/process-definitions')
  await expect(page.getByRole('heading', { name: '流程定义', exact: true })).toBeVisible()
  await expect(page.getByText('费用审批')).toBeVisible()
  await expect(page.getByRole('row', { name: /expense_approval/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建流程' }).first()).toBeVisible()
})

test('creates a plain XML workflow in the BPMN designer', async ({ page }) => {
  await page.goto('/process-definitions')
  await page.getByRole('button', { name: '新建流程' }).first().click()
  const dialog = page.getByRole('dialog', { name: '新建流程' })
  await dialog.getByLabel('流程标识').fill('leave_approval')
  await dialog.getByLabel('流程名称').fill('请假审批')
  await dialog.getByRole('button', { name: '创建并设计' }).click()

  await expect(page).toHaveURL(/process-definitions\/designer/)
  await expect(page.locator('.bpmn-canvas .djs-container')).toBeVisible()
  await expect(page.getByLabel('流程名称')).toHaveValue('请假审批')
  await expect(page.getByText('流程概览', { exact: true })).toBeVisible()
  await expect(page.getByText('版本管理', { exact: true })).toBeVisible()
  await expect(page.getByText('元素配置', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建流程图' })).toBeVisible()
  await expect(page.getByRole('button', { name: '保存新版本' })).toBeVisible()
  const userTaskPaletteEntry = page.locator('.djs-palette .bpmn-icon-user-task')
  await expect(userTaskPaletteEntry).toHaveAttribute('title', '创建用户任务')
  await userTaskPaletteEntry.click()
  await page.locator('.bpmn-canvas').click({ position: { x: 460, y: 260 } })
  await expect(page.getByText('用户任务', { exact: true })).toBeVisible()
  await expect(page.getByText('flowable:candidateUsers', { exact: true })).toHaveCount(0)
  await expect(page.getByText('${assigneeService.getCandidates(execution)}')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/process-designer-desktop.png', fullPage: true })
})

test('navigates across instance, assignment and tenant domains', async ({ page }) => {
  await page.goto('/process-instances')
  await expect(page.getByText('EXP-2026-001')).toBeVisible()
  await page.getByRole('link', { name: '派单规则' }).click()
  await expect(page.getByRole('button', { name: '新增规则' })).toBeVisible()
  await page.getByRole('link', { name: '租户管理' }).click()
  await expect(page.getByRole('row', { name: /默认租户/ })).toBeVisible()
})

test('uses the compact navigation on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/process-definitions')
  await page.getByRole('button', { name: '打开导航' }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: '流程实例' })).toBeVisible()
  await page.getByRole('dialog').getByRole('link', { name: '流程实例' }).click()
  await expect(page.getByRole('heading', { name: '流程实例', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.screenshot({ path: 'test-results/process-instances-mobile.png', fullPage: true })
})
