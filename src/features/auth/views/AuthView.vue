<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormItemRule, type FormRules } from 'element-plus'
import { ArrowRight, CheckCircle2, KeyRound, LockKeyhole, UserRound, Workflow } from '@lucide/vue'
import { getErrorMessage } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { resolvePostAuthRedirect } from '../redirect'

type AuthMode = 'login' | 'register'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const mode = ref<AuthMode>('login')
const submitting = ref(false)
const loginFormRef = ref<FormInstance>()
const registerFormRef = ref<FormInstance>()

const loginForm = reactive({ username: '', password: '' })
const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  displayName: '',
})

const validateConfirmPassword: FormItemRule['validator'] = (_rule, value, callback) => {
  if (!value) {
    callback(new Error('请再次输入密码'))
    return
  }
  if (value !== registerForm.password) {
    callback(new Error('两次输入的密码不一致'))
    return
  }
  callback()
}

const loginRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const registerRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 64, message: '用户名需要 3–64 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 128, message: '密码至少 8 个字符', trigger: 'blur' },
  ],
  confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }],
}

async function enterWorkspace() {
  await router.replace(resolvePostAuthRedirect(route.query.redirect))
}

async function submitLogin() {
  if (!loginFormRef.value) return
  try {
    await loginFormRef.value.validate()
    submitting.value = true
    await authStore.login(loginForm)
    ElMessage.success('登录成功')
    await enterWorkspace()
  } catch (error) {
    if (error instanceof Error) ElMessage.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

async function submitRegister() {
  if (!registerFormRef.value) return
  try {
    await registerFormRef.value.validate()
    submitting.value = true
    await authStore.register({
      username: registerForm.username,
      password: registerForm.password,
      displayName: registerForm.displayName || undefined,
    })
    ElMessage.success('注册成功，已自动登录')
    await enterWorkspace()
  } catch (error) {
    if (error instanceof Error) ElMessage.error(getErrorMessage(error))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-intro">
      <div class="auth-brand">
        <span class="auth-brand-mark"><Workflow :size="25" /></span>
        <div>
          <strong>Workflow Agent</strong>
          <span>智能流程编排工作台</span>
        </div>
      </div>

      <div class="auth-intro-copy">
        <span class="auth-eyebrow">WORKFLOW · RULES · AGENTS</span>
        <h1>让业务流程清晰地运转，<br />让智能能力自然地接入。</h1>
        <p>统一管理流程定义、运行实例和派单规则，在一个安静、可靠的工作空间里完成编排。</p>
      </div>

      <div class="auth-benefits">
        <span><CheckCircle2 :size="17" />独立租户上下文</span>
        <span><CheckCircle2 :size="17" />Token 安全鉴权</span>
        <span><CheckCircle2 :size="17" />Flowable 流程引擎</span>
      </div>
    </section>

    <section class="auth-form-side">
      <div class="auth-card">
        <div class="auth-card-icon"><KeyRound :size="22" /></div>
        <header class="auth-card-header">
          <span>{{ mode === 'login' ? '欢迎回来' : '创建工作账号' }}</span>
          <h2>{{ mode === 'login' ? '登录 Workflow Agent' : '注册新账号' }}</h2>
          <p>
            {{
              mode === 'login'
                ? '输入账号信息以继续进入工作台。'
                : '注册完成后将自动登录并进入工作台。'
            }}
          </p>
        </header>

        <div class="auth-switch" role="tablist" aria-label="登录或注册">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'login'"
            :class="{ active: mode === 'login' }"
            @click="mode = 'login'"
          >
            登录
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'register'"
            :class="{ active: mode === 'register' }"
            @click="mode = 'register'"
          >
            注册
          </button>
        </div>

        <el-form
          v-if="mode === 'login'"
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          label-position="top"
          class="auth-form"
          @submit.prevent="submitLogin"
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="loginForm.username"
              size="large"
              autocomplete="username"
              placeholder="请输入用户名"
            >
              <template #prefix><UserRound :size="18" /></template>
            </el-input>
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              size="large"
              autocomplete="current-password"
              show-password
              placeholder="请输入密码"
              @keyup.enter="submitLogin"
            >
              <template #prefix><LockKeyhole :size="18" /></template>
            </el-input>
          </el-form-item>
          <el-button
            type="primary"
            size="large"
            native-type="submit"
            :loading="submitting"
            class="auth-submit"
          >
            登录工作台 <ArrowRight v-if="!submitting" :size="17" />
          </el-button>
        </el-form>

        <el-form
          v-else
          ref="registerFormRef"
          :model="registerForm"
          :rules="registerRules"
          label-position="top"
          class="auth-form"
          @submit.prevent="submitRegister"
        >
          <el-alert
            class="registration-notice"
            type="info"
            :closable="false"
            show-icon
            title="新注册账号固定为普通用户；管理员角色只能由平台管理员分配。"
          />
          <div class="auth-form-grid">
            <el-form-item label="用户名" prop="username">
              <el-input
                v-model="registerForm.username"
                size="large"
                autocomplete="username"
                placeholder="3–64 个字符"
              >
                <template #prefix><UserRound :size="18" /></template>
              </el-input>
            </el-form-item>
            <el-form-item label="显示名称" prop="displayName">
              <el-input v-model="registerForm.displayName" size="large" placeholder="选填" />
            </el-form-item>
          </div>
          <div class="auth-form-grid auth-credential-grid">
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="registerForm.password"
                type="password"
                size="large"
                autocomplete="new-password"
                show-password
                placeholder="至少 8 个字符"
              >
                <template #prefix><LockKeyhole :size="18" /></template>
              </el-input>
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                size="large"
                autocomplete="new-password"
                show-password
                placeholder="再次输入密码"
                @keyup.enter="submitRegister"
              >
                <template #prefix><LockKeyhole :size="18" /></template>
              </el-input>
            </el-form-item>
          </div>
          <el-button
            type="primary"
            size="large"
            native-type="submit"
            :loading="submitting"
            class="auth-submit"
          >
            注册并进入 <ArrowRight v-if="!submitting" :size="17" />
          </el-button>
        </el-form>

        <p class="auth-footnote">登录即表示会话 Token 将保存在当前浏览器中，仅用于访问本服务。</p>
      </div>
    </section>
  </main>
</template>
