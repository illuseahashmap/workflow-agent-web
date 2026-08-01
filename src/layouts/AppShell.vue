<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElDrawer, ElTooltip } from 'element-plus'
import 'element-plus/es/components/drawer/style/css'
import 'element-plus/es/components/tooltip/style/css'
import {
  Building2,
  ChevronDown,
  CircleDot,
  GitBranch,
  LogOut,
  Menu,
  Route,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserRound,
  Workflow,
  X,
} from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

const pageTitle = computed(() => String(route.meta.title ?? '工作台'))
const displayName = computed(() => authStore.user?.displayName || authStore.user?.username || '用户')
const userInitial = computed(() => displayName.value.slice(0, 1).toUpperCase())

async function handleUserCommand(command: string) {
  if (command !== 'logout') return
  authStore.logout()
  await router.replace({ name: 'auth' })
}

const navigation = [
  { label: '流程定义', to: '/process-definitions', icon: ScrollText },
  { label: '流程实例', to: '/process-instances', icon: GitBranch },
  { label: '派单规则', to: '/assignment-rules', icon: Route },
  { label: '租户管理', to: '/tenants', icon: Building2 },
]
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

      <div class="sidebar-card">
        <div class="sidebar-card-icon"><Sparkles :size="16" /></div>
        <div>
          <strong>Local Workspace</strong>
          <span>PostgreSQL · Redis · Flowable</span>
        </div>
      </div>

      <nav class="navigation">
        <RouterLink v-for="item in navigation" :key="item.to" :to="item.to" class="nav-item">
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-status">
        <span class="status-dot" />
        <span>用户鉴权已接入</span>
      </div>
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
          :key="item.to"
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
          <span class="runtime-badge"><CircleDot :size="13" />本地环境</span>
          <span class="runtime-badge success"><ShieldCheck :size="13" />Token 已连接</span>
          <el-dropdown trigger="click" @command="handleUserCommand">
            <button class="user-menu" type="button">
              <span class="user-avatar">{{ userInitial }}</span>
              <span class="user-menu-copy">
                <strong>{{ displayName }}</strong>
                <small>{{ authStore.user?.tenantCode || 'default' }}</small>
              </span>
              <ChevronDown :size="15" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled><UserRound :size="15" />{{ authStore.user?.username }}</el-dropdown-item>
                <el-dropdown-item divided command="logout"><LogOut :size="15" />退出登录</el-dropdown-item>
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
