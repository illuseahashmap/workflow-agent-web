<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer'
import type { BpmnModelerInstance, Canvas } from '@/bpmn/modeler-types'
import { formatDateTime, formatDuration } from '@/utils/format'
import type { ActivityDetail, ProcessDiagramData } from '../types'

const props = defineProps<{ data?: ProcessDiagramData }>()
const host = ref<HTMLDivElement>()
const viewer = ref<BpmnModelerInstance>()
const hover = ref<{ detail: ActivityDetail; x: number; y: number }>()

async function render() {
  if (!host.value || !props.data?.bpmnXml) return
  viewer.value?.destroy()
  viewer.value = new BpmnViewer({ container: host.value })
  await viewer.value.importXML(props.data.bpmnXml)
  await nextTick()
  const canvas = viewer.value.get('canvas') as Canvas
  props.data.completedActivityIds.forEach((id) => canvas.addMarker(id, 'activity-completed'))
  props.data.activeActivityIds.forEach((id) => canvas.addMarker(id, 'activity-active'))
  props.data.highlightedFlows.forEach((id) => canvas.addMarker(id, 'flow-completed'))
  canvas.zoom('fit-viewport', 'auto')
  viewer.value.on('element.hover', (event) => {
    const elementId = event.element?.id
    if (!elementId) return
    const detail = props.data?.activityDetails[elementId]
    if (!detail) return
    const rect = host.value?.getBoundingClientRect()
    hover.value = {
      detail,
      x: Math.min(
        (event.originalEvent?.clientX || 0) - (rect?.left || 0) + 12,
        (rect?.width || 400) - 290,
      ),
      y: Math.max((event.originalEvent?.clientY || 0) - (rect?.top || 0) + 12, 8),
    }
  })
  viewer.value.on('element.out', () => (hover.value = undefined))
}

watch(() => props.data, render, { immediate: true })
onBeforeUnmount(() => viewer.value?.destroy())
</script>

<template>
  <div class="tracking-canvas-wrap">
    <div ref="host" class="tracking-canvas" />
    <div
      v-if="hover"
      class="activity-popover"
      :style="{ left: `${hover.x}px`, top: `${hover.y}px` }"
    >
      <strong>{{ hover.detail.activityName || hover.detail.activityId }}</strong>
      <dl>
        <dt>类型</dt>
        <dd>{{ hover.detail.activityType }}</dd>
        <dt>处理人</dt>
        <dd>{{ hover.detail.assignee || '-' }}</dd>
        <dt>候选人</dt>
        <dd>{{ hover.detail.candidateUsers?.join('、') || '-' }}</dd>
        <dt>开始</dt>
        <dd>{{ formatDateTime(hover.detail.startTime) }}</dd>
        <dt>结束</dt>
        <dd>{{ formatDateTime(hover.detail.endTime) }}</dd>
        <dt>耗时</dt>
        <dd>{{ formatDuration(hover.detail.durationInMillis) }}</dd>
      </dl>
      <p v-if="hover.detail.comment">{{ hover.detail.comment }}</p>
    </div>
    <div class="diagram-legend">
      <span class="done-dot" />已完成<span class="active-dot" />当前节点<span
        class="pending-dot"
      />未到达
    </div>
  </div>
</template>
