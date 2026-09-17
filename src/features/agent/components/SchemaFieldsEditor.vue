<script setup lang="ts">
import { Plus } from '@lucide/vue'
import type { SchemaField } from '../composables/useAgentSchemaEditor'

const props = defineProps<{
  fields: SchemaField[]
  readonly?: boolean
  direction: 'input' | 'output'
}>()

const emit = defineEmits<{
  add: []
  remove: [index: number]
}>()
</script>

<template>
  <div class="schema-editor">
    <div class="schema-editor__toolbar">
      <span>{{
        direction === 'input'
          ? '配置业务输入字段，保存时自动生成 JSON Schema'
          : '配置模型输出字段，保存时自动生成 JSON Schema'
      }}</span>
      <el-button link type="primary" :disabled="readonly" @click="emit('add')">
        <Plus :size="15" />新增字段
      </el-button>
    </div>
    <el-table :data="props.fields" size="small" border>
      <el-table-column label="字段路径" min-width="180">
        <template #default="{ row }">
          <el-input
            v-model="row.path"
            :placeholder="direction === 'input' ? '例如 customer.name' : '例如 result.summary'"
            :disabled="readonly"
          />
        </template>
      </el-table-column>
      <el-table-column label="类型" width="130">
        <template #default="{ row }">
          <el-select v-model="row.type" :disabled="readonly">
            <el-option label="文本" value="string" />
            <el-option label="数字" value="number" />
            <el-option label="整数" value="integer" />
            <el-option label="布尔值" value="boolean" />
            <el-option label="对象" value="object" />
            <el-option label="数组" value="array" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="数组元素" width="130">
        <template #default="{ row }">
          <el-select v-model="row.itemType" :disabled="readonly || row.type !== 'array'">
            <el-option label="文本" value="string" />
            <el-option label="数字" value="number" />
            <el-option label="整数" value="integer" />
            <el-option label="布尔值" value="boolean" />
            <el-option label="对象" value="object" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="必填" width="75" align="center">
        <template #default="{ row }"
          ><el-checkbox v-model="row.required" :disabled="readonly"
        /></template>
      </el-table-column>
      <el-table-column label="说明" min-width="150">
        <template #default="{ row }"
          ><el-input v-model="row.description" :disabled="readonly"
        /></template>
      </el-table-column>
      <el-table-column label="操作" width="70" align="center">
        <template #default="{ $index }">
          <el-button link type="danger" :disabled="readonly" @click="emit('remove', $index)"
            >删除</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <div v-if="!fields.length" class="schema-editor__empty">
      {{
        direction === 'input'
          ? '暂未配置输入字段，Agent 将接收空对象或由流程映射提供的数据。'
          : '暂未配置输出字段，Agent 输出将不做结构化字段约束。'
      }}
    </div>
  </div>
</template>

<style scoped>
.schema-editor {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
}

.schema-editor__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.schema-editor__empty {
  padding: 16px 10px 6px;
  color: var(--color-text-subtle);
  text-align: center;
  font-size: 12px;
}
</style>
