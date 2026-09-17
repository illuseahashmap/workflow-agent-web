<script setup lang="ts">
import { computed } from 'vue'
import { getStatusPresentation, type StatusTone } from '@/utils/status'

const props = defineProps<{
  status: string | boolean
  label?: string
  tone?: StatusTone
  variant?: 'status' | 'version' | 'category' | 'filter'
}>()

const presentation = computed(() => getStatusPresentation(props.status))
const variantClass = computed(() => `status-badge--${props.variant || 'status'}`)
const accessibleLabel = computed(() => props.label || presentation.value.label)
</script>

<template>
  <el-tag
    class="status-badge"
    :class="variantClass"
    :type="tone || presentation.tone"
    :data-tone="tone || presentation.tone"
    effect="light"
    size="small"
    :round="variant === 'filter'"
    :aria-label="accessibleLabel"
    :title="String(status)"
  >
    {{ accessibleLabel }}
  </el-tag>
</template>

<style scoped>
.status-badge {
  width: auto;
  min-width: 76px;
  max-width: none;
  box-sizing: border-box;
  height: 24px;
  flex: 0 0 auto;
  justify-content: center;
  padding-inline: 9px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
}

.status-badge--version {
  min-width: 60px;
  border-radius: 5px;
  font-family: var(--font-mono);
  font-weight: 600;
}

.status-badge--category {
  min-width: 0;
  border-radius: 5px;
  font-weight: 600;
}

.status-badge--filter {
  min-width: 0;
  border-radius: 999px;
}

.status-badge[data-tone='primary'] {
  --el-tag-bg-color: var(--color-primary-soft);
  --el-tag-border-color: #bfd5ff;
  --el-tag-text-color: var(--color-primary-strong);
}

.status-badge[data-tone='success'] {
  --el-tag-bg-color: var(--color-success-soft);
  --el-tag-border-color: var(--color-success-border);
  --el-tag-text-color: var(--color-success);
}

.status-badge[data-tone='warning'] {
  --el-tag-bg-color: var(--color-warning-soft);
  --el-tag-border-color: var(--color-warning-border);
  --el-tag-text-color: var(--color-warning);
}

.status-badge[data-tone='danger'] {
  --el-tag-bg-color: var(--color-danger-soft);
  --el-tag-border-color: var(--color-danger-border);
  --el-tag-text-color: var(--color-danger);
}

.status-badge[data-tone='info'] {
  --el-tag-bg-color: var(--color-surface-muted);
  --el-tag-border-color: var(--color-border);
  --el-tag-text-color: var(--color-text-muted);
}

:deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}
</style>
