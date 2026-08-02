<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Building2,
  ChevronDown,
  GitBranch,
  LogOut,
  Menu,
  Route,
  ScrollText,
  UsersRound,
  Workflow,
  X,
} from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { queryKeys } from '@/api/queryKeys'
import { hasAccess } from '@/features/auth/authorization'
import type { NavigationIcon } from '@/router/meta'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const appStore = useAppStore()
const authStore = useAuthStore()

const pageTitle = computed(() => String(route.meta.title ?? '工作台'))
const displayName = computed(
  () => authStore.user?.displayName || authStore.user?.username || '用户',
)
const userInitial = computed(() => displayName.value.slice(0, 1).toUpperCase())
const selectedTenant = ref(authStore.user?.tenantCode || '')
const switchingTenant = ref(false)
let authorizationRefreshTimer: ReturnType<typeof setInterval> | undefined
let refreshingAuthorization = false
const navigationIcons: Record<NavigationIcon, Component> = {
  definitions: ScrollText,
  instances: GitBranch,
  assignments: Route,
  access: UsersRound,
  tenants: Building2,
}

watch(
  () => authStore.user?.tenantCode,
  (tenantCode) => (selectedTenant.value = tenantCode || ''),
)

async function refreshAuthorization(showError = false) {
  if (!authStore.isAuthenticated || refreshingAuthorization) return
  refreshingAuthorization = true
  try {
    await Promise.all([authStore.refreshCurrentUser(), authStore.loadTenants()])
  } catch {
    if (showError) ElMessage.error('无法刷新当前账号权限')
  } finally {
    refreshingAuthorization = false
  }
}

function handleWindowFocus() {
  void refreshAuthorization()
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') void refreshAuthorization()
}

onMounted(async () => {
  await refreshAuthorization(true)
  window.addEventListener('focus', handleWindowFocus)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  authorizationRefreshTimer = window.setInterval(() => void refreshAuthorization(), 30_000)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', handleWindowFocus)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (authorizationRefreshTimer) window.clearInterval(authorizationRefreshTimer)
})

async function handleTenantChange(tenantCode: string) {
  if (!tenantCode || tenantCode === authStore.user?.tenantCode) return
  const previousTenantCode = authStore.user?.tenantCode
  switchingTenant.value = true
  try {
    await authStore.switchTenant(tenantCode)
    if (previousTenantCode) {
      queryClient.removeQueries({ queryKey: queryKeys.tenant(previousTenantCode) })
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.tenant(tenantCode) })
    ElMessage.success(
      `已切换到 ${authStore.tenants.find((item) => item.tenantCode === tenantCode)?.tenantName || tenantCode}`,
    )
  } catch {
    selectedTenant.value = authStore.user?.tenantCode || ''
    ElMessage.error('租户切换失败')
  } finally {
    switchingTenant.value = false
  }
}

async function handleUserCommand(command: string) {
  if (command !== 'logout') return
  authStore.logout()
  await router.replace({ name: 'auth' })
}

const navigation = computed(() =>
  router
    .getRoutes()
    .filter((item) => item.name && item.meta.navigation && hasAccess(authStore.user, item.meta))
    .sort((left, right) => left.meta.navigation!.order - right.meta.navigation!.order)
    .map((item) => ({
      label: item.meta.navigation!.label,
      to: { name: item.name! },
      icon: navigationIcons[item.meta.navigation!.icon],
    })),
)
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="主导航">
      <div class="brand">
        <span class="brand-mark"><Workflow :size="21" /></span>
        <span>
          <strong>Workflow Agent</strong>
          <small>流程编排工作台</small>
        </span>
      </div>

      <nav class="navigation">
        <RouterLink
          v-for="item in navigation"
          :key="String(item.to.name)"
          :to="item.to"
          class="nav-item"
        >
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <el-drawer
      v-model="appStore.mobileNavigationOpen"
      direction="ltr"
      size="292px"
      :show-close="false"
      class="mobile-drawer"
    >
      <template #header>
        <div class="drawer-header">
          <div class="brand brand-mobile">
            <span class="brand-mark"><Workflow :size="20" /></span>
            <span>
              <strong>Workflow Agent</strong>
              <small>流程编排工作台</small>
            </span>
          </div>
          <el-tooltip content="关闭导航" placement="bottom">
            <button
              class="icon-button"
              type="button"
              aria-label="关闭导航"
              @click="appStore.closeMobileNavigation"
            >
              <X :size="19" />
            </button>
          </el-tooltip>
        </div>
      </template>
      <nav class="navigation navigation-mobile">
        <RouterLink
          v-for="item in navigation"
          :key="String(item.to.name)"
          :to="item.to"
          class="nav-item"
          @click="appStore.closeMobileNavigation"
        >
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </el-drawer>

    <div class="workspace">
      <header class="topbar">
        <el-tooltip content="打开导航" placement="bottom">
          <button
            class="icon-button mobile-menu-button"
            type="button"
            aria-label="打开导航"
            @click="appStore.openMobileNavigation"
          >
            <Menu :size="20" />
          </button>
        </el-tooltip>
        <div class="topbar-title">
          <span>当前页面</span>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar-badges">
          <el-select
            v-model="selectedTenant"
            class="tenant-switcher"
            popper-class="tenant-switcher-dropdown"
            :loading="switchingTenant"
            aria-label="切换租户"
            @change="handleTenantChange"
          >
            <template #prefix><Building2 :size="16" /></template>
            <el-option
              v-for="tenant in authStore.tenants"
              :key="tenant.tenantCode"
              :label="tenant.tenantName"
              :value="tenant.tenantCode"
              :disabled="!tenant.enabled"
            />
          </el-select>
          <el-dropdown
            trigger="click"
            popper-class="user-account-dropdown"
            @command="handleUserCommand"
          >
            <button class="user-menu" type="button" aria-label="打开账号菜单">
              <span class="user-avatar">{{ userInitial }}</span>
              <span class="user-menu-copy">
                <strong>{{ displayName }}</strong>
                <small>{{ authStore.user?.username }}</small>
              </span>
              <ChevronDown :size="15" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item class="user-account-summary" disabled>
                  <span class="user-dropdown-avatar">{{ userInitial }}</span>
                  <span class="user-dropdown-copy">
                    <strong>{{ displayName }}</strong>
                    <small>{{ authStore.user?.username }}</small>
                  </span>
                </el-dropdown-item>
                <el-dropdown-item divided command="logout"
                  ><LogOut :size="15" />退出登录</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <main class="content" :class="{ 'content-immersive': route.meta.immersive }">
        <RouterView />
      </main>
    </div>
  </div>
</template>
