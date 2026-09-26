<script setup lang="ts">
withDefaults(
  defineProps<{
    ariaLabel?: string
  }>(),
  { ariaLabel: '查询条件' },
)
</script>

<template>
  <section class="query-panel" :aria-label="ariaLabel">
    <slot />
    <div v-if="$slots.actions" class="query-panel__actions">
      <slot name="actions" />
    </div>
  </section>
</template>
