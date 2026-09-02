<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from '@lucide/vue'
import type { PublishedAgentVersion } from '@/features/agent'

interface MappingRow {
  field: string
  source?: string
  target?: string
}

interface SchemaPathOption {
  path: string
  type: string
  mapping: 'value' | 'array' | 'index' | 'projection'
}

const props = defineProps<{
  agentVersionId: string
  agentVersions: PublishedAgentVersion[]
  selectedAgentVersion?: PublishedAgentVersion
  agentVersionSearchLoading: boolean
  agentInputSchemaFields: SchemaPathOption[]
  agentOutputSchemaFields: SchemaPathOption[]
  agentMappingRows: MappingRow[]
  agentOutputMappingRows: MappingRow[]
  agentProcessWaitTimeoutSeconds: number
  agentProcessFailurePolicy: 'CONTINUE_EMPTY' | 'MANUAL_REVIEW' | 'HOLD_FOR_OPERATIONS'
  searchAgentVersions: (query: string) => void
  schemaFieldLabel: (field: SchemaPathOption) => string
  applyAgentVersion: (value: string) => void
  applyAgentMappings: () => void
  addAgentMappingRow: () => void
  removeAgentMappingRow: (index: number) => void
  addAgentOutputMappingRow: () => void
  removeAgentOutputMappingRow: (index: number) => void
  applyAgentProcessPolicy: () => void
}>()

const activeSection = ref<'version' | 'input' | 'output' | 'policy'>('version')

const emit = defineEmits<{
  'update:agentVersionId': [value: string]
  'update:agentProcessWaitTimeoutSeconds': [value: number]
  'update:agentProcessFailurePolicy': [
    value: 'CONTINUE_EMPTY' | 'MANUAL_REVIEW' | 'HOLD_FOR_OPERATIONS',
  ]
  apply: []
  discard: []
  'draft-change': []
}>()

function handleAgentVersionChange(value: string) {
  emit('update:agentVersionId', value)
  emit('draft-change')
}

function addInputMapping() {
  props.addAgentMappingRow()
  emit('draft-change')
}

function removeInputMapping(index: number) {
  props.removeAgentMappingRow(index)
  emit('draft-change')
}

function addOutputMapping() {
  props.addAgentOutputMappingRow()
  emit('draft-change')
}

function removeOutputMapping(index: number) {
  props.removeAgentOutputMappingRow(index)
  emit('draft-change')
}

function handleWaitTimeoutChange(value: number | undefined) {
  emit('update:agentProcessWaitTimeoutSeconds', value || 1)
  emit('draft-change')
}

function handleFailurePolicyChange(
  value: 'CONTINUE_EMPTY' | 'MANUAL_REVIEW' | 'HOLD_FOR_OPERATIONS',
) {
  emit('update:agentProcessFailurePolicy', value)
  emit('draft-change')
}
</script>

