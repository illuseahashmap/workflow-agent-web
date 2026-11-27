<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElRadio, ElRadioGroup } from 'element-plus'
import { getErrorMessage } from '@/api/http'
import { agentApi } from '../api'
import type { AgentRuntimeBinding, AgentVersion } from '../types'

const props = defineProps<{ version: AgentVersion }>()
const visible = ref(false)
const busy = ref(false)
const error = ref('')
const configuration = ref<AgentRuntimeBinding>()
const editable = computed(() => props.version.status === 'DRAFT')
const valid = computed(() => {
  const value = configuration.value
  return (
    value &&
    (value.backend === 'NATIVE' ||
      (/^[a-f0-9]{64}$/.test(value.artifactDigest || '') &&
        Number.isInteger(value.maxModelCalls) &&
        value.maxModelCalls >= 1 &&
        value.maxModelCalls <= 100 &&
        Number.isInteger(value.maxToolCalls) &&
        value.maxToolCalls >= 0 &&
        value.maxToolCalls <= 200))
  )
})

async function open() {
  visible.value = true
  busy.value = true
  error.value = ''
  configuration.value = undefined
  try {
    configuration.value = await agentApi.runtime(props.version.id)
  } catch (failure) {
    error.value = getErrorMessage(failure)
  } finally {
    busy.value = false
  }
}

async function save() {
  if (!editable.value || !valid.value || !configuration.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const value = { ...configuration.value }
    if (value.backend === 'NATIVE') value.artifactDigest = null
    configuration.value = await agentApi.configureRuntime(props.version.id, value)
    ElMessage.success('运行引擎配置已保存，发布后锁定')
    visible.value = false
  } catch (failure) {
    error.value = getErrorMessage(failure)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <el-button link type="primary" @click="open">运行引擎</el-button>
  <el-dialog v-model="visible" title="版本运行引擎" width="560px" append-to-body>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <p>运行引擎与调用预算随版本发布锁定。已有版本默认使用原生执行。</p>
    <el-form v-if="configuration" label-position="top" :disabled="busy || !editable">
      <el-form-item label="执行引擎">
        <el-radio-group v-model="configuration.backend">
          <el-radio value="NATIVE">原生</el-radio>
          <el-radio
            value="LANGGRAPH"
            :disabled="busy || !editable || version.executionMode !== 'PLATFORM_AGENT'"
            >LangGraph</el-radio
          >
        </el-radio-group>
      </el-form-item>
      <template v-if="configuration.backend === 'LANGGRAPH'">
        <el-form-item label="已部署的图版本指纹（SHA-256）">
          <el-input v-model="configuration.artifactDigest" maxlength="64" />
        </el-form-item>
        <el-form-item label="每次运行的模型调用上限">
          <el-input-number
            v-model="configuration.maxModelCalls"
            :min="1"
            :max="100"
            :precision="0"
          />
        </el-form-item>
        <el-form-item label="每次运行的工具调用上限">
          <el-input-number
            v-model="configuration.maxToolCalls"
            :min="0"
            :max="200"
            :precision="0"
          />
        </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button v-if="editable" type="primary" :loading="busy" :disabled="!valid" @click="save"
        >保存</el-button
      >
    </template>
  </el-dialog>
</template>
