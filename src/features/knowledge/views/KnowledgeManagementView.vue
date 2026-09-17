<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { BookOpen, FileUp, RefreshCw } from '@lucide/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import ListEmptyState from '@/components/ListEmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import TablePagination from '@/components/TablePagination.vue'
import { queryKeys } from '@/api/queryKeys'
import { getErrorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { APP_PERMISSION, APP_ROLE, hasAccess } from '@/features/auth/authorization'
import { knowledgeApi } from '../api'

const auth = useAuthStore()
const queryClient = useQueryClient()
const tenantCode = computed(() => auth.user?.tenantCode || '')
const isPlatformAdmin = computed(
  () => auth.user?.roles.includes(APP_ROLE.platformAdministrator) ?? false,
)
const canProfile = computed(
  () =>
    isPlatformAdmin.value ||
    hasAccess(auth.user, { requiredAnyPermissions: [APP_PERMISSION.knowledgeProfileManage] }),
)
const canProfileRead = computed(
  () =>
    isPlatformAdmin.value ||
    hasAccess(auth.user, {
      requiredAnyPermissions: [
        APP_PERMISSION.knowledgeProfileRead,
        APP_PERMISSION.knowledgeProfileManage,
      ],
    }),
)
const canDocument = computed(
  () =>
    isPlatformAdmin.value ||
    hasAccess(auth.user, { requiredAnyPermissions: [APP_PERMISSION.knowledgeDocumentManage] }),
)
const canIngestionRead = computed(
  () =>
    isPlatformAdmin.value ||
    hasAccess(auth.user, { requiredAnyPermissions: [APP_PERMISSION.knowledgeIngestionRead] }),
)
const canScope = computed(
  () =>
    isPlatformAdmin.value ||
    hasAccess(auth.user, { requiredAnyPermissions: [APP_PERMISSION.knowledgeScopeManage] }),
)
const tab = ref<'profiles' | 'jobs' | 'grants'>('profiles')
const pageNum = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const status = ref('')
const profileDialogVisible = ref(false)
const documentDialogVisible = ref(false)
const documentFileInput = ref<HTMLInputElement | null>(null)
const grantForm = reactive({ principalId: '', scopeCode: '' })
const profileForm = reactive({
  profileCode: '',
  strategy: 'HYBRID',
  maxResults: 10,
  minimumScore: 0,
  indexVersionId: 0,
  knowledgeScopes: '',
})
const documentForm = reactive({
  sourceCode: '',
  sourceName: '',
  externalDocumentId: '',
  version: 1,
  contentHash: '',
  content: '',
})

const profiles = useQuery({
  queryKey: computed(() =>
    queryKeys.knowledgeProfiles(
      tenantCode.value,
      pageNum.value,
      pageSize.value,
      keyword.value,
      status.value,
    ),
  ),
  queryFn: () =>
    knowledgeApi.profiles({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: status.value || undefined,
    }),
  enabled: computed(() =>
    Boolean(tenantCode.value && canProfileRead.value && tab.value === 'profiles'),
  ),
})
const jobs = useQuery({
  queryKey: computed(() =>
    queryKeys.knowledgeJobs(tenantCode.value, pageNum.value, pageSize.value, status.value),
  ),
  queryFn: () =>
    knowledgeApi.jobs({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      status: status.value || undefined,
    }),
  enabled: computed(() =>
    Boolean(tenantCode.value && canIngestionRead.value && tab.value === 'jobs'),
  ),
})
const grants = useQuery({
  queryKey: computed(() => ['knowledge-scope-grants', tenantCode.value, grantForm.principalId]),
  queryFn: () => knowledgeApi.grants(grantForm.principalId.trim()),
  enabled: computed(() =>
    Boolean(
      tenantCode.value && canScope.value && tab.value === 'grants' && grantForm.principalId.trim(),
    ),
  ),
})
const indexVersions = useQuery({
  queryKey: computed(() => ['knowledge-index-versions', tenantCode.value]),
  queryFn: () => knowledgeApi.indexVersions(),
  enabled: computed(() => Boolean(tenantCode.value && canProfileRead.value)),
})
const createProfile = useMutation({
  mutationFn: () =>
    knowledgeApi.createProfile({
      ...profileForm,
      knowledgeScopes: profileForm.knowledgeScopes
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    }),
  onSuccess: () => {
    profileDialogVisible.value = false
    queryClient.invalidateQueries({ queryKey: ['tenant', tenantCode.value, 'knowledge-profiles'] })
    ElMessage.success('Profile 草稿已创建')
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
const publishProfile = useMutation({
  mutationFn: (id: number) => knowledgeApi.publishProfile(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tenant', tenantCode.value, 'knowledge-profiles'] })
    ElMessage.success('Profile 已发布')
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
const uploadDocument = useMutation({
  mutationFn: async () => {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(documentForm.content),
    )
    documentForm.contentHash = Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
    return knowledgeApi.uploadDocument(documentForm)
  },
  onSuccess: () => {
    documentDialogVisible.value = false
    queryClient.invalidateQueries({ queryKey: ['tenant', tenantCode.value, 'knowledge-jobs'] })
    ElMessage.success('文档已提交，摄取任务已排队')
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
const grantScope = useMutation({
  mutationFn: () =>
    knowledgeApi.grant({
      principalId: grantForm.principalId.trim(),
      scopeCode: grantForm.scopeCode.trim(),
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ['knowledge-scope-grants', tenantCode.value, grantForm.principalId],
    })
    grantForm.scopeCode = ''
    ElMessage.success('知识范围已授权')
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})
const revokeScope = useMutation({
  mutationFn: (scopeCode: string) => knowledgeApi.revoke(grantForm.principalId.trim(), scopeCode),
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ['knowledge-scope-grants', tenantCode.value, grantForm.principalId],
    })
    ElMessage.success('知识范围授权已移除')
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

function search() {
  pageNum.value = 1
}
function reset() {
  keyword.value = ''
  status.value = ''
  pageNum.value = 1
}
function changePage(page: number, size: number) {
  pageNum.value = page
  pageSize.value = size
}
function switchTab(next: 'profiles' | 'jobs' | 'grants') {
  tab.value = next
  pageNum.value = 1
  status.value = ''
}
function validGrant() {
  return Boolean(grantForm.principalId.trim() && grantForm.scopeCode.trim())
}
function openProfileDialog() {
  Object.assign(profileForm, {
    profileCode: '',
    strategy: 'HYBRID',
    maxResults: 10,
    minimumScore: 0,
    indexVersionId: indexVersions.data.value?.[0]?.id || 0,
    knowledgeScopes: '',
  })
  profileDialogVisible.value = true
}
function openDocumentDialog() {
  Object.assign(documentForm, {
    sourceCode: '',
    sourceName: '',
    externalDocumentId: '',
    version: 1,
    contentHash: '',
    content: '',
  })
  documentDialogVisible.value = true
}
function validProfile() {
  return Boolean(
    profileForm.profileCode.trim() &&
    profileForm.knowledgeScopes.split(',').some((item) => item.trim()) &&
    profileForm.indexVersionId > 0 &&
    profileForm.maxResults >= 1 &&
    profileForm.maxResults <= 50,
  )
}
function validDocument() {
  return Boolean(
    documentForm.sourceCode.trim() &&
    documentForm.externalDocumentId.trim() &&
    documentForm.content.trim(),
  )
}
async function publish(id: number) {
  await ElMessageBox.confirm('发布后该版本将作为运行时检索契约，是否继续？', '发布 Profile', {
    type: 'warning',
    confirmButtonText: '发布',
    cancelButtonText: '取消',
  })
  publishProfile.mutate(id)
}
async function onDocumentFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const content = await file.text()
  documentForm.content = content
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  documentForm.contentHash = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
  if (!documentForm.externalDocumentId) documentForm.externalDocumentId = file.name
  const input = event.target as HTMLInputElement
  input.value = ''
}
</script>

<template>
  <div class="management-page directory-page knowledge-page">
    <PageHeader
      eyebrow="KNOWLEDGE OPERATIONS"
      title="知识库管理"
      description="管理租户内的检索 Profile、文档摄取状态与授权边界；只有发布后的配置才可成为运行时契约。"
    >
      <template #actions
        ><el-button
          text
          @click="
            tab === 'profiles'
              ? profiles.refetch()
              : tab === 'jobs'
                ? jobs.refetch()
                : grants.refetch()
          "
          ><RefreshCw :size="15" />刷新</el-button
        ><el-button v-if="canDocument" type="primary" @click="openDocumentDialog"
          ><FileUp :size="15" />上传文档</el-button
        ></template
      >
    </PageHeader>
    <section class="knowledge-tabs" role="tablist">
      <button :class="{ active: tab === 'profiles' }" @click="switchTab('profiles')">
        <BookOpen :size="16" />检索 Profile
      </button>
      <button :class="{ active: tab === 'jobs' }" @click="switchTab('jobs')">摄取任务</button>
      <button :class="{ active: tab === 'grants' }" @click="switchTab('grants')">
        主体范围授权
      </button>
    </section>
    <section class="table-panel knowledge-panel">
      <SectionHeader
        :title="
          tab === 'profiles' ? '检索配置版本' : tab === 'jobs' ? '文档摄取任务' : '主体范围授权'
        "
        :description="
          tab === 'profiles'
            ? '先上传并完成索引，再创建 Profile；草稿只有发布后才能绑定运行时。'
            : tab === 'jobs'
              ? '任务按租户隔离，重复文档通过内容哈希幂等。'
              : '为 AgentRun 的可信主体授权 Profile 使用的知识范围，运行时只取授权范围与配置范围的交集。'
        "
        heading-level="h3"
        ><template #actions
          ><el-button
            v-if="tab === 'profiles' && canProfile"
            type="primary"
            @click="openProfileDialog"
            >新增 Profile</el-button
          ></template
        ></SectionHeader
      >
      <div class="knowledge-filters" v-if="tab === 'profiles'">
        <el-input
          v-model="keyword"
          placeholder="搜索 Profile 编码"
          clearable
          @keyup.enter="search"
        /><el-select v-model="status" placeholder="全部状态" clearable
          ><el-option label="草稿" value="DRAFT" /><el-option
            label="已发布"
            value="PUBLISHED" /></el-select
        ><el-button type="primary" @click="search">查询</el-button
        ><el-button @click="reset">重置</el-button>
      </div>
      <div v-else-if="tab === 'grants'" class="knowledge-filters knowledge-grant-filters">
        <el-input
          v-model="grantForm.principalId"
          placeholder="主体 ID，例如 admin"
          clearable
          @keyup.enter="grants.refetch()"
        />
        <el-input
          v-model="grantForm.scopeCode"
          placeholder="知识范围，例如 hr"
          clearable
          @keyup.enter="grantScope.mutate()"
        />
        <el-button
          type="primary"
          :disabled="!validGrant()"
          :loading="grantScope.isPending.value"
          @click="grantScope.mutate()"
          >授权范围</el-button
        >
        <el-button :disabled="!grantForm.principalId.trim()" @click="grants.refetch()"
          >查询授权</el-button
        >
      </div>
      <el-table
        v-if="tab === 'profiles'"
        v-loading="profiles.isFetching.value"
        :data="profiles.data.value?.records || []"
        row-key="id"
        ><el-table-column prop="profileCode" label="Profile" min-width="220" /><el-table-column
          label="版本"
          width="110"
          ><template #default="{ row }"
            ><StatusBadge
              variant="version"
              :status="row.status"
              :label="`第 ${row.version} 版`" /></template></el-table-column
        ><el-table-column prop="strategy" label="策略" width="140" /><el-table-column
          prop="maxResults"
          label="Top K"
          width="90"
        /><el-table-column label="状态" width="120"
          ><template #default="{ row }"
            ><StatusBadge :status="row.status" /></template></el-table-column
        ><el-table-column label="操作" width="120"
          ><template #default="{ row }"
            ><el-button
              v-if="row.status === 'DRAFT' && canProfile"
              link
              type="primary"
              @click="publish(row.id)"
              >发布</el-button
            ><span v-else class="muted">—</span></template
          ></el-table-column
        ></el-table
      >
      <el-table
        v-else-if="tab === 'jobs'"
        v-loading="jobs.isFetching.value"
        :data="jobs.data.value?.records || []"
        row-key="id"
        ><el-table-column prop="sourceCode" label="知识源" min-width="180" /><el-table-column
          prop="documentHash"
          label="内容哈希"
          min-width="220"
          show-overflow-tooltip /><el-table-column
          prop="attempt"
          label="尝试次数"
          width="110" /><el-table-column label="状态" width="120"
          ><template #default="{ row }"
            ><StatusBadge :status="row.status" /></template></el-table-column
        ><el-table-column prop="errorCode" label="错误码" min-width="180"
      /></el-table>
      <el-table
        v-else
        v-loading="grants.isFetching.value"
        :data="grants.data.value || []"
        row-key="scopeCode"
      >
        <el-table-column prop="principalId" label="主体 ID" min-width="220" />
        <el-table-column prop="scopeCode" label="知识范围" min-width="180" />
        <el-table-column prop="createdAt" label="授权时间" min-width="180" />
        <el-table-column label="操作" width="120"
          ><template #default="{ row }"
            ><el-button
              v-if="canScope"
              link
              type="danger"
              @click="revokeScope.mutate(row.scopeCode)"
              >移除授权</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <ListEmptyState
        v-if="
          (tab === 'profiles'
            ? profiles.data.value?.records
            : tab === 'jobs'
              ? jobs.data.value?.records
              : grants.data.value
          )?.length === 0 &&
          !(tab === 'profiles'
            ? profiles.isFetching.value
            : tab === 'jobs'
              ? jobs.isFetching.value
              : grants.isFetching.value)
        "
        title="暂无数据"
        :description="
          tab === 'grants' && !grantForm.principalId.trim()
            ? '输入主体 ID 后查询其知识范围授权。'
            : '当前租户还没有可展示的知识配置。'
        "
      /><TablePagination
        v-if="tab !== 'grants'"
        :total="tab === 'profiles' ? profiles.data.value?.total || 0 : jobs.data.value?.total || 0"
        :current-page="pageNum"
        :page-size="pageSize"
        @change="changePage"
      /><el-alert
        v-if="
          tab === 'profiles'
            ? profiles.isError.value
            : tab === 'jobs'
              ? jobs.isError.value
              : grants.isError.value
        "
        type="error"
        :closable="false"
        :title="
          getErrorMessage(
            tab === 'profiles'
              ? profiles.error.value
              : tab === 'jobs'
                ? jobs.error.value
                : grants.error.value,
          )
        "
      />
    </section>

    <el-dialog
      v-model="profileDialogVisible"
      title="新增检索 Profile"
      width="560px"
      destroy-on-close
      ><el-form label-position="top"
        ><el-form-item label="Profile 编码" required
          ><el-input
            v-model="profileForm.profileCode"
            placeholder="例如 employee-search" /></el-form-item
        ><el-form-item label="检索策略"
          ><el-select v-model="profileForm.strategy" class="full-width"
            ><el-option label="混合检索" value="HYBRID" /><el-option
              label="关键词检索"
              value="KEYWORD" /></el-select></el-form-item
        ><el-form-item label="可用索引版本" required
          ><el-select
            v-model="profileForm.indexVersionId"
            class="full-width"
            placeholder="选择已完成的索引"
            ><el-option
              v-for="item in indexVersions.data.value || []"
              :key="item.id"
              :label="`${item.sourceCode} · 第 ${item.version} 版 · ${item.embeddingModel}`"
              :value="item.id"
          /></el-select>
          <div v-if="indexVersions.data.value?.length === 0" class="form-help">
            暂无 ACTIVE 索引，请先上传文档并等待摄取完成。
          </div></el-form-item
        >
        <div class="form-grid">
          <el-form-item label="Top K"
            ><el-input-number v-model="profileForm.maxResults" :min="1" :max="50" /></el-form-item
          ><el-form-item label="最低分数"
            ><el-input-number v-model="profileForm.minimumScore" :min="0" :max="1" :step="0.05"
          /></el-form-item>
        </div>
        <el-form-item label="知识范围" required
          ><el-input
            v-model="profileForm.knowledgeScopes"
            placeholder="多个范围用逗号分隔，例如 hr,policy"
          />
          <div class="form-help">
            至少配置一个范围，并在“主体范围授权”中授予运行主体；范围用于运行时求交，不会替代租户隔离。
          </div></el-form-item
        ></el-form
      ><template #footer
        ><el-button @click="profileDialogVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="createProfile.isPending.value"
          :disabled="!validProfile()"
          @click="createProfile.mutate()"
          >创建草稿</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="documentDialogVisible"
      title="上传文本 / Markdown 文档"
      width="620px"
      destroy-on-close
      ><el-form label-position="top"
        ><div class="form-grid">
          <el-form-item label="知识源编码" required
            ><el-input
              v-model="documentForm.sourceCode"
              placeholder="例如 handbook" /></el-form-item
          ><el-form-item label="知识源名称"
            ><el-input v-model="documentForm.sourceName" placeholder="员工手册"
          /></el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="文档标识" required
            ><el-input
              v-model="documentForm.externalDocumentId"
              placeholder="例如 onboarding.md" /></el-form-item
          ><el-form-item label="版本"
            ><el-input-number v-model="documentForm.version" :min="1"
          /></el-form-item>
        </div>
        <el-form-item label="选择文件"
          ><div class="file-picker">
            <input
              ref="documentFileInput"
              class="file-picker__input"
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              @change="onDocumentFileChange"
            />
            <el-button @click="documentFileInput?.click()"
              ><FileUp :size="15" />选择 .txt / .md</el-button
            >
          </div>
          <div class="form-help">
            首期只接受 UTF-8 文本和 Markdown，文件内容会在浏览器读取后提交。
          </div></el-form-item
        ><el-form-item label="文档内容" required
          ><el-input
            v-model="documentForm.content"
            type="textarea"
            :rows="8"
            placeholder="也可以直接粘贴文本内容" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="documentDialogVisible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="uploadDocument.isPending.value"
          :disabled="!validDocument()"
          @click="uploadDocument.mutate()"
          >提交摄取任务</el-button
        ></template
      ></el-dialog
    >
  </div>
</template>

<style scoped>
.knowledge-tabs {
  display: flex;
  gap: 8px;
  margin: 18px 0;
  border-bottom: 1px solid var(--color-border);
}
.knowledge-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
.knowledge-tabs button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}
.knowledge-filters {
  display: flex;
  gap: 10px;
  padding: 16px 0;
}
.knowledge-filters .el-input {
  width: 280px;
}
.knowledge-filters .el-select {
  width: 160px;
}
.full-width {
  width: 100%;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.form-help,
.muted {
  color: var(--color-text-muted);
  font-size: 12px;
}
.form-help {
  margin-top: 6px;
  line-height: 1.5;
}
.file-picker__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
@media (max-width: 720px) {
  .knowledge-filters,
  .form-grid {
    display: grid;
    grid-template-columns: 1fr;
  }
  .knowledge-filters .el-input,
  .knowledge-filters .el-select {
    width: 100%;
  }
}
</style>