<template>
  <div class="property-block agent-task-config">
    <div class="agent-workbench-content">
      <div class="agent-workbench-tabs" role="tablist" aria-label="Agent 配置分区">
        <button
          :class="{ active: activeSection === 'version' }"
          type="button"
          role="tab"
          @click="activeSection = 'version'"
        >
          版本
        </button>
        <button
          :class="{ active: activeSection === 'input' }"
          type="button"
          role="tab"
          @click="activeSection = 'input'"
        >
          输入映射 <em>{{ props.agentMappingRows.length }}</em>
        </button>
        <button
          :class="{ active: activeSection === 'output' }"
          type="button"
          role="tab"
          @click="activeSection = 'output'"
        >
          输出映射 <em>{{ props.agentOutputMappingRows.length }}</em>
        </button>
        <button
          :class="{ active: activeSection === 'policy' }"
          type="button"
          role="tab"
          @click="activeSection = 'policy'"
        >
          执行策略
        </button>
      </div>
      <div v-if="activeSection === 'version'" class="agent-config-section">
        <div class="agent-config-section__intro">
          <strong>选择已发布版本</strong><span>运行时使用冻结的版本契约</span>
        </div>
        <el-select
          :model-value="props.agentVersionId"
          filterable
          remote
          clearable
          :remote-method="props.searchAgentVersions"
          :loading="props.agentVersionSearchLoading"
          placeholder="选择已发布 Agent 版本"
          @update:model-value="handleAgentVersionChange"
        >
          <el-option
            v-for="version in props.agentVersions"
            :key="version.id"
            :label="`${version.agentName} · 第 ${version.version} 版`"
            :value="String(version.id)"
          />
        </el-select>
        <div v-if="props.selectedAgentVersion" class="agent-version-summary">
          <span
            >执行方式：{{
              props.selectedAgentVersion.executionMode === 'PLATFORM_AGENT'
                ? '平台 Agent'
                : '模型调用'
            }}</span
          >
          <span>运行上限：{{ props.selectedAgentVersion.timeoutSeconds }} 秒</span>
          <span v-if="props.selectedAgentVersion.executionMode === 'PLATFORM_AGENT'"
            >工具集合已冻结</span
          >
          <span>输入、输出契约以该已发布版本为准</span>
        </div>
      </div>
      <div v-else-if="activeSection === 'input'" class="agent-config-section">
        <div class="agent-config-section__intro">
          <strong>Agent 字段 ← 流程变量</strong><span>只传递显式映射的数据</span
          ><el-button link type="primary" @click="addInputMapping"
            ><Plus :size="14" />新增映射</el-button
          >
        </div>
        <div class="agent-mapping-editor">
          <div class="agent-mapping-table-head">
            <span>Agent 输入字段</span><span>流程变量路径</span><span>操作</span>
          </div>
          <div
            v-for="(row, index) in props.agentMappingRows"
            :key="index"
            class="agent-mapping-row"
          >
            <el-input
              v-if="!props.agentInputSchemaFields.length"
              v-model="row.field"
              placeholder="例如 customerName"
              @input="emit('draft-change')"
            />
            <el-select
              v-else
              v-model="row.field"
              filterable
              placeholder="选择输入字段"
              @change="emit('draft-change')"
              ><el-option
                v-for="field in props.agentInputSchemaFields"
                :key="field.path"
                :label="props.schemaFieldLabel(field)"
                :value="field.path"
            /></el-select>
            <el-input
              v-model="row.source"
              placeholder="例如 customer.name"
              @input="emit('draft-change')"
            />
            <el-button link type="danger" @click="removeInputMapping(index)">删除</el-button>
          </div>
          <div v-if="!props.agentMappingRows.length" class="agent-mapping-editor__empty">
            暂无输入映射
          </div>
        </div>
        <p class="property-hint">
          支持标量、对象字段和整个数组；数组索引与通配投影仅适用于输出读取。
        </p>
      </div>
      <div v-else-if="activeSection === 'output'" class="agent-config-section">
        <div class="agent-config-section__intro">
          <strong>Agent 输出字段 → 流程变量</strong><span>模型结果按映射写入流程变量</span
          ><el-button link type="primary" @click="addOutputMapping"
            ><Plus :size="14" />新增映射</el-button
          >
        </div>
        <div class="agent-mapping-editor">
          <div class="agent-mapping-table-head">
            <span>Agent 输出字段</span><span>目标流程变量</span><span>操作</span>
          </div>
          <div
            v-for="(row, index) in props.agentOutputMappingRows"
            :key="index"
            class="agent-mapping-row"
          >
            <el-input
              v-if="!props.agentOutputSchemaFields.length"
              v-model="row.field"
              placeholder="例如 decision"
              @input="emit('draft-change')"
            />
            <el-select
              v-else
              v-model="row.field"
              filterable
              placeholder="选择输出字段"
              @change="emit('draft-change')"
              ><el-option
                v-for="field in props.agentOutputSchemaFields"
                :key="field.path"
                :label="props.schemaFieldLabel(field)"
                :value="field.path"
            /></el-select>
            <el-input
              v-model="row.target"
              placeholder="例如 agentDecision"
              @input="emit('draft-change')"
            />
            <el-button link type="danger" @click="removeOutputMapping(index)">删除</el-button>
          </div>
          <div v-if="!props.agentOutputMappingRows.length" class="agent-mapping-editor__empty">
            暂无输出映射
          </div>
        </div>
        <p class="property-hint">
          支持整个数组、固定索引（如 items.0）和通配投影（如 items.*.name）。
        </p>
      </div>
      <div v-else class="agent-config-section agent-policy-grid">
        <div class="agent-config-section__intro">
          <strong>执行策略</strong><span>控制等待时限与失败后的流程行为</span>
        </div>
        <el-form-item label="流程等待时限（秒）" required
          ><el-input-number
            :model-value="props.agentProcessWaitTimeoutSeconds"
            :min="1"
            :max="props.selectedAgentVersion?.timeoutSeconds || 3600"
            @update:model-value="handleWaitTimeoutChange"
          />
          <p class="property-hint">不能超过 Agent 版本的运行上限。</p></el-form-item
        >
        <el-form-item label="流程失败处理" required
          ><el-select
            :model-value="props.agentProcessFailurePolicy"
            @update:model-value="handleFailurePolicyChange"
            ><el-option label="保留现场，等待运维处理" value="HOLD_FOR_OPERATIONS" /><el-option
              label="以空结果继续"
              value="CONTINUE_EMPTY"
          /></el-select>
          <p class="property-hint">失败不会隐式删除流程实例。</p></el-form-item
        >
      </div>
    </div>
    <p class="property-hint agent-config-note">Agent 任务异步执行，完成事件校验通过后继续流程。</p>
    <div class="agent-workbench-actions">
      <el-button @click="emit('discard')">放弃修改</el-button>
      <el-button type="primary" @click="emit('apply')">应用到节点</el-button>
    </div>
  </div>
</template>
