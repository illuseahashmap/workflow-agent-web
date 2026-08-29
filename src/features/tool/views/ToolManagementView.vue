<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ElMessage } from 'element-plus'
import { Cable, CircleCheck, Compass, Plus, RefreshCw, Wrench } from '@lucide/vue'
import PageHeader from '@/components/PageHeader.vue'
import ListEmptyState from '@/components/ListEmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { queryKeys } from '@/api/queryKeys'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/api/http'
import { APP_PERMISSION, hasAccess } from '@/features/auth/authorization'
import { toolApi } from '../api'
import type { ToolConnectorCommand, ToolConnectorSummary, ToolDiscovery } from '../types'

const authStore = useAuthStore()
const queryClient = useQueryClient()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const canManage = computed(() =>
  hasAccess(authStore.user, { requiredAnyPermissions: [APP_PERMISSION.agentManage] }),
)
const createVisible = ref(false)
const discoveryVisible = ref(false)
const discovery = ref<ToolDiscovery>()
const connectorForm = reactive<ToolConnectorCommand>({
  connectorCode: '',
  connectorName: '',
  endpointUrl: '',
  protocolVersion: '2025-03-26',
  credentialRef: '',
  timeoutSeconds: 30,
})

const toolsQuery = useQuery({
  queryKey: computed(() => queryKeys.mcpConnectors(tenantCode.value)),
  queryFn: toolApi.list,
  enabled: computed(() => Boolean(tenantCode.value) && canManage.value),
})
const createMutation = useMutation({
  mutationFn: () =>
    toolApi.createConnector({
      ...connectorForm,
      connectorCode: connectorForm.connectorCode.trim(),
      connectorName: connectorForm.connectorName.trim(),
      endpointUrl: connectorForm.endpointUrl.trim(),
      credentialRef: connectorForm.credentialRef?.trim() || undefined,
    }),
  onSuccess: async (version) => {
    createVisible.value = false
    ElMessage.success(`连接器已创建，版本 ${version.version} 等待发现`)
    await queryClient.invalidateQueries({
      queryKey: queryKeys.mcpConnectors(tenantCode.value),
    })
  },
})
const discoverMutation = useMutation({
  mutationFn: (connector: ToolConnectorSummary) => toolApi.discover(connector.connectorVersionId),
  onSuccess: (result) => {
    discovery.value = result
    discoveryVisible.value = true
    void queryClient.invalidateQueries({
      queryKey: queryKeys.mcpConnectors(tenantCode.value),
    })
  },
})
const publishMutation = useMutation({
  mutationFn: (catalogVersionId: number) => toolApi.publish(catalogVersionId),
  onSuccess: async () => {
    ElMessage.success('工具目录已发布')
    discoveryVisible.value = false
    await queryClient.invalidateQueries({
      queryKey: queryKeys.mcpConnectors(tenantCode.value),
    })
  },
})

function resetForm() {
  Object.assign(connectorForm, {
    connectorCode: '',
    connectorName: '',
    endpointUrl: '',
    protocolVersion: '2025-03-26',
    credentialRef: '',
    timeoutSeconds: 30,
  })
}
function openCreate() {
  resetForm()
  createVisible.value = true
}
function openDiscovery(connector: ToolConnectorSummary) {
  discoverMutation.mutate(connector)
}
function statusLabel(status?: string) {
  return (
    (
      {
        DRAFT: '草稿',
        ACTIVE: '启用',
        DISABLED: '停用',
        PUBLISHED: '已发布',
        RETIRED: '已退役',
      } as Record<string, string>
    )[status || ''] ||
    status ||
    '—'
  )
}
function statusTone(status?: string) {
  return status === 'PUBLISHED' || status === 'ACTIVE'
    ? 'success'
    : status === 'DISABLED' || status === 'RETIRED'
      ? 'info'
      : 'warning'
}
function schemaPreview(schema: string) {
  try {
    return JSON.stringify(JSON.parse(schema), null, 2)
  } catch {
    return schema
  }
}
</script>

