<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Boxes,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Plus,
  RefreshCw,
  Search,
  SquarePen,
  Trash2,
} from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { createBlankBpmn } from '@/utils/bpmn'
import { formatDateTime } from '@/utils/format'
import { definitionApi } from '../api'
import type { PublishStatus } from '../types'

const router = useRouter()
const queryClient = useQueryClient()
const query = reactive({
  processDefinitionKey: '',
  processDefinitionName: '',
  publishStatus: 'all' as PublishStatus,
  pageNum: 1,
  pageSize: 20,
})
const applied = ref({ ...query })
const createVisible = ref(false)
const createForm = reactive({ processDefinitionKey: '', processDefinitionName: '' })

const definitionsQuery = useQuery({
  queryKey: computed(() => ['process-definitions', applied.value]),
  queryFn: () => definitionApi.page(applied.value),
})

const records = computed(() => definitionsQuery.data.value?.records ?? [])
const total = computed(() => definitionsQuery.data.value?.total ?? 0)
const publishedCount = computed(() => records.value.filter((item) => item.activeVersion).length)
const draftCount = computed(() => Math.max(records.value.length - publishedCount.value, 0))

const deleteMutation = useMutation({
  mutationFn: definitionApi.deleteAll,
  onSuccess: async () => {
    ElMessage.success('流程定义已删除')
    await queryClient.invalidateQueries({ queryKey: ['process-definitions'] })
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

const createMutation = useMutation({
  mutationFn: async () => {
    const key = createForm.processDefinitionKey.trim()
    const name = createForm.processDefinitionName.trim()
    if (!key || !name) throw new Error('流程标识和流程名称不能为空')
    if (!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(key)) {
      throw new Error('流程标识应以字母开头，只能包含字母、数字、下划线和短横线')
    }
    if (await definitionApi.exists(key)) throw new Error(`流程标识已存在：${key}`)
    return { key, name, xml: createBlankBpmn(key, name) }
  },
  onSuccess: ({ key, name, xml }) => {
    createVisible.value = false
    router.push({ name: 'process-designer', query: { key, name, draft: encodeURIComponent(xml) } })
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

function search() {
  query.pageNum = 1
  applied.value = { ...query }
}

function reset() {
  Object.assign(query, {
    processDefinitionKey: '',
    processDefinitionName: '',
    publishStatus: 'all',
    pageNum: 1,
  })
  applied.value = { ...query }
}

function changePage(pageNum: number, pageSize: number) {
  query.pageNum = pageNum
  query.pageSize = pageSize
  applied.value = { ...query }
}

async function remove(key: string, name: string) {
  await ElMessageBox.confirm(
    `将删除“${name}”的全部版本及部署数据。运行中实例可能阻止删除，是否继续？`,
    '删除流程定义',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  )
  deleteMutation.mutate(key)
}
</script>

<template>
  <div class="definition-page page-stack">
    <section class="page-hero">
      <div>
        <span class="eyebrow">Process Definition</span>
        <h2>流程定义中心</h2>
        <p>集中管理 BPMN 模型、版本发布和流程设计入口。先创建定义，再进入设计器完善节点和派单规则。</p>
      </div>
      <div class="hero-actions">
        <el-button @click="reset"><RefreshCw :size="16" />重置筛选</el-button>
        <el-button type="primary" size="large" @click="createVisible = true">
          <Plus :size="18" />新建流程
        </el-button>
      </div>
    </section>

    <section class="metric-grid">
      <article class="metric-card">
        <span><Boxes :size="18" /></span>
        <div>
          <strong>{{ total }}</strong>
          <small>流程定义总数</small>
        </div>
      </article>
      <article class="metric-card success">
        <span><CheckCircle2 :size="18" /></span>
        <div>
          <strong>{{ publishedCount }}</strong>
          <small>当前页已发布</small>
        </div>
      </article>
      <article class="metric-card warning">
        <span><Clock3 :size="18" /></span>
        <div>
          <strong>{{ draftCount }}</strong>
          <small>当前页未发布</small>
        </div>
      </article>
    </section>

    <section class="page-actions compact-filter">
      <el-form class="filter-form" inline @submit.prevent="search">
        <el-form-item label="流程标识">
          <el-input
            v-model="query.processDefinitionKey"
            clearable
            placeholder="例如 expense_approval"
          />
        </el-form-item>
        <el-form-item label="流程名称">
          <el-input v-model="query.processDefinitionName" clearable placeholder="输入流程名称" />
        </el-form-item>
        <el-form-item label="发布状态">
          <el-select v-model="query.publishStatus" style="width: 132px">
            <el-option label="全部" value="all" />
            <el-option label="已发布" value="published" />
            <el-option label="未发布" value="unpublished" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit"><Search :size="16" />查询</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="table-panel elevated-panel">
      <el-table
        v-loading="definitionsQuery.isFetching.value"
        :data="records"
        height="100%"
        table-layout="fixed"
      >
        <el-table-column
          prop="processDefinitionName"
          label="流程名称"
          min-width="210"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div class="definition-name-cell">
              <span class="definition-avatar">{{ row.processDefinitionName?.slice(0, 1) || '流' }}</span>
              <div>
                <strong>{{ row.processDefinitionName }}</strong>
                <small>{{ row.processDefinitionKey }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="processDefinitionKey"
          label="流程标识"
          min-width="190"
          show-overflow-tooltip
        />
        <el-table-column label="版本" width="140">
          <template #default="{ row }">
            <span class="version-pair">v{{ row.latestVersion }}</span>
            <span v-if="row.activeVersion" class="muted-text"> / 发布 v{{ row.activeVersion }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.activeVersion ? 'success' : 'info'" effect="light" round>
              {{ row.activeVersion ? '已发布' : '未发布' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最新部署时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.latestDeployTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="184" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="
                router.push({ name: 'process-designer', query: { key: row.processDefinitionKey } })
              "
            >
              <SquarePen :size="15" />设计
            </el-button>
            <el-button
              link
              type="danger"
              @click="remove(row.processDefinitionKey, row.processDefinitionName)"
            >
              <Trash2 :size="15" />删除
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-landing">
            <span><FilePlus2 :size="32" /></span>
            <strong>还没有流程定义</strong>
            <p>创建第一个 BPMN 流程，完成建模后即可发布版本并发起流程实例。</p>
            <el-button type="primary" @click="createVisible = true">
              <Plus :size="16" />新建流程
            </el-button>
          </div>
        </template>
      </el-table>
      <el-pagination
        class="table-pagination"
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @change="changePage"
      />
    </section>

    <el-dialog v-model="createVisible" title="新建流程" width="480px" destroy-on-close>
      <el-form label-position="top" @submit.prevent="createMutation.mutate()">
        <el-form-item label="流程标识" required>
          <el-input
            v-model="createForm.processDefinitionKey"
            maxlength="64"
            placeholder="expense_approval"
          />
        </el-form-item>
        <el-form-item label="流程名称" required>
          <el-input
            v-model="createForm.processDefinitionName"
            maxlength="128"
            placeholder="费用审批"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="createMutation.isPending.value"
          @click="createMutation.mutate()"
        >
          创建并设计
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
