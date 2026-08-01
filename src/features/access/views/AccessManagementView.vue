<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { ElMessage } from 'element-plus'
import { Plus, RefreshCw, Search, ShieldCheck, UsersRound } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime, joinValues } from '@/utils/format'
import { accessApi } from '../api'
import type { SaveRoleCommand, TenantMember, TenantRole } from '../types'

const authStore = useAuthStore()
const queryClient = useQueryClient()
const tenantCode = computed(() => authStore.user?.tenantCode || '')
const isAccessAdministrator = computed(
  () => authStore.user?.roles.includes('PLATFORM_ADMIN') ?? false,
)
const canManageMembers = computed(
  () => isAccessAdministrator.value || authStore.user?.permissions.includes('member:manage'),
)
const canManageRoles = computed(
  () => isAccessAdministrator.value || authStore.user?.permissions.includes('role:manage'),
)
const activeTab = ref(canManageMembers.value ? 'members' : 'roles')
const memberKeyword = ref('')
const appliedKeyword = ref('')
const memberDialogVisible = ref(false)
const roleDialogVisible = ref(false)
const editingMember = ref<TenantMember>()
const editingRoleCode = ref<string>()
const memberForm = reactive({ username: '', roleCodes: [] as string[] })
const roleForm = reactive<SaveRoleCommand>({
  roleCode: '',
  roleName: '',
  description: '',
  enabled: true,
  permissions: [],
})

const membersQuery = useQuery({
  queryKey: computed(() => ['tenant-members', tenantCode.value, appliedKeyword.value]),
  queryFn: () => accessApi.members(appliedKeyword.value || undefined),
  enabled: canManageMembers,
})
const rolesQuery = useQuery({
  queryKey: computed(() => ['tenant-roles', tenantCode.value]),
  queryFn: accessApi.roles,
  enabled: computed(() => canManageMembers.value || canManageRoles.value),
})
const permissionsQuery = useQuery({
  queryKey: ['auth-permissions'],
  queryFn: accessApi.permissions,
  enabled: canManageRoles,
})
const members = computed(() => membersQuery.data.value ?? [])
const roles = computed(() => rolesQuery.data.value ?? [])
const memberDialogTitle = computed(() =>
  editingMember.value
    ? `配置成员角色 · ${editingMember.value.displayName}（${editingMember.value.username}）`
    : '添加租户成员',
)

async function refreshAccessData() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['tenant-members'] }),
    queryClient.invalidateQueries({ queryKey: ['tenant-roles'] }),
  ])
}

