<script setup lang="ts">
withDefaults(
  defineProps<{
    total: number
    currentPage: number
    pageSize: number
    pageSizes?: number[]
    ariaLabel?: string
  }>(),
  {
    pageSizes: () => [10, 20, 50, 100],
    ariaLabel: '分页',
  },
)

const emit = defineEmits<{
  'update:currentPage': [value: number]
  'update:pageSize': [value: number]
  change: [page: number, pageSize: number]
}>()

function handleChange(page: number, pageSize: number) {
  emit('update:currentPage', page)
  emit('update:pageSize', pageSize)
  emit('change', page, pageSize)
}
</script>

<template>
  <el-pagination
    v-accessible-label="'每页条数'"
    class="table-pagination"
    :aria-label="ariaLabel"
    :current-page="currentPage"
    :page-size="pageSize"
    :total="total"
    :page-sizes="pageSizes"
    layout="total, sizes, prev, pager, next"
    @update:current-page="emit('update:currentPage', $event)"
    @update:page-size="emit('update:pageSize', $event)"
    @change="handleChange"
  />
</template>