<template>
  <div class="management-page tool-management-page">
    <PageHeader
      eyebrow="TOOL GOVERNANCE"
      title="工具目录"
      description="管理只读 MCP 连接器、版本与经审核发布的工具快照。运行时只使用已发布目录，不会临时暴露远程工具。"
    >
      <template #actions>
        <el-button type="primary" @click="openCreate"><Plus :size="16" />新增连接器</el-button>
      </template>
    </PageHeader>

    <section class="tool-principles" aria-label="工具治理原则">
      <article>
        <Cable :size="18" />
        <div><strong>HTTPS 连接</strong><span>只支持 Streamable HTTP</span></div>
      </article>
      <article>
        <Compass :size="18" />
        <div><strong>发现后审核</strong><span>工具必须形成不可变快照</span></div>
      </article>
      <article>
        <CircleCheck :size="18" />
        <div><strong>只读范围</strong><span>当前版本禁止写工具</span></div>
      </article>
    </section>

    <section class="tool-table-panel table-panel">
      <div class="tool-table-heading">
        <div>
          <h3>连接器与目录</h3>
          <p>先创建连接器，再发现、核对并发布工具目录。</p>
        </div>
        <el-button text @click="toolsQuery.refetch()"><RefreshCw :size="15" />刷新</el-button>
      </div>
      <el-table
        v-loading="toolsQuery.isFetching.value"
        :data="toolsQuery.data.value || []"
        row-key="connectorId"
      >
        <el-table-column label="连接器" min-width="210"
          ><template #default="{ row }"
            ><div class="tool-name-cell">
              <span class="tool-name-cell__icon"><Wrench :size="16" /></span>
              <div>
                <strong>{{ row.connectorName }}</strong
                ><small>{{ row.connectorCode }}</small>
              </div>
            </div></template
          ></el-table-column
        >
        <el-table-column label="版本" width="110" align="center"
          ><template #default="{ row }"
            >version:{{ row.connectorVersion }}</template
          ></el-table-column
        >
        <el-table-column label="端点" min-width="260" show-overflow-tooltip
          ><template #default="{ row }"
            ><code>{{ row.endpointUrl }}</code></template
          ></el-table-column
        >
        <el-table-column label="目录状态" width="130" align="center"
          ><template #default="{ row }"
            ><StatusBadge
              :label="statusLabel(row.latestCatalogStatus)"
              :status="row.latestCatalogStatus || 'DRAFT'"
              :tone="statusTone(row.latestCatalogStatus)" /></template
        ></el-table-column>
        <el-table-column label="工具数" width="90" align="center"
          ><template #default="{ row }">{{ row.toolCount }}</template></el-table-column
        >
        <el-table-column label="操作" width="150" align="center"
          ><template #default="{ row }"
            ><el-button
              type="primary"
              link
              :loading="discoverMutation.isPending.value"
              @click="openDiscovery(row)"
              >发现工具</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <ListEmptyState
        v-if="!toolsQuery.isFetching.value && !toolsQuery.data.value?.length"
        :icon="Wrench"
        title="还没有 MCP 连接器"
        description="创建一个 HTTPS 只读连接器，发现工具后再进行审核发布。"
        ><el-button type="primary" @click="openCreate">新增连接器</el-button></ListEmptyState
      >
    </section>

    <el-dialog v-model="createVisible" title="新增 MCP 连接器" width="560px" destroy-on-close>
      <el-form label-position="top" @submit.prevent="createMutation.mutate()">
        <div class="tool-form-grid">
          <el-form-item label="连接器编码" required
            ><el-input
              v-model="connectorForm.connectorCode"
              placeholder="例如 employee_directory" /></el-form-item
          ><el-form-item label="连接器名称" required
            ><el-input v-model="connectorForm.connectorName" placeholder="例如 员工目录"
          /></el-form-item>
        </div>
        <el-form-item label="HTTPS Endpoint" required
          ><el-input v-model="connectorForm.endpointUrl" placeholder="https://mcp.example.com/mcp"
        /></el-form-item>
        <div class="tool-form-grid">
          <el-form-item label="协议版本"
            ><el-input v-model="connectorForm.protocolVersion" /></el-form-item
          ><el-form-item label="超时（秒）"
            ><el-input-number v-model="connectorForm.timeoutSeconds" :min="1" :max="300"
          /></el-form-item>
        </div>
        <el-form-item label="凭证引用"
          ><el-input
            v-model="connectorForm.credentialRef"
            placeholder="只填写平台凭证引用，不填写密钥本身"
        /></el-form-item>
        <el-alert
          type="info"
          :closable="false"
          title="安全边界"
          description="平台仅保存凭证引用；模型不会看到连接器凭证，工具必须发现并审核后才能运行。"
        />
      </el-form>
      <template #footer
        ><el-button @click="createVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="createMutation.isPending.value"
          @click="createMutation.mutate()"
          >创建连接器</el-button
        ></template
      >
    </el-dialog>

    <el-drawer v-model="discoveryVisible" title="工具目录审核" size="min(760px, 100vw)">
      <template v-if="discovery">
        <div class="discovery-summary">
          <div>
            <small>目录版本</small><strong>version:{{ discovery.catalogVersionId }}</strong>
          </div>
          <div>
            <small>工具数量</small><strong>{{ discovery.tools.length }}</strong>
          </div>
          <div>
            <small>状态</small
            ><StatusBadge
              :status="discovery.status"
              :label="statusLabel(discovery.status)"
              :tone="statusTone(discovery.status)"
            />
          </div>
        </div>
        <el-alert
          class="discovery-notice"
          type="warning"
          :closable="false"
          title="发布前请核对工具名称、描述和输入 Schema。发布后的快照不可修改。"
        />
        <div class="tool-snapshot-list">
          <article v-for="tool in discovery.tools" :key="tool.snapshotId" class="tool-snapshot">
            <div class="tool-snapshot__heading">
              <div>
                <strong>{{ tool.name }}</strong
                ><code>{{ tool.registryToolCode }}</code>
              </div>
              <StatusBadge status="READ_ONLY" label="只读" tone="success" />
            </div>
            <p>{{ tool.description || '暂无工具说明' }}</p>
            <details>
              <summary>查看输入 Schema</summary>
              <pre>{{ schemaPreview(tool.inputSchema) }}</pre>
            </details>
          </article>
        </div>
        <div class="discovery-actions">
          <el-button
            v-if="discovery.status === 'DRAFT'"
            type="primary"
            :loading="publishMutation.isPending.value"
            @click="publishMutation.mutate(discovery.catalogVersionId)"
            >审核并发布目录</el-button
          ><span v-else>该目录已经发布，运行时将使用此版本快照。</span>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.tool-management-page {
  --tool-ink: #172554;
  --tool-blue: #2563eb;
}
.tool-principles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.tool-principles article {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 70px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: linear-gradient(135deg, #fff 0%, #f5f8ff 100%);
  color: var(--tool-blue);
}
.tool-principles article div {
  display: grid;
  gap: 3px;
}
.tool-principles strong {
  color: var(--color-text-strong);
  font-size: 13px;
}
.tool-principles span {
  color: var(--color-text-muted);
  font-size: 12px;
}
.tool-table-panel {
  overflow: hidden;
}
.tool-table-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-border);
}
.tool-table-heading h3 {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 16px;
}
.tool-table-heading p {
  margin: 5px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}
