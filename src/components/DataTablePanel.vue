<script setup lang="ts">
import SectionHeader from './SectionHeader.vue'

defineProps<{
  title?: string
  description?: string
  headingLevel?: 'h2' | 'h3'
}>()
</script>

<template>
  <section class="table-panel data-table-panel">
    <SectionHeader
      v-if="title"
      :title="title"
      :description="description"
      :heading-level="headingLevel || 'h3'"
    >
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </SectionHeader>
    <div v-if="$slots.default" class="data-table-panel__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="data-table-panel__footer">
      <slot name="footer" />
    </div>
  </section>
</template>
