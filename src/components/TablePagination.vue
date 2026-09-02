<script setup lang="ts">
const props = withDefaults(
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

function handlePageChange(page: number) {
  emit('update:currentPage', page)
  emit('change', page, props.pageSize)
}

function handlePageSizeChange(pageSize: number) {
  emit('update:currentPage', 1)
  emit('update:pageSize', pageSize)
  emit('change', 1, pageSize)
}
</script>

<template>
  <div class="table-pagination" :aria-label="props.ariaLabel">
    <span class="table-pagination__total">共 {{ props.total }} 条</span>
    <el-pagination
      v-accessible-label="'每页条数'"
      :current-page="props.currentPage"
      :page-size="props.pageSize"
      :total="props.total"
      :page-sizes="props.pageSizes"
      layout="sizes, prev, pager, next"
      @current-change="handlePageChange"
      @size-change="handlePageSizeChange"
    />
  </div>
</template>
