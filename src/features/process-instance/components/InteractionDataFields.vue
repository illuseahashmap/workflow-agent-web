<script setup lang="ts">
import type { InteractionDataField } from '../types'
import type { InteractionValues } from '../interaction'

defineProps<{
  fields: InteractionDataField[]
  agentActivityIds?: string[]
  loading?: boolean
}>()
const values = defineModel<InteractionValues>({ required: true })

function placeholder(field: InteractionDataField) {
  if (field.dataType === 'object') return '请输入 JSON 对象，例如 {"name":"示例"}'
  if (field.dataType === 'array') return '请输入 JSON 数组，例如 ["A","B"]'
  return field.description || `请输入${field.label}`
}
</script>

<template>
  <section
    v-if="fields.length || (!loading && agentActivityIds?.length)"
    class="interaction-fields"
    v-loading="loading"
  >
    <header>
      <div>
        <h3>Agent 业务输入</h3>
        <p>这些数据来自流程中即将执行的 Agent 输入契约，提交后由系统完成映射。</p>
      </div>
    </header>
    <div class="interaction-fields__grid">
      <el-form-item
        v-for="field in fields"
        :key="`${field.agentActivityId}:${field.variablePath}`"
        :label="field.label"
        :required="field.required"
        class="interaction-field"
      >
        <el-select
          v-if="field.dataType === 'boolean'"
          v-model="values[field.variablePath]"
          clearable
          placeholder="请选择"
        >
          <el-option label="是" :value="true" />
          <el-option label="否" :value="false" />
        </el-select>
        <el-input-number
          v-else-if="field.dataType === 'integer' || field.dataType === 'number'"
          v-model="values[field.variablePath] as number"
          :precision="field.dataType === 'integer' ? 0 : undefined"
          :controls="false"
          class="interaction-field__number"
          :placeholder="placeholder(field)"
        />
        <el-input
          v-else-if="field.dataType === 'object' || field.dataType === 'array'"
          v-model="values[field.variablePath] as string"
          type="textarea"
          :rows="3"
          :placeholder="placeholder(field)"
        />
        <el-input
          v-else
          v-model="values[field.variablePath] as string"
          :type="field.format === 'multiline' ? 'textarea' : 'text'"
          :rows="field.format === 'multiline' ? 3 : undefined"
          :placeholder="placeholder(field)"
        />
        <p v-if="field.description" class="interaction-field__description">
          {{ field.description }}
        </p>
        <span class="interaction-field__source">用于：{{ field.agentActivityName }}</span>
      </el-form-item>
    </div>
    <div v-if="!fields.length" class="interaction-fields__empty">
      即将进入的 Agent 节点未声明需要人工填写的业务数据，将按已发布配置运行。
    </div>
  </section>
</template>

<style scoped>
.interaction-fields {
  margin: 14px 0;
  padding: 16px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #f8fbff;
}

.interaction-fields header h3,
.interaction-fields header p,
.interaction-field__description {
  margin: 0;
}

.interaction-fields header h3 {
  color: #1e293b;
  font-size: 14px;
}

.interaction-fields header p,
.interaction-field__description,
.interaction-field__source {
  color: #64748b;
  font-size: 12px;
}

.interaction-fields header p {
  margin-top: 4px;
}

.interaction-fields__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
  margin-top: 14px;
}

.interaction-fields__empty {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px dashed #bfdbfe;
  border-radius: 9px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
}

.interaction-field__number {
  width: 100%;
}

.interaction-field__description {
  width: 100%;
  margin-top: 5px;
}

.interaction-field__source {
  display: block;
  width: 100%;
  margin-top: 4px;
}

@media (max-width: 620px) {
  .interaction-fields__grid {
    grid-template-columns: 1fr;
  }
}
</style>
