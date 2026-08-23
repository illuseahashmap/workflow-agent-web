<script setup lang="ts">
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

const emit = defineEmits<{
  'update:agentVersionId': [value: string]
  'update:agentProcessWaitTimeoutSeconds': [value: number]
  'update:agentProcessFailurePolicy': [
    value: 'CONTINUE_EMPTY' | 'MANUAL_REVIEW' | 'HOLD_FOR_OPERATIONS',
  ]
}>()
</script>

<template>
  <div class="property-block agent-task-config">
    <strong>Agent 配置</strong>
    <el-form label-position="top" size="small">
      <el-form-item label="已发布版本 ID" required>
        <el-select
          :model-value="props.agentVersionId"
          filterable
          remote
          clearable
          :remote-method="props.searchAgentVersions"
          :loading="props.agentVersionSearchLoading"
          placeholder="选择已发布 Agent 版本"
          @update:model-value="emit('update:agentVersionId', $event)"
          @change="props.applyAgentVersion"
        >
          <el-option
            v-for="version in props.agentVersions"
            :key="version.id"
            :label="`${version.agentName} · 第 ${version.version} 版`"
            :value="String(version.id)"
          />
        </el-select>
      </el-form-item>
      <div v-if="props.selectedAgentVersion" class="agent-version-summary">
        <span>执行方式：模型调用</span>
        <span>Agent 运行上限：{{ props.selectedAgentVersion.timeoutSeconds }} 秒</span>
        <span>输入、输出契约以该已发布版本为准</span>
      </div>
      <el-form-item label="输入字段映射">
        <div class="agent-mapping-editor">
          <div class="agent-mapping-editor__toolbar">
            <span>Agent 字段 ← 流程变量</span>
            <el-button link type="primary" @click="props.addAgentMappingRow">
              <Plus :size="14" />新增映射
            </el-button>
          </div>
          <div
            v-for="(row, index) in props.agentMappingRows"
            :key="index"
            class="agent-mapping-row"
          >
            <el-input
              v-if="!props.agentInputSchemaFields.length"
              v-model="row.field"
              placeholder="Agent 字段，例如 customerName"
              @blur="props.applyAgentMappings"
            />
            <el-select
              v-else
              v-model="row.field"
              filterable
              placeholder="选择 Agent 输入字段"
              @change="props.applyAgentMappings"
            >
              <el-option
                v-for="field in props.agentInputSchemaFields"
                :key="field.path"
                :label="props.schemaFieldLabel(field)"
                :value="field.path"
              />
            </el-select>
            <span>←</span>
            <el-input
              v-model="row.source"
              placeholder="流程变量，例如 customer.name"
              @blur="props.applyAgentMappings"
            />
            <el-button link type="danger" @click="props.removeAgentMappingRow(index)">
              删除
            </el-button>
          </div>
          <div v-if="!props.agentMappingRows.length" class="agent-mapping-editor__empty">
            暂无映射。未配置时不会自动传入流程变量。
          </div>
        </div>
        <p class="property-hint">
          左侧是 Agent
          输入字段，右侧是流程变量路径，只传递显式映射的数据。输入侧支持标量、对象字段和整个数组；数组索引与通配投影仅适用于输出读取。
        </p>
      </el-form-item>
      <el-form-item label="输出字段映射">
        <div class="agent-mapping-editor">
          <div class="agent-mapping-editor__toolbar">
            <span>Agent 输出字段 → 流程变量</span>
            <el-button link type="primary" @click="props.addAgentOutputMappingRow">
              <Plus :size="14" />新增映射
            </el-button>
          </div>
          <div
            v-for="(row, index) in props.agentOutputMappingRows"
            :key="index"
            class="agent-mapping-row"
          >
            <el-input
              v-if="!props.agentOutputSchemaFields.length"
              v-model="row.field"
              placeholder="输出字段，例如 decision"
              @blur="props.applyAgentMappings"
            />
            <el-select
              v-else
              v-model="row.field"
              filterable
              placeholder="选择 Agent 输出字段"
              @change="props.applyAgentMappings"
            >
              <el-option
                v-for="field in props.agentOutputSchemaFields"
                :key="field.path"
                :label="props.schemaFieldLabel(field)"
                :value="field.path"
              />
            </el-select>
            <span>→</span>
            <el-input
              v-model="row.target"
              placeholder="新流程变量，例如 agentDecision"
              @blur="props.applyAgentMappings"
            />
            <el-button link type="danger" @click="props.removeAgentOutputMappingRow(index)">
              删除
            </el-button>
          </div>
          <div v-if="!props.agentOutputMappingRows.length" class="agent-mapping-editor__empty">
            暂无映射。模型输出不会自动写入流程变量。
          </div>
        </div>
        <p class="property-hint">
          支持整个数组、固定索引（如 items.0）和通配投影（如 items.*.name）；投影结果写入数组变量。
        </p>
      </el-form-item>
      <el-form-item label="流程等待时限（秒）" required>
        <el-input-number
          :model-value="props.agentProcessWaitTimeoutSeconds"
          :min="1"
          :max="props.selectedAgentVersion?.timeoutSeconds || 3600"
          @update:model-value="emit('update:agentProcessWaitTimeoutSeconds', $event || 1)"
          @change="props.applyAgentProcessPolicy"
        />
        <p class="property-hint">只能小于或等于 Agent 版本的运行上限。</p>
      </el-form-item>
      <el-form-item label="流程失败处理" required>
        <el-select
          :model-value="props.agentProcessFailurePolicy"
          @update:model-value="emit('update:agentProcessFailurePolicy', $event)"
          @change="props.applyAgentProcessPolicy"
        >
          <el-option label="保留现场，等待运维处理" value="HOLD_FOR_OPERATIONS" />
          <el-option label="以空结果继续" value="CONTINUE_EMPTY" />
        </el-select>
        <p class="property-hint">
          Agent 失败不会隐式删除流程实例；人工复核将在任务中心能力完成后开放。
        </p>
      </el-form-item>
      <p class="property-hint">Agent 任务会异步执行，完成事件校验通过后继续流程。</p>
    </el-form>
  </div>
</template>
