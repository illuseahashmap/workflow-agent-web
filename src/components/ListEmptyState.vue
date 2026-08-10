<script setup lang="ts">
import type { Component } from 'vue'
import { Inbox } from '@lucide/vue'

defineProps<{
  title: string
  description?: string
  icon?: Component
  compact?: boolean
}>()
</script>

<template>
  <div class="list-empty-state" :class="{ 'is-compact': compact }">
    <span class="list-empty-state__icon" aria-hidden="true">
      <component :is="icon || Inbox" :size="28" :stroke-width="1.8" />
    </span>
    <strong>{{ title }}</strong>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.default" class="list-empty-state__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.list-empty-state {
  width: 100%;
  min-height: clamp(230px, 28vh, 310px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 32px 24px;
  color: #8492a6;
  text-align: center;
}

.list-empty-state.is-compact {
  min-height: 168px;
  padding-block: 24px;
}

.list-empty-state__icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  margin-bottom: 2px;
  border: 1px solid #dce7f7;
  border-radius: 18px;
  color: #3b82f6;
  background: linear-gradient(145deg, #f4f8ff, #e8f1ff);
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.09);
}

.list-empty-state strong {
  color: #334155;
  font-size: 15px;
  font-weight: 700;
}

.list-empty-state p {
  max-width: 460px;
  margin: 0;
  color: #8492a6;
  font-size: 12px;
  line-height: 1.65;
}

.list-empty-state__actions {
  margin-top: 5px;
}
</style>
