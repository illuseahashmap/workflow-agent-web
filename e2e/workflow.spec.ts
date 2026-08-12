import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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
      } else if (url.pathname.endsWith('/auth/csrf')) {
        data = 'e2e-csrf-token'
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
      } else if (url.pathname.endsWith('/process/start')) {
        data = {
          processInstanceId: 'instance-200',
          processDefinitionId: 'expense:2:100',
          processDefinitionKey: 'expense_approval',
          businessKey: 'EXP-2026-002',
          activeTasks: [],
        }
      } else if (url.pathname.endsWith('/process/participant-requirements')) {
        const payload = route.request().postDataJSON() as {
          variables?: Record<string, unknown>
        }
        data =
          payload.variables?.manualParticipants === 'yes'
            ? [
                {
                  activityId: 'managerApproval',
                  activityName: '主管审批',
                  assignmentType: 'ASSIGNEE',
                  multiple: false,
                  required: true,
                },
              ]
            : [
                {
                  activityId: 'managerApproval',
                  activityName: '主管审批',
                  assignmentType: 'ASSIGNEE',
                  multiple: false,
                  required: false,
                },
              ]
      } else if (url.pathname.endsWith('/task/participant-requirements')) {
        data = [
          {
            activityId: 'hrReview',
            activityName: '人事复核',
            assignmentType: 'CANDIDATE_USERS',
            multiple: true,
            required: true,
          },
        ]
      } else if (url.pathname.endsWith('/auth/directory/users')) {
        data = {
          total: 2,
          pageNum: 1,
          pageSize: 10,
          records: [
            { userId: 'admin-id', username: 'admin', displayName: '平台管理员' },
            { userId: 'alice-id', username: 'alice', displayName: '试用用户' },
          ],
        }
      } else if (url.pathname.endsWith('/agent-providers/enabled')) {
        data = [
          {
            id: 31,
            code: 'mock_local',
            name: '本地 Mock',
            type: 'MOCK',
            enabled: true,
            credentialConfigured: false,
          },
        ]
      } else if (url.pathname.endsWith('/agent-providers')) {
        const empty = url.searchParams.get('keyword') === '__empty__'
        data = {
          total: empty ? 0 : 1,
          pageNum: 1,
          pageSize: 20,
          records: empty
            ? []
            : [
                {
                  id: 31,
                  code: 'mock_local',
                  name: '本地 Mock',
                  type: 'MOCK',
                  enabled: true,
                  credentialConfigured: false,
                  createdAt: '2026-08-08T08:00:00+08:00',
                  updatedAt: '2026-08-08T08:00:00+08:00',
                },
              ],
        }
      } else if (url.pathname.endsWith('/agents/published-versions')) {
        data = {
          total: 1,
          pageNum: 1,
          pageSize: 30,
          records: [
            {
              id: 51,
              definitionId: 41,
              agentCode: 'expense_reviewer',
              agentName: '费用审核 Agent',
              version: 1,
              executionMode: 'MODEL_ONLY',
              timeoutSeconds: 120,
              inputSchema: '{"type":"object","properties":{"customer":{"type":"string"}}}',
              outputSchema: '{"type":"object","properties":{"decision":{"type":"string"}}}',
              contractFingerprint: 'test-contract-fingerprint',
            },
          ],
        }
      } else if (url.pathname.endsWith('/agents')) {
        const empty = url.searchParams.get('keyword') === '__empty__'
        data = {
          total: empty ? 0 : 1,
          pageNum: 1,
          pageSize: 20,
          records: empty
            ? []
            : [
                {
                  id: 41,
                  code: 'expense_reviewer',
                  name: '费用审核 Agent',
                  description: '检查费用说明并给出结构化结论',
                  enabled: true,
                  latestVersion: 1,
                  publishedVersion: 1,
                  createdAt: '2026-08-08T08:00:00+08:00',
                  updatedAt: '2026-08-08T08:00:00+08:00',
                },
              ],
        }
      } else if (url.pathname.endsWith('/agent-runs/manual-tests')) {
        data = { runId: 91, status: 'QUEUED' }
      } else if (url.pathname.endsWith('/agent-runs/91')) {
        const run = {
          id: 91,
          agentCode: 'expense_reviewer',
          agentName: '费用审核 Agent',
          agentVersion: 1,
          status: 'SUCCEEDED',
          resultStatus: 'SUCCESS',
          processInstanceId: 'instance-100',
          activityId: 'agentReview',
          deadlineAt: '2026-08-08T08:02:00+08:00',
          startedAt: '2026-08-08T08:00:01+08:00',
          completedAt: '2026-08-08T08:00:03+08:00',
          createdAt: '2026-08-08T08:00:00+08:00',
          updatedAt: '2026-08-08T08:00:03+08:00',
        }
        data = {
          run,
          payload: {
            inputSnapshotJson: '{"input":"审核差旅费用"}',
            outputSnapshotJson: '{"content":"建议通过"}',
          },
          attempts: [
            {
              id: 92,
              attemptNo: 1,
              status: 'SUCCEEDED',
              startedAt: run.startedAt,
              completedAt: run.completedAt,
              createdAt: run.createdAt,
              updatedAt: run.updatedAt,
            },
          ],
          steps: [],
          modelInvocations: [
            {
              id: 94,
              attemptId: 92,
              stepId: 95,
              providerName: '本地 Mock',
              requestedModel: 'mock-model',
              actualModel: 'mock-model',
              status: 'SUCCEEDED',
              inputTokens: 0,
              outputTokens: 0,
              reasoningTokens: 0,
              latencyMillis: 0,
              createdAt: run.createdAt,
              completedAt: run.completedAt,
            },
          ],
          checkpoints: [],
          stateHistory: [
            {
              id: 93,
              attemptId: 92,
              oldStatus: 'RUNNING',
              newStatus: 'SUCCEEDED',
              reasonCode: 'RESULT_ACCEPTED',
              operatorType: 'WORKER',
              operatorId: 'worker-1',
              traceId: 'trace-91',
              createdAt: run.completedAt,
            },
          ],
        }
      } else if (url.pathname.endsWith('/agent-runs')) {
        const empty = url.searchParams.get('keyword') === '__empty__'
        data = {
          total: empty ? 0 : 1,
          pageNum: 1,
          pageSize: 20,
          records: empty
            ? []
            : [
                {
                  id: 91,
                  agentCode: 'expense_reviewer',
                  agentName: '费用审核 Agent',
                  agentVersion: 1,
                  status: 'SUCCEEDED',
                  resultStatus: 'SUCCESS',
                  processInstanceId: 'instance-100',
                  activityId: 'agentReview',
                  deadlineAt: '2026-08-08T08:02:00+08:00',
                  startedAt: '2026-08-08T08:00:01+08:00',
                  completedAt: '2026-08-08T08:00:03+08:00',
                  createdAt: '2026-08-08T08:00:00+08:00',
                  updatedAt: '2026-08-08T08:00:03+08:00',
                },
              ],
        }
      } else if (url.pathname.endsWith('/task/approve')) {
        data = {
          completedTaskId: 'task-200',
          processInstanceId: 'instance-200',
          processEnded: true,
          nextTasks: [],
        }
      } else if (url.pathname.endsWith('/diagram-data')) {
        data = {
          bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
            <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
              xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
              xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
              xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
              targetNamespace="http://workflow-agent.local">
              <process id="expense_approval" isExecutable="true">
                <startEvent id="start"><outgoing>flow1</outgoing></startEvent>
                <userTask id="managerApproval" name="主管审批">
                  <incoming>flow1</incoming><outgoing>flow2</outgoing>
                </userTask>
                <endEvent id="end"><incoming>flow2</incoming></endEvent>
                <sequenceFlow id="flow1" sourceRef="start" targetRef="managerApproval" />
                <sequenceFlow id="flow2" sourceRef="managerApproval" targetRef="end" />
              </process>
              <bpmndi:BPMNDiagram id="diagram">
                <bpmndi:BPMNPlane id="plane" bpmnElement="expense_approval">
                  <bpmndi:BPMNShape id="start_di" bpmnElement="start">
                    <dc:Bounds x="120" y="120" width="36" height="36" />
                  </bpmndi:BPMNShape>
                  <bpmndi:BPMNShape id="manager_di" bpmnElement="managerApproval">
                    <dc:Bounds x="220" y="98" width="100" height="80" />
                  </bpmndi:BPMNShape>
                  <bpmndi:BPMNShape id="end_di" bpmnElement="end">
                    <dc:Bounds x="380" y="120" width="36" height="36" />
                  </bpmndi:BPMNShape>
                  <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
                    <di:waypoint x="156" y="138" /><di:waypoint x="220" y="138" />
                  </bpmndi:BPMNEdge>
                  <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
                    <di:waypoint x="320" y="138" /><di:waypoint x="380" y="138" />
                  </bpmndi:BPMNEdge>
                </bpmndi:BPMNPlane>
              </bpmndi:BPMNDiagram>
            </definitions>`,
          completedActivityIds: ['start'],
          activeActivityIds: ['managerApproval'],
          highlightedFlows: ['flow1'],
          activityDetails: {},
        }
      } else if (url.pathname.endsWith('/instance/detail')) {
        data = {
          instance: {
            processInstanceId: 'instance-200',
            processDefinitionId: 'expense:2:100',
            processDefinitionKey: 'expense_approval',
            processDefinitionName: '费用审批',
            businessKey: 'EXP-2026-002',
            startUserId: 'admin',
            startTime: '2026-08-02T08:00:00+08:00',
            status: 'RUNNING',
            tenantId: 'default',
          },
          tasks: [
            {
              taskId: 'task-200',
              taskDefinitionKey: 'managerApproval',
              taskName: '主管审批',
              assignee: 'admin',
              candidateUsers: [],
              candidateGroups: [],
              status: 'RUNNING',
              startTime: '2026-08-02T08:00:00+08:00',
            },
          ],
          variables: [],
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
      } else if (url.pathname.endsWith('/definition')) {
        data = {
          processDefinitionId: 'expense:2:100',
          processDefinitionKey: 'expense_approval',
          processDefinitionName: '费用审批',
          version: 2,
          deploymentId: 'deployment-100',
          deployedAt: '2026-08-01T08:00:00+08:00',
          tenantId: 'default',
          active: true,
          bpmnXml: `<?xml version="1.0"?>
            <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
              xmlns:flowable="http://flowable.org/bpmn">
              <process id="expense_approval">
                <startEvent id="start" />
                <userTask id="managerApproval" name="主管审批"
                  flowable:assignee="\${assigneeService.getAssignee(execution)}" />
              </process>
            </definitions>`,
        }
      } else if (url.pathname.endsWith('/definitions')) {
        data = [
          {
            processDefinitionId: 'expense:2:100',
            processDefinitionKey: 'expense_approval',
            processDefinitionName: '费用审批',
            version: 2,
            deploymentId: 'deployment-100',
            deployedAt: '2026-08-01T08:00:00+08:00',
            tenantId: 'default',
            active: true,
            bpmnXml: '<?xml version="1.0"?><definitions />',
          },
        ]
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

test('keeps the process definition workspace accessible', async ({ page }) => {
  await page.goto('/process-definitions')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('heading', { name: '流程定义', exact: true })).toBeVisible()
  await expect(page.locator('.el-select__input[aria-label="发布状态"]')).toHaveCount(1)
  const accessibilityScan = await new AxeBuilder({ page }).analyze()
  expect(accessibilityScan.violations).toEqual([])
})

test('manages process definitions from the workspace', async ({ page }) => {
  await page.goto('/process-definitions')
  await expect(page.getByRole('heading', { name: '流程定义', exact: true })).toBeVisible()
  await expect(page.getByText('费用审批')).toBeVisible()
  await expect(page.getByRole('row', { name: /expense_approval/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '新建流程' }).first()).toBeVisible()

  await page.getByRole('button', { name: '发起', exact: true }).click()
  const startDialog = page.getByRole('dialog', { name: '发起流程' })
  await expect(startDialog.getByText(/费用审批.*第 2 版/)).toBeVisible()
  await startDialog.getByLabel('业务标识').fill('EXP-2026-002')
  await startDialog.getByRole('button', { name: '发起流程' }).click()
  await expect(page).toHaveURL(/process-instances\/instance-200/)

  await page.getByRole('tab', { name: '任务 (1)' }).click()
  await page.getByRole('button', { name: '同意' }).click()
  const decisionDialog = page.getByRole('dialog', { name: '同意任务' })
  await expect(decisionDialog.getByText('人事复核')).toBeVisible()
  await decisionDialog.getByRole('button', { name: '选择参与人' }).click()
  const picker = page.getByRole('dialog', { name: '为“人事复核”选择参与人' })
  await picker.getByRole('button', { name: /平台管理员.*admin/ }).click()
  await picker.getByRole('button', { name: '确认选择' }).click()
  const approveRequest = page.waitForRequest(
    (request) => request.url().endsWith('/workflow/task/approve') && request.method() === 'POST',
  )
  await decisionDialog.getByRole('button', { name: '确认同意' }).click()
  const payload = (await approveRequest).postDataJSON()
  expect(payload).toMatchObject({
    taskId: 'task-200',
    currentAssignee: 'admin',
    participantAssignments: [{ activityId: 'hrReview', usernames: ['admin'] }],
  })
  await expect(page.getByText('任务已同意')).toBeVisible()
  await expect(page.locator('.tracking-canvas')).toHaveCount(0)
  await page.getByRole('tab', { name: '流程跟踪' }).click()
  await expect(
    page.locator('.tracking-canvas .djs-element[data-element-id="managerApproval"]'),
  ).toBeVisible()
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

test('selects participants without exposing Flowable variable names', async ({ page }) => {
  await page.goto('/process-definitions')
  await page.getByRole('button', { name: '发起', exact: true }).click()
  const startDialog = page.getByRole('dialog', { name: '发起流程' })
  await startDialog.getByRole('button', { name: '添加变量' }).click()
  await startDialog.getByPlaceholder('例如 amount').fill('manualParticipants')
  await startDialog.getByPlaceholder('输入文本').fill('yes')

  await expect(startDialog.getByText('参与人设置')).toBeVisible()
  await expect(startDialog.getByText('主管审批')).toBeVisible()
  await expect(startDialog.getByText(/_assignee/)).toHaveCount(0)
  await startDialog.getByRole('button', { name: '选择参与人' }).click()

  const picker = page.getByRole('dialog', { name: '为“主管审批”选择参与人' })
  await picker.getByRole('button', { name: /试用用户.*alice/ }).click()
  await picker.getByRole('button', { name: '确认选择' }).click()

  const startRequest = page.waitForRequest(
    (request) => request.url().endsWith('/workflow/process/start') && request.method() === 'POST',
  )
  await startDialog.getByRole('button', { name: '确认发起' }).click()
  const payload = (await startRequest).postDataJSON()
  expect(payload.participantAssignments).toEqual([
    { activityId: 'managerApproval', usernames: ['alice'] },
  ])
})

test('allows a ruled process to fall back when no participant is specified', async ({ page }) => {
  await page.goto('/process-definitions')
  await page.getByRole('button', { name: '发起', exact: true }).click()
  const startDialog = page.getByRole('dialog', { name: '发起流程' })

  await expect(startDialog.getByText('可选指定')).toBeVisible()
  await expect(startDialog.getByText('未指定，将使用派单规则')).toBeVisible()

  const startRequest = page.waitForRequest(
    (request) => request.url().endsWith('/workflow/process/start') && request.method() === 'POST',
  )
  await startDialog.getByRole('button', { name: '确认发起' }).click()
  const payload = (await startRequest).postDataJSON()
  expect(payload.participantAssignments).toEqual([])
})

test('navigates across instance, assignment and tenant domains', async ({ page }) => {
  await page.goto('/process-instances')
  await expect(page.getByText('EXP-2026-001')).toBeVisible()
  await page.getByRole('link', { name: '派单规则' }).click()
  await expect(page.getByRole('button', { name: '新增规则' })).toBeVisible()
  await page.getByRole('link', { name: '租户管理' }).click()
  await expect(page.getByRole('row', { name: /默认租户/ })).toBeVisible()
})

test('manages Agent definitions and inspects the execution ledger', async ({ page }) => {
  await page.goto('/agents')
  await expect(page.getByRole('heading', { level: 1, name: 'Agent 中心' })).toBeVisible()
  const definitionPanel = page.getByLabel('Agent 定义')
  await expect(definitionPanel.getByText('费用审核 Agent')).toBeVisible()
  await expect(definitionPanel.getByRole('row', { name: /费用审核 Agent.*第 1 版/ })).toBeVisible()

  const manualRunRequest = page.waitForRequest((request) =>
    request.url().endsWith('/agent-runs/manual-tests'),
  )
  await definitionPanel.getByRole('button', { name: '测试运行' }).click()
  const manualRunDialog = page.getByRole('dialog', { name: /测试运行.*费用审核 Agent/ })
  await manualRunDialog.getByLabel('测试输入').fill('审核差旅费用')
  await manualRunDialog.getByRole('button', { name: '开始测试' }).click()
  expect((await manualRunRequest).postDataJSON()).toEqual({
    definitionId: 41,
    input: '审核差旅费用',
  })
  const manualRunDrawer = page.getByRole('dialog', { name: '运行详情 #91' })
  await expect(manualRunDrawer.getByText('建议通过').first()).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Provider 配置' }).click()
  await expect(
    page.getByLabel('Provider 配置').getByRole('row', { name: /本地 Mock.*mock_local/ }),
  ).toBeVisible()

  await page.getByRole('tab', { name: '运行记录' }).click()
  const runPanel = page.getByLabel('运行记录')
  await expect(runPanel.getByRole('row', { name: /instance-100/ })).toBeVisible()
  await runPanel.getByRole('button', { name: '详情' }).click()
  const drawer = page.getByRole('dialog', { name: '运行详情 #91' })
  await expect(drawer.getByText('执行尝试 (1)')).toBeVisible()
  await drawer.getByRole('tab', { name: '状态历史 (1)' }).click()
  const stateTransition = drawer.locator('.state-transition')
  await expect(stateTransition.getByTitle('RUNNING')).toHaveText('运行中')
  await expect(stateTransition.getByTitle('SUCCEEDED')).toHaveText('成功')
  await expect(drawer.getByText('Trace ID：trace-91')).toBeVisible()
})

test('keeps Agent list pagination anchored when result sets are empty', async ({ page }) => {
  await page.goto('/agents')

  const cases = [
    { tab: 'Agent 定义', emptyTitle: '尚未创建 Agent' },
    { tab: 'Provider 配置', emptyTitle: '尚未配置 Provider' },
    { tab: '运行记录', emptyTitle: '暂无运行记录' },
  ]

  for (const item of cases) {
    await page.getByRole('tab', { name: item.tab }).click()
    const panel = page.getByLabel(item.tab)
    const pagination = panel.locator('.table-pagination')
    const before = await pagination.boundingBox()
    await panel.getByLabel('关键词').fill('__empty__')
    await panel.getByRole('button', { name: '查询' }).click()
    await expect(panel.getByText(item.emptyTitle, { exact: true })).toBeVisible()
    const after = await pagination.boundingBox()

    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1)
  }
})

test('queries tenant users when configuring an assignment rule', async ({ page }) => {
  await page.goto('/assignment-rules')
  await page.getByRole('button', { name: '新增规则' }).click()
  const dialog = page.getByRole('dialog', { name: '新增派单规则' })

  await dialog.getByLabel('流程').click()
  await page.getByRole('option', { name: /费用审批/ }).click()
  await dialog.getByLabel('目标版本').click()
  await page.getByRole('option', { name: /第 2 版/ }).click()
  await dialog.getByLabel('任务节点').click()
  await page.getByRole('option', { name: /主管审批/ }).click()

  await dialog.getByRole('button', { name: '查询并选择' }).click()
  const picker = page.getByRole('dialog', { name: '选择处理人' })
  await picker.getByPlaceholder('搜索用户名或显示名称').fill('alice')
  const searchRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/auth/directory/users') &&
      new URL(request.url()).searchParams.get('keyword') === 'alice',
  )
  await picker.getByRole('button', { name: '搜索' }).click()
  await searchRequest
  await picker.getByRole('button', { name: /试用用户.*alice/ }).click()
  await picker.getByRole('button', { name: '确认选择' }).click()
  await expect(dialog.getByText('alice', { exact: true })).toBeVisible()

  const saveRequest = page.waitForRequest((request) =>
    request.url().endsWith('/workflow/node-assignment-rule'),
  )
  await dialog.getByRole('button', { name: '保存' }).click()
  expect((await saveRequest).postDataJSON()).toMatchObject({
    processDefinitionId: 'expense:2:100',
    taskDefinitionKey: 'managerApproval',
    assignmentType: 'ASSIGNEE',
    assignees: ['alice'],
  })
})

test('uses the compact navigation on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/process-definitions')
  await page.getByRole('button', { name: '打开导航' }).click()
  const mobileDrawer = page.getByRole('dialog')
  await expect(mobileDrawer.getByRole('link', { name: '流程实例' })).toBeVisible()
  await expect(mobileDrawer.locator('.mobile-tenant-switcher')).toBeVisible()
  await expect(mobileDrawer.getByRole('button', { name: '退出登录' })).toBeVisible()
  await mobileDrawer.getByRole('link', { name: '流程实例' }).click()
  await expect(page.getByRole('heading', { name: '流程实例', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.screenshot({ path: 'test-results/process-instances-mobile.png', fullPage: true })
})

test('keeps designer operations and properties available on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/process-definitions')
  await page.getByRole('button', { name: '新建流程' }).first().click()
  const dialog = page.getByRole('dialog', { name: '新建流程' })
  await dialog.getByLabel('流程标识').fill('mobile_approval')
  await dialog.getByLabel('流程名称').fill('移动审批')
  await dialog.getByRole('button', { name: '创建并设计' }).click()

  await expect(page.getByRole('button', { name: '更多流程图操作' })).toBeVisible()
  await page.getByRole('button', { name: '更多流程图操作' }).click()
  await expect(page.getByRole('menuitem', { name: '导入流程图' })).toBeVisible()
  await expect(page.getByText('流程概览', { exact: true })).toBeVisible()
})
