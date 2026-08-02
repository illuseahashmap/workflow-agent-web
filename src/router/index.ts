import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import { readAuthSession } from '@/features/auth/storage'

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
            requiredAnyRoles: ['PLATFORM_ADMIN', 'TENANT_ADMIN'],
            requiredAnyPermissions: ['workflow:definition:read', 'workflow:definition:write'],
          },
        },
        {
          path: 'process-definitions/designer',
          name: 'process-designer',
          component: () => import('@/features/process-definition/views/ProcessDesignerView.vue'),
          meta: {
            title: '流程设计器',
            immersive: true,
            requiredAnyRoles: ['PLATFORM_ADMIN', 'TENANT_ADMIN'],
            requiredAnyPermissions: ['workflow:definition:write'],
          },
        },
        {
          path: 'process-instances',
          name: 'process-instances',
          component: () => import('@/features/process-instance/views/ProcessInstanceListView.vue'),
          meta: {
            title: '流程实例',
            requiredAnyRoles: ['PLATFORM_ADMIN', 'TENANT_ADMIN'],
            requiredAnyPermissions: ['workflow:instance:read', 'workflow:instance:operate'],
          },
        },
        {
          path: 'process-instances/:id',
          name: 'process-instance-detail',
          component: () =>
            import('@/features/process-instance/views/ProcessInstanceDetailView.vue'),
          meta: {
            title: '流程实例详情',
            requiredAnyRoles: ['PLATFORM_ADMIN', 'TENANT_ADMIN'],
            requiredAnyPermissions: ['workflow:instance:read', 'workflow:instance:operate'],
          },
        },
        {
          path: 'assignment-rules',
          name: 'assignment-rules',
          component: () => import('@/features/assignment-rule/views/AssignmentRuleListView.vue'),
          meta: {
            title: '派单规则',
            requiredAnyRoles: ['PLATFORM_ADMIN', 'TENANT_ADMIN'],
            requiredAnyPermissions: ['assignment:manage'],
          },
        },
        {
          path: 'access',
          name: 'access-management',
          component: () => import('@/features/access/views/AccessManagementView.vue'),
          meta: {
            title: '成员与角色',
            requiredAnyRoles: ['PLATFORM_ADMIN'],
            requiredAnyPermissions: ['member:manage', 'role:manage'],
          },
        },
        {
          path: 'tenants',
          name: 'tenants',
          component: () => import('@/features/tenant/views/TenantListView.vue'),
          meta: {
            title: '租户管理',
            requiredAnyRoles: ['PLATFORM_ADMIN'],
            requiredAnyPermissions: ['tenant:manage'],
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
  const roles = session?.roles ?? []
  const permissions = session?.permissions ?? []
  const administrator = roles.includes('PLATFORM_ADMIN') || roles.includes('TENANT_ADMIN')
  if (
    administrator ||
    permissions.includes('workflow:definition:read') ||
    permissions.includes('workflow:definition:write')
  )
    return { name: 'process-definitions' }
  if (
    permissions.includes('workflow:instance:read') ||
    permissions.includes('workflow:instance:operate')
  )
    return { name: 'process-instances' }
  if (permissions.includes('assignment:manage')) return { name: 'assignment-rules' }
  if (permissions.includes('member:manage') || permissions.includes('role:manage')) {
    return { name: 'access-management' }
  }
  if (roles.includes('PLATFORM_ADMIN') || permissions.includes('tenant:manage')) {
    return { name: 'tenants' }
  }
  return { name: 'not-found' }
}

router.beforeEach((to) => {
  const session = readAuthSession()
  const { accessToken, expiresAt } = session ?? {}
  const authenticated = Boolean(accessToken && expiresAt && Date.parse(expiresAt) > Date.now())

  if (!to.meta.public && !authenticated) {
    return { name: 'auth', query: { redirect: to.fullPath } }
  }
  if (to.name === 'auth' && authenticated) {
    return firstAuthorizedRoute(session)
  }
  const requiredRoles = (to.meta.requiredAnyRoles as string[] | undefined) ?? []
  const requiredPermissions = (to.meta.requiredAnyPermissions as string[] | undefined) ?? []
  if (
    authenticated &&
    (requiredRoles.length || requiredPermissions.length) &&
    !requiredRoles.some((role) => session?.roles.includes(role)) &&
    !requiredPermissions.some((permission) => session?.permissions.includes(permission))
  ) {
    return firstAuthorizedRoute(session)
  }
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '工作台')} | Workflow Agent`
})

export default router
