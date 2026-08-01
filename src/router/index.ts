import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
          meta: { title: '流程定义' },
        },
        {
          path: 'process-definitions/designer',
          name: 'process-designer',
          component: () => import('@/features/process-definition/views/ProcessDesignerView.vue'),
          meta: { title: '流程设计器', immersive: true },
        },
        {
          path: 'process-instances',
          name: 'process-instances',
          component: () => import('@/features/process-instance/views/ProcessInstanceListView.vue'),
          meta: { title: '流程实例' },
        },
        {
          path: 'process-instances/:id',
          name: 'process-instance-detail',
          component: () =>
            import('@/features/process-instance/views/ProcessInstanceDetailView.vue'),
          meta: { title: '流程实例详情' },
        },
        {
          path: 'assignment-rules',
          name: 'assignment-rules',
          component: () => import('@/features/assignment-rule/views/AssignmentRuleListView.vue'),
          meta: { title: '派单规则' },
        },
        {
          path: 'tenants',
          name: 'tenants',
          component: () => import('@/features/tenant/views/TenantListView.vue'),
          meta: { title: '租户管理' },
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

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '工作台')} | Workflow Agent`
})

export default router
