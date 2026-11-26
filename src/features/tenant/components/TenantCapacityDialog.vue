<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ElDescriptions, ElDescriptionsItem, ElMessage, ElResult } from 'element-plus'
import { getErrorMessage } from '@/api/http'
import { queryKeys } from '@/api/queryKeys'
import { useAuthStore } from '@/stores/auth'
import {
  capacityApi,
  capacityError,
  capacityFields,
  type CapacityLimits,
  type CapacityOverrides,
} from '../capacity'

const props = defineProps<{ tenantCode?: string; tenantName?: string }>()
const visible = defineModel<boolean>({ required: true })
const auth = useAuthStore()
const allowed = computed(() => auth.user?.roles.includes('PLATFORM_ADMIN') ?? false)
const client = useQueryClient()
const revision = ref<number>()
const ceiling = { outstanding: 1000000, active: 1000000, calls: 1000000 }
const platform = reactive<CapacityLimits>({ outstanding: 1, active: 1, calls: 1 })
const defaults = reactive<CapacityLimits>({ outstanding: 1, active: 1, calls: 1 })
const overrides = reactive<CapacityOverrides>({ outstanding: null, active: null, calls: null })
const inheritance = reactive({ outstanding: true, active: true, calls: true })
const dirty = ref(false)
const query = useQuery({
  queryKey: computed(() => queryKeys.capacity(props.tenantCode)),
  queryFn: () => capacityApi.read(props.tenantCode),
  enabled: computed(() => visible.value && allowed.value),
  refetchOnWindowFocus: false,
  staleTime: 0,
})
watch([visible, () => props.tenantCode], () => {
  revision.value = undefined
  dirty.value = false
})
watch(
  () => query.data.value,
  (data) => {
    if (!data || dirty.value || !visible.value) return
    revision.value = data.revision
    Object.assign(platform, data.platform)
    Object.assign(defaults, data.defaults)
    Object.assign(overrides, data.overrides)
    for (const field of capacityFields) inheritance[field.key] = data.overrides[field.key] === null
  },
  { immediate: true },
)
watch(allowed, (value) => {
  if (!value) visible.value = false
})
const error = computed(() =>
  props.tenantCode
    ? capacityError(overrides, platform, true)
    : capacityError(platform, ceiling, false) || capacityError(defaults, platform, false),
)
const mutation = useMutation({
  mutationFn: async () => {
    if (!allowed.value || revision.value === undefined || error.value)
      throw new Error(error.value || '请重新加载配额')
    const requestTenant = props.tenantCode
    const result = requestTenant
      ? await capacityApi.updateTenant(requestTenant, revision.value, { ...overrides })
      : await capacityApi.updatePlatform(revision.value, { ...platform }, { ...defaults })
    return { requestTenant, result }
  },
  onSuccess: async ({ requestTenant, result }) => {
    client.setQueryData(queryKeys.capacity(requestTenant), result)
    await client.invalidateQueries({ queryKey: queryKeys.capacities() })
    ElMessage.success('资源配额已保存')
    visible.value = false
  },
  onError: (failure) => ElMessage.error(getErrorMessage(failure)),
})
function inherit(key: keyof CapacityLimits, value: boolean) {
  overrides[key] = value ? null : (query.data.value?.effective[key] ?? defaults[key])
  dirty.value = true
}
function setOverride(key: keyof CapacityLimits, value: number | undefined) {
  overrides[key] = value ?? null
  dirty.value = true
}
async function reload() {
  dirty.value = false
  revision.value = undefined
  const result = await query.refetch()
  if (result.data && !result.error) {
    revision.value = result.data.revision
    Object.assign(platform, result.data.platform)
    Object.assign(defaults, result.data.defaults)
    Object.assign(overrides, result.data.overrides)
    for (const field of capacityFields)
      inheritance[field.key] = result.data.overrides[field.key] === null
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="tenantCode ? `${tenantName || tenantCode} · 资源配额` : '平台资源配额'"
    width="760px"
    :close-on-click-modal="!mutation.isPending.value"
    :close-on-press-escape="!mutation.isPending.value"
    :show-close="!mutation.isPending.value"
  >
    <el-alert
      title="降低配额不会中断已有任务；额度不足时拒绝新任务准入，图执行与调用等待可用容量。"
      type="info"
      :closable="false"
    />
    <div
      v-if="query.isPending.value || (query.isFetching.value && revision === undefined)"
      role="status"
    >
      正在加载配额…
    </div>
    <el-result
      v-else-if="query.isError.value"
      icon="error"
      title="配额加载失败"
      :sub-title="getErrorMessage(query.error.value)"
    >
      <template #extra><el-button @click="reload">重试</el-button></template>
    </el-result>
    <el-form
      v-else-if="query.data.value"
      class="dialog-form"
      label-position="top"
      :disabled="mutation.isPending.value"
      @submit.prevent="mutation.mutate()"
    >
      <el-descriptions title="当前用量 / 已生效上限" :column="1" border>
        <el-descriptions-item v-for="field in capacityFields" :key="field.key" :label="field.label">
          {{ query.data.value.usage[field.key] }} / {{ query.data.value.effective[field.key] }}
        </el-descriptions-item>
      </el-descriptions>
      <template v-for="field in capacityFields" :key="field.key">
        <el-form-item :label="field.label">
          <template v-if="tenantCode">
            <el-checkbox
              v-model="inheritance[field.key]"
              :aria-label="`${field.label}继承平台默认`"
              @change="inherit(field.key, Boolean($event))"
              >继承平台默认（{{ defaults[field.key] }}）</el-checkbox
            >
            <el-input-number
              v-if="!inheritance[field.key]"
              :model-value="overrides[field.key] ?? undefined"
              :min="1"
              :max="platform[field.key]"
              :precision="0"
              :aria-label="`${field.label}租户上限`"
              @update:model-value="setOverride(field.key, $event)"
            />
            <p class="capacity-help">
              平台总上限 {{ platform[field.key] }}。{{ field.description }}
            </p>
          </template>
          <template v-else>
            <div class="capacity-inputs">
              <label
                >平台总上限<el-input-number
                  v-model="platform[field.key]"
                  :min="1"
                  :max="1000000"
                  :precision="0"
                  :aria-label="`${field.label}平台总上限`"
                  @change="dirty = true"
              /></label>
              <label
                >默认租户上限<el-input-number
                  v-model="defaults[field.key]"
                  :min="1"
                  :max="platform[field.key]"
                  :precision="0"
                  :aria-label="`${field.label}默认租户上限`"
                  @change="dirty = true"
              /></label>
            </div>
            <p class="capacity-help">{{ field.description }}</p>
          </template>
        </el-form-item>
      </template>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <p class="capacity-help">
        并发与外部调用配额适用于图执行；共享模型账户或连接器的容量限制仍然生效。用量为查询时的快照。
      </p>
    </el-form>
    <template #footer>
      <el-button :disabled="mutation.isPending.value" @click="visible = false">取消</el-button>
      <el-button :disabled="mutation.isPending.value" @click="reload">刷新</el-button>
      <el-button
        type="primary"
        :loading="mutation.isPending.value"
        :disabled="
          !allowed ||
          query.isFetching.value ||
          query.isError.value ||
          revision === undefined ||
          Boolean(error)
        "
        @click="mutation.mutate()"
        >保存配额</el-button
      >
    </template>
  </el-dialog>
</template>

<style scoped>
.capacity-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}
.capacity-inputs label {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.capacity-help {
  width: 100%;
  color: var(--color-text-secondary);
}
</style>
