<script setup lang="ts">
withDefaults(
  defineProps<{
    workspace?: boolean
  }>(),
  { workspace: false },
)
</script>

<template>
  <div
    class="management-page page-stack directory-page"
    :class="{ 'directory-page--workspace': workspace }"
  >
    <slot />
  </div>
</template>
