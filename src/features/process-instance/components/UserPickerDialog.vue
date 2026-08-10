<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { Check, Search } from '@lucide/vue'
import { accessApi, type DirectoryUser } from '@/features/access'
import { queryKeys } from '@/api/queryKeys'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  modelValue: boolean
  title: string
  multiple: boolean
  selected: string[]
}>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [usernames: string[]]
}>()

const authStore = useAuthStore()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const keyword = ref('')
const appliedKeyword = ref('')
const pageNum = ref(1)
const pageSize = 10
const selectedUsernames = ref(new Set<string>())

const usersQuery = useQuery({
  queryKey: computed(() =>
    queryKeys.directoryUsers(tenantCode.value, {
      keyword: appliedKeyword.value,
      pageNum: pageNum.value,
      pageSize,
    }),
  ),
  queryFn: () =>
    accessApi.directoryUsers({
      keyword: appliedKeyword.value || undefined,
      pageNum: pageNum.value,
      pageSize,
    }),
  enabled: computed(() => props.modelValue),
})

const users = computed(() => usersQuery.data.value?.records ?? [])

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    selectedUsernames.value = new Set(props.selected)
    keyword.value = ''
    appliedKeyword.value = ''
    pageNum.value = 1
  },
)

function search() {
  appliedKeyword.value = keyword.value.trim()
  pageNum.value = 1
}

function toggle(user: DirectoryUser) {
  const next = new Set(props.multiple ? selectedUsernames.value : [])
  if (next.has(user.username)) next.delete(user.username)
  else next.add(user.username)
  selectedUsernames.value = next
}

function confirm() {
  emit('confirm', [...selectedUsernames.value])
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="min(680px, calc(100vw - 32px))"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="user-picker-search">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索用户名或显示名称"
        @keyup.enter="search"
      />
      <el-button type="primary" @click="search"><Search :size="15" />搜索</el-button>
    </div>
    <p class="user-picker-hint">
      服务端分页查询，每页仅加载 {{ pageSize }} 人。已选择 {{ selectedUsernames.size }} 人。
    </p>
    <div v-loading="usersQuery.isFetching.value" class="user-picker-list">
      <button
        v-for="user in users"
        :key="user.userId"
        type="button"
        class="user-picker-option"
        :class="{ 'is-selected': selectedUsernames.has(user.username) }"
        :aria-pressed="selectedUsernames.has(user.username)"
        @click="toggle(user)"
      >
        <span class="user-picker-avatar">{{
          (user.displayName || user.username).slice(0, 1)
        }}</span>
        <span class="user-picker-identity">
          <strong>{{ user.displayName || user.username }}</strong>
          <small>{{ user.username }}</small>
        </span>
        <span class="user-picker-check"><Check :size="16" /></span>
      </button>
      <div v-if="!usersQuery.isFetching.value && !users.length" class="user-picker-empty">
        没有找到可用成员
      </div>
    </div>
    <el-pagination
      v-accessible-label="'每页条数'"
      aria-label="成员选择分页"
      v-model:current-page="pageNum"
      class="user-picker-pagination"
      :page-size="pageSize"
      :total="usersQuery.data.value?.total ?? 0"
      layout="total, prev, pager, next"
    />
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="selectedUsernames.size === 0" @click="confirm">
        确认选择
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.user-picker-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.user-picker-hint {
  margin: 10px 0;
  color: #64748b;
  font-size: 12px;
}

.user-picker-list {
  min-height: 290px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.user-picker-option {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 28px;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 8px 14px;
  border: 0;
  border-bottom: 1px solid #edf2f7;
  background: #fff;
  color: #1e293b;
  cursor: pointer;
  text-align: left;
}

.user-picker-option:last-child {
  border-bottom: 0;
}

.user-picker-option:hover,
.user-picker-option.is-selected {
  background: #f4f8ff;
}

.user-picker-avatar {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  background: #eaf2ff;
  color: #2563eb;
  font-weight: 700;
}

.user-picker-identity {
  display: grid;
  min-width: 0;
}

.user-picker-identity strong,
.user-picker-identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-picker-identity small {
  margin-top: 2px;
  color: #64748b;
}

.user-picker-check {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 50%;
  color: transparent;
}

.user-picker-option.is-selected .user-picker-check {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.user-picker-empty {
  display: grid;
  min-height: 290px;
  place-items: center;
  color: #94a3b8;
}

.user-picker-pagination {
  justify-content: flex-end;
  margin-top: 14px;
}

@media (max-width: 520px) {
  .user-picker-search {
    grid-template-columns: 1fr;
  }
}
</style>
