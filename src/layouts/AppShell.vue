<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElDrawer, ElTooltip } from 'element-plus'
import 'element-plus/es/components/drawer/style/css'
import 'element-plus/es/components/tooltip/style/css'
import {
  Building2,
  CircleDot,
  GitBranch,
  Menu,
  Route,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from '@lucide/vue'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const appStore = useAppStore()

const pageTitle = computed(() => String(route.meta.title ?? '工作台'))

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
        <span>鉴权接入待完善</span>
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
          <span class="runtime-badge warning"><ShieldCheck :size="13" />Token 待接入</span>
        </div>
      </header>
      <main class="content" :class="{ 'content-immersive': route.meta.immersive }">
        <RouterView />
      </main>
    </div>
  </div>
</template>
