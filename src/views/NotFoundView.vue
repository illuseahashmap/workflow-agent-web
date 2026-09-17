<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
</script>

<template>
  <main class="standalone-state">
    <strong>404</strong>
    <h1>页面不存在</h1>
    <RouterLink to="/process-definitions"><ArrowLeft :size="16" />返回流程定义</RouterLink>
  </main>
</template>
