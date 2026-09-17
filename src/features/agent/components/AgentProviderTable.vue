<script setup lang="ts">
import StatusBadge from '@/components/StatusBadge.vue'
import ListEmptyState from '@/components/ListEmptyState.vue'
import type { AgentProvider, AgentProviderType } from '../types'

defineProps<{
  rows: AgentProvider[]
  loading: boolean
  providerTypeLabel: (type: AgentProviderType) => string
}>()

const emit = defineEmits<{
  edit: [provider: AgentProvider]
}>()
</script>

<template>
  <el-table class="provider-table" v-loading="loading" :data="rows" height="100%">
    <el-table-column prop="name" label="Provider 名称" min-width="180" />
    <el-table-column prop="code" label="编码" min-width="150" />
    <el-table-column label="类型" width="140">
      <template #default="{ row }">{{ providerTypeLabel(row.type) }}</template>
    </el-table-column>
    <el-table-column prop="baseUrl" label="API 地址" min-width="230" show-overflow-tooltip>
      <template #default="{ row }">{{ row.baseUrl || '本地 Mock' }}</template>
    </el-table-column>
    <el-table-column prop="defaultModel" label="默认模型" min-width="150">
      <template #default="{ row }">{{ row.defaultModel || '—' }}</template>
    </el-table-column>
    <el-table-column label="凭证状态" width="110" align="center" header-align="center">
      <template #default="{ row }">
        <StatusBadge
          :status="
            row.credentialConfigured ? 'SUCCESS' : row.type === 'MOCK' ? 'SKIPPED' : 'PENDING'
          "
          :tone="row.credentialConfigured ? 'success' : row.type === 'MOCK' ? 'info' : 'warning'"
          :label="row.credentialConfigured ? '已配置' : row.type === 'MOCK' ? '无需凭证' : '未配置'"
        />
      </template>
    </el-table-column>
    <el-table-column label="凭证尾号" width="110" align="center" header-align="center">
      <template #default="{ row }">
        <code v-if="row.credentialConfigured && row.credentialHint" class="credential-hint">
          •••• {{ row.credentialHint }}
        </code>
        <span v-else class="credential-empty">—</span>
      </template>
    </el-table-column>
    <el-table-column
      class-name="agent-status-column"
      label="状态"
      width="110"
      align="center"
      header-align="center"
    >
      <template #default="{ row }"><StatusBadge :status="row.enabled" /></template>
    </el-table-column>
    <el-table-column label="操作" width="90" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary" @click="emit('edit', row)">编辑</el-button>
      </template>
    </el-table-column>
    <template #empty>
      <ListEmptyState
        title="尚未配置 Provider"
        description="先配置模型服务与凭据，再创建可发布的 Agent 版本。"
      />
    </template>
  </el-table>
</template>
