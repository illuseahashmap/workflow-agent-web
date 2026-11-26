<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { knowledgeApi } from '../api'
import { getErrorMessage } from '@/api/http'

defineEmits<{ close: [] }>()
const trace = ref('')
const chunk = ref('')
const preview = ref<Awaited<ReturnType<typeof knowledgeApi.previewCitation>> | null>(null)
const error = ref('')
const location = computed(() => {
  if (!preview.value) return ''
  const {
    format,
    anchor: { part, start, end },
  } = preview.value
  if (format === 'DOCX') {
    const paragraph = /^body\/p\[(\d+)\]$/.exec(start)
    if (paragraph) return `正文第 ${paragraph[1]} 段`
    const row = /^body\/tbl\[(\d+)\]\/tr\[(\d+)\]$/.exec(start)
    if (row) return `正文第 ${row[1]} 个表格 · 第 ${row[2]} 行`
  }
  return `${part || '行'} ${start === end ? start : start + ' – ' + end}`
})
const busy = ref(false)
let generation = 0
watch(
  [trace, chunk],
  () => {
    generation++
    preview.value = null
    error.value = ''
    busy.value = false
  },
  { flush: 'sync' },
)
async function read() {
  const id = ++generation
  preview.value = null
  error.value = ''
  busy.value = true
  try {
    const result = await knowledgeApi.previewCitation(trace.value.trim(), chunk.value.trim())
    if (id === generation) preview.value = result
  } catch (e) {
    if (id === generation) error.value = getErrorMessage(e)
  } finally {
    if (id === generation) busy.value = false
  }
}
</script>
<template>
  <el-dialog :model-value="true" title="回读引用" width="min(600px, 94vw)" @close="$emit('close')">
    <el-form label-position="top" @submit.prevent="read">
      <el-form-item label="检索 Trace ID"
        ><el-input v-model="trace" placeholder="knowledge_search 结果中的 traceId"
      /></el-form-item>
      <el-form-item label="引用位置 ID"
        ><el-input v-model="chunk" placeholder="引用中的 reference.locator"
      /></el-form-item>
      <el-button
        type="primary"
        native-type="submit"
        :disabled="!trace.trim() || !chunk.trim()"
        :loading="busy"
        >读取原文</el-button
      >
    </el-form>
    <p v-if="error" role="alert">{{ error }}</p>
    <section v-if="preview" aria-live="polite">
      <h4>{{ preview.format }} · {{ location }}</h4>
      <p class="excerpt">{{ preview.excerpt }}</p>
    </section>
  </el-dialog>
</template>
<style scoped>
.excerpt {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
