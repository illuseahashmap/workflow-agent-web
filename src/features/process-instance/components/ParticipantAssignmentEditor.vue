<script setup lang="ts">
import { computed, ref } from 'vue'
import { UserRoundSearch } from '@lucide/vue'
import type { ParticipantAssignment, ParticipantRequirement } from '../types'
import UserPickerDialog from './UserPickerDialog.vue'

const props = defineProps<{
  requirements: ParticipantRequirement[]
  modelValue: ParticipantAssignment[]
}>()
const emit = defineEmits<{
  'update:modelValue': [value: ParticipantAssignment[]]
}>()

const pickerVisible = ref(false)
const activeActivityId = ref('')
const activeRequirement = computed(() =>
  props.requirements.find((item) => item.activityId === activeActivityId.value),
)

function assignment(activityId: string) {
  return props.modelValue.find((item) => item.activityId === activityId)
}

function selectedUsers(activityId: string) {
  return assignment(activityId)?.usernames ?? []
}

function openPicker(requirement: ParticipantRequirement) {
  activeActivityId.value = requirement.activityId
  pickerVisible.value = true
}

function saveSelection(usernames: string[]) {
  const next = props.modelValue.filter((item) => item.activityId !== activeActivityId.value)
  if (usernames.length) next.push({ activityId: activeActivityId.value, usernames })
  emit('update:modelValue', next)
}

function removeUser(activityId: string, username: string) {
  saveForActivity(
    activityId,
    selectedUsers(activityId).filter((item) => item !== username),
  )
}

function saveForActivity(activityId: string, usernames: string[]) {
  const next = props.modelValue.filter((item) => item.activityId !== activityId)
  if (usernames.length) next.push({ activityId, usernames })
  emit('update:modelValue', next)
}

function assignmentLabel(requirement: ParticipantRequirement) {
  return {
    ASSIGNEE: '单人处理',
    CANDIDATE_USERS: '候选人',
    CANDIDATE_GROUPS: '候选组',
    COUNTERSIGN_USERS: '会签人员',
    MIXED: '候选人',
  }[requirement.assignmentType]
}
</script>

<template>
  <section v-if="requirements.length" class="participant-section">
    <div class="participant-section__heading">
      <div>
        <h3>参与人设置</h3>
        <p>可按环节指定本次参与人；标记为可选的环节留空时使用派单规则。</p>
      </div>
    </div>
    <article
      v-for="requirement in requirements"
      :key="requirement.activityId"
      class="participant-card"
    >
      <div class="participant-card__title">
        <div>
          <strong>{{ requirement.activityName }}</strong>
          <small>{{ requirement.activityId }}</small>
        </div>
        <div class="participant-card__badges">
          <el-tag size="small" effect="plain">{{ assignmentLabel(requirement) }}</el-tag>
          <el-tag size="small" :type="requirement.required ? 'warning' : 'success'" effect="light">
            {{ requirement.required ? '必须指定' : '可选指定' }}
          </el-tag>
        </div>
      </div>
      <div class="participant-card__selection">
        <div v-if="selectedUsers(requirement.activityId).length" class="participant-tags">
          <el-tag
            v-for="username in selectedUsers(requirement.activityId)"
            :key="username"
            closable
            @close="removeUser(requirement.activityId, username)"
          >
            {{ username }}
          </el-tag>
        </div>
        <span v-else class="participant-placeholder">
          {{ requirement.required ? '尚未选择参与人' : '未指定，将使用派单规则' }}
        </span>
        <el-button type="primary" plain @click="openPicker(requirement)">
          <UserRoundSearch :size="15" />
          {{ selectedUsers(requirement.activityId).length ? '重新选择' : '选择参与人' }}
        </el-button>
      </div>
    </article>
  </section>

  <UserPickerDialog
    v-if="activeRequirement"
    v-model="pickerVisible"
    :title="`为“${activeRequirement.activityName}”选择参与人`"
    :multiple="activeRequirement.multiple"
    :selected="selectedUsers(activeRequirement.activityId)"
    @confirm="saveSelection"
  />
</template>

<style scoped>
.participant-section {
  display: grid;
  gap: 10px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border);
}

.participant-section__heading h3,
.participant-section__heading p {
  margin: 0;
}

.participant-section__heading h3 {
  color: var(--color-text);
  font-size: 14px;
}

.participant-section__heading p {
  margin-top: 4px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.participant-card {
  padding: 12px;
  border: 1px solid var(--color-border-soft);
  border-radius: 12px;
  background: var(--color-primary-soft);
}

.participant-card__title,
.participant-card__selection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.participant-card__title > div:first-child {
  display: grid;
}

.participant-card__badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.participant-card__title small {
  margin-top: 2px;
  color: var(--color-text-muted);
}

.participant-card__selection {
  margin-top: 10px;
}

.participant-tags {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
}

.participant-placeholder {
  color: var(--color-text-subtle);
  font-size: 13px;
}

@media (max-width: 520px) {
  .participant-card__selection {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