const saveMemberMutation = useMutation({
  mutationFn: async () => {
    if (editingMember.value) {
      await accessApi.updateMemberRoles(editingMember.value.userId, memberForm.roleCodes)
      return
    }
    if (!memberForm.username.trim()) throw new Error('请输入已注册用户的用户名')
    await accessApi.addMember(memberForm.username.trim(), memberForm.roleCodes)
  },
  onSuccess: async () => {
    memberDialogVisible.value = false
    ElMessage.success(
      editingMember.value
        ? `${editingMember.value.username} 的角色已更新`
        : '成员已加入当前租户',
    )
    await refreshAccessData()
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

const saveRoleMutation = useMutation({
  mutationFn: () => {
    if (!roleForm.roleCode.trim() || !roleForm.roleName.trim()) {
      throw new Error('角色编码和名称不能为空')
    }
    return accessApi.saveRole({
      ...roleForm,
      roleCode: roleForm.roleCode.trim().toUpperCase(),
      roleName: roleForm.roleName.trim(),
      description: roleForm.description?.trim(),
    })
  },
  onSuccess: async () => {
    roleDialogVisible.value = false
    ElMessage.success(editingRoleCode.value ? '角色已更新' : '角色已创建')
    await refreshAccessData()
  },
  onError: (error) => ElMessage.error(getErrorMessage(error)),
})

function searchMembers() {
  appliedKeyword.value = memberKeyword.value.trim()
}

function resetMembers() {
  memberKeyword.value = ''
  appliedKeyword.value = ''
}

function addMember() {
  editingMember.value = undefined
  Object.assign(memberForm, { username: '', roleCodes: ['USER'] })
  memberDialogVisible.value = true
}

function editMember(member: TenantMember) {
  editingMember.value = member
  Object.assign(memberForm, { username: member.username, roleCodes: [...member.roles] })
  memberDialogVisible.value = true
}

async function toggleMember(member: TenantMember) {
  try {
    await accessApi.updateMemberEnabled(member.userId, !member.enabled)
    ElMessage.success(member.enabled ? '成员已停用' : '成员已启用')
    await refreshAccessData()
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  }
}

function addRole() {
  editingRoleCode.value = undefined
  Object.assign(roleForm, {
    roleCode: '',
    roleName: '',
    description: '',
    enabled: true,
    permissions: [],
  })
  roleDialogVisible.value = true
}

function editRole(role: TenantRole) {
  editingRoleCode.value = role.roleCode
  Object.assign(roleForm, {
    roleCode: role.roleCode,
    roleName: role.roleName,
    description: role.description || '',
    enabled: role.enabled,
    permissions: [...role.permissions],
  })
  roleDialogVisible.value = true
}
</script>

<template>
  <div class="definition-page page-stack access-page">
    <section class="page-hero compact-hero">
      <div>
        <span class="eyebrow">Access Control</span>
        <h2>成员与角色</h2>
        <p>管理当前租户的成员关系、业务角色和权限范围。所有修改仅作用于当前租户。</p>
      </div>
      <el-tag type="primary" effect="plain">{{ tenantCode }}</el-tag>
    </section>

    <section class="access-workspace">
      <el-tabs v-model="activeTab">
        <el-tab-pane v-if="canManageMembers" name="members">
          <template #label><span class="tab-label"><UsersRound :size="16" />成员管理</span></template>
          <div class="access-toolbar">
            <el-form inline @submit.prevent="searchMembers">
              <el-form-item label="成员">
                <el-input v-model="memberKeyword" clearable placeholder="用户名或显示名称" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" native-type="submit"><Search :size="16" />查询</el-button>
                <el-button @click="resetMembers"><RefreshCw :size="16" />重置</el-button>
              </el-form-item>
            </el-form>
            <el-button type="primary" @click="addMember"><Plus :size="17" />添加成员</el-button>
          </div>
          <el-table v-loading="membersQuery.isFetching.value" :data="members" height="470">
            <el-table-column prop="displayName" label="成员" min-width="150" />
            <el-table-column prop="username" label="用户名" min-width="150" />
            <el-table-column label="角色" min-width="220">
              <template #default="{ row }">{{ joinValues([...(row.globalRoles || []), ...row.roles]) || '-' }}</template>
            </el-table-column>
            <el-table-column label="加入时间" width="175">
              <template #default="{ row }">{{ formatDateTime(row.joinedAt) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="editMember(row)">配置角色</el-button>
                <el-button link :type="row.enabled ? 'danger' : 'success'" @click="toggleMember(row)">
                  {{ row.enabled ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane v-if="canManageRoles" name="roles">
          <template #label><span class="tab-label"><ShieldCheck :size="16" />角色管理</span></template>
          <div class="access-toolbar align-right">
            <el-button type="primary" @click="addRole"><Plus :size="17" />新增角色</el-button>
          </div>
          <el-table v-loading="rolesQuery.isFetching.value" :data="roles" height="470">
            <el-table-column label="角色名称" min-width="190">
              <template #default="{ row }">
                <span class="role-name-cell">
                  <span>{{ row.roleName }}</span>
                  <el-tag v-if="row.builtIn" type="info" size="small" effect="plain">系统内置</el-tag>
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="roleCode" label="角色编码" min-width="170" />
            <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
            <el-table-column label="权限数" width="100">
              <template #default="{ row }">{{ row.permissions.length }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" effect="plain">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button v-if="!row.builtIn" link type="primary" @click="editRole(row)">编辑</el-button>
                <span v-else class="muted-copy">不可编辑</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="memberDialogVisible" :title="memberDialogTitle" width="520px">
      <el-form class="dialog-form" label-position="top">
        <el-alert
          v-if="editingMember"
          type="info"
          :closable="false"
          show-icon
          :title="`正在配置 ${editingMember.displayName}（${editingMember.username}）`"
        />
        <el-form-item label="用户名" required>
          <el-input v-model="memberForm.username" :disabled="Boolean(editingMember)" placeholder="已注册用户的用户名" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="memberForm.roleCodes" multiple clearable style="width: 100%">
            <el-option v-for="role in roles" :key="role.roleCode" :label="role.roleName" :value="role.roleCode" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="memberDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saveMemberMutation.isPending.value" @click="saveMemberMutation.mutate()">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="roleDialogVisible" :title="editingRoleCode ? '编辑角色' : '新增角色'" width="620px">
      <el-form class="dialog-form" label-position="top">
        <div class="dialog-grid">
          <el-form-item label="角色编码" required>
            <el-input v-model="roleForm.roleCode" :disabled="Boolean(editingRoleCode)" placeholder="例如 APPROVER" />
          </el-form-item>
          <el-form-item label="角色名称" required>
            <el-input v-model="roleForm.roleName" />
          </el-form-item>
        </div>
        <el-form-item label="说明">
          <el-input v-model="roleForm.description" type="textarea" :rows="2" maxlength="512" show-word-limit />
        </el-form-item>
        <el-form-item label="权限范围">
          <el-select v-model="roleForm.permissions" multiple clearable filterable style="width: 100%">
            <el-option
              v-for="permission in permissionsQuery.data.value || []"
              :key="permission.permissionCode"
              :label="permission.permissionName"
              :value="permission.permissionCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="roleForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saveRoleMutation.isPending.value" @click="saveRoleMutation.mutate()">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
