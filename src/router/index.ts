import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import { APP_PERMISSION, APP_ROLE, hasAccess, readAuthSession } from '@/features/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/features/auth/views/AuthView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      component: AppShell,
      children: [
        {
          path: '',
          redirect: '/process-definitions',
        },
        {
          path: 'process-definitions',
          name: 'process-definitions',
          component: () =>
            import('@/features/process-definition/views/ProcessDefinitionListView.vue'),
          meta: {
            title: '流程定义',
            requiredAnyRoles: [APP_ROLE.platformAdministrator, APP_ROLE.tenantAdministrator],
            requiredAnyPermissions: [APP_PERMISSION.definitionRead, APP_PERMISSION.definitionWrite],
            navigation: { label: '流程定义', icon: 'definitions', order: 10 },
          },
        },
        {
          path: 'process-definitions/designer',
          name: 'process-designer',
          component: () => import('@/features/process-definition/views/ProcessDesignerView.vue'),
          meta: {
            title: '流程设计器',
            immersive: true,
            requiredAnyRoles: [APP_ROLE.platformAdministrator, APP_ROLE.tenantAdministrator],
            requiredAnyPermissions: [APP_PERMISSION.definitionWrite],
          },
        },
        {
          path: 'process-instances',
          name: 'process-instances',
          component: () => import('@/features/process-instance/views/ProcessInstanceListView.vue'),
          meta: {
            title: '流程实例',
            requiredAnyRoles: [APP_ROLE.platformAdministrator, APP_ROLE.tenantAdministrator],
            requiredAnyPermissions: [APP_PERMISSION.instanceRead, APP_PERMISSION.instanceOperate],
            navigation: { label: '流程实例', icon: 'instances', order: 20 },
          },
        },
        {
          path: 'process-instances/:id',
          name: 'process-instance-detail',
          component: () =>
            import('@/features/process-instance/views/ProcessInstanceDetailView.vue'),
          meta: {
            title: '流程实例详情',
            requiredAnyRoles: [APP_ROLE.platformAdministrator, APP_ROLE.tenantAdministrator],
            requiredAnyPermissions: [APP_PERMISSION.instanceRead, APP_PERMISSION.instanceOperate],
          },
        },
        {
          path: 'assignment-rules',
          name: 'assignment-rules',
          component: () => import('@/features/assignment-rule/views/AssignmentRuleListView.vue'),
          meta: {
            title: '派单规则',
            requiredAnyRoles: [APP_ROLE.platformAdministrator, APP_ROLE.tenantAdministrator],
            requiredAnyPermissions: [APP_PERMISSION.assignmentManage],
            navigation: { label: '派单规则', icon: 'assignments', order: 30 },
          },
        },
        {
          path: 'access',
          name: 'access-management',
          component: () => import('@/features/access/views/AccessManagementView.vue'),
          meta: {
            title: '成员与角色',
            requiredAnyRoles: [APP_ROLE.platformAdministrator],
            requiredAnyPermissions: [APP_PERMISSION.memberManage, APP_PERMISSION.roleManage],
            navigation: { label: '成员与角色', icon: 'access', order: 50 },
          },
        },
        {
          path: 'agents',
          name: 'agent-management',
          component: () => import('@/features/agent/views/AgentManagementView.vue'),
          meta: {
            title: 'Agent 中心',
            requiredAnyRoles: [APP_ROLE.platformAdministrator, APP_ROLE.tenantAdministrator],
            requiredAnyPermissions: [APP_PERMISSION.agentManage, APP_PERMISSION.agentRunRead],
            navigation: { label: 'Agent 中心', icon: 'agents', order: 40 },
          },
        },
        {
          path: 'tenants',
          name: 'tenants',
          component: () => import('@/features/tenant/views/TenantListView.vue'),
          meta: {
            title: '租户管理',
            requiredAnyRoles: [APP_ROLE.platformAdministrator],
            requiredAnyPermissions: [APP_PERMISSION.tenantManage],
            navigation: { label: '租户管理', icon: 'tenants', order: 60 },
          },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
})

function firstAuthorizedRoute(session: ReturnType<typeof readAuthSession>) {
  const firstRoute = router
    .getRoutes()
    .filter((route) => route.name && route.meta.navigation && hasAccess(session, route.meta))
    .sort((left, right) => left.meta.navigation!.order - right.meta.navigation!.order)[0]
  if (firstRoute) return { name: firstRoute.name }
  return { name: 'not-found' }
}

router.beforeEach((to) => {
  const session = readAuthSession()
  const { expiresAt } = session ?? {}
  const authenticated = Boolean(expiresAt && Date.parse(expiresAt) > Date.now())

  if (!to.meta.public && !authenticated) {
    return { name: 'auth', query: { redirect: to.fullPath } }
  }
  if (to.name === 'auth' && authenticated) {
    return firstAuthorizedRoute(session)
  }
  if (authenticated && !hasAccess(session, to.meta)) {
    return firstAuthorizedRoute(session)
  }
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '工作台')} | Workflow Agent`
})

export default router