.tool-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tool-name-cell__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  color: var(--tool-blue);
  background: var(--color-primary-soft);
}
.tool-name-cell div {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.tool-name-cell strong {
  color: var(--color-text);
}
.tool-name-cell small {
  color: var(--color-text-muted);
}
.el-table code {
  color: var(--color-text-muted);
  font-size: 12px;
}
.tool-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.discovery-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-muted);
}
.discovery-summary > div {
  display: grid;
  align-content: center;
  gap: 4px;
  min-width: 0;
}
.discovery-summary small {
  color: var(--color-text-muted);
  font-size: 12px;
}
.discovery-summary strong {
  color: var(--color-text-strong);
}
.discovery-notice {
  margin: 14px 0;
}
.tool-snapshot-list {
  display: grid;
  gap: 10px;
}
.tool-snapshot {
  display: grid;
  gap: 9px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #fff;
}
.tool-snapshot__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.tool-snapshot__heading > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.tool-snapshot__heading code {
  overflow: hidden;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tool-snapshot p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.6;
}
.tool-snapshot details {
  color: var(--tool-blue);
  font-size: 12px;
}
.tool-snapshot pre {
  max-height: 220px;
  overflow: auto;
  margin: 8px 0 0;
  padding: 10px;
  color: var(--color-text);
  background: var(--color-code-surface);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.discovery-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
  color: var(--color-text-muted);
  font-size: 12px;
}
@media (max-width: 760px) {
  .tool-principles,
  .tool-form-grid {
    grid-template-columns: 1fr;
  }
  .discovery-summary {
    grid-template-columns: 1fr;
  }
  .tool-table-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
