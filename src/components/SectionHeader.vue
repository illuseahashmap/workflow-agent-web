<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    headingLevel?: 'h2' | 'h3'
  }>(),
  { headingLevel: 'h2' },
)
</script>

<template>
  <header class="section-header">
    <div class="section-header__copy">
      <component :is="headingLevel" class="section-header__title">{{ title }}</component>
      <p v-if="description" class="section-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="section-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--section-header-padding-block) var(--section-header-padding-inline);
  border-bottom: 1px solid var(--color-border-soft);
}
.section-header__copy {
  min-width: 0;
}
.section-header__title {
  margin: 0;
  color: var(--color-text-strong);
  font-size: var(--font-size-section-title);
  font-weight: 750;
  line-height: var(--line-height-tight);
}
.section-header__description {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-normal);
}
.section-header__actions {
  flex: 0 0 auto;
}
@media (max-width: 640px) {
  .section-header {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-3);
  }
}
</style>
