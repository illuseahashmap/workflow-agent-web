<script setup lang="ts">
import { computed } from 'vue'
import { getStatusPresentation, type StatusTone } from '@/utils/status'

const props = defineProps<{
  status: string | boolean
  label?: string
  tone?: StatusTone
}>()

const presentation = computed(() => getStatusPresentation(props.status))
</script>

<template>
  <el-tag
    class="status-badge"
    :type="tone || presentation.tone"
    :data-tone="tone || presentation.tone"
    effect="light"
    size="small"
    round
    :title="String(status)"
  >
    {{ label || presentation.label }}
  </el-tag>
</template>

<style scoped>
.status-badge {
  width: 74px;
  min-width: 74px;
  box-sizing: border-box;
  height: 25px;
  justify-content: center;
  padding-inline: 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
}

.status-badge[data-tone='primary'] {
  --el-tag-bg-color: #edf4ff;
  --el-tag-border-color: #bfd5ff;
  --el-tag-text-color: #1d4ed8;
}

.status-badge[data-tone='success'] {
  --el-tag-bg-color: #ecf9f0;
  --el-tag-border-color: #b9e6c7;
  --el-tag-text-color: #15803d;
}

.status-badge[data-tone='warning'] {
  --el-tag-bg-color: #fff8e8;
  --el-tag-border-color: #f5d99a;
  --el-tag-text-color: #a85b08;
}

.status-badge[data-tone='danger'] {
  --el-tag-bg-color: #fff0f1;
  --el-tag-border-color: #f5c2c7;
  --el-tag-text-color: #c2414b;
}

.status-badge[data-tone='info'] {
  --el-tag-bg-color: #f3f6fa;
  --el-tag-border-color: #d7e0eb;
  --el-tag-text-color: #64748b;
}

:deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
</style>
