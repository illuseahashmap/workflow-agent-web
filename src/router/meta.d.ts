import 'vue-router'
import type { AppPermission, AppRole } from '@/features/auth/authorization'

export type NavigationIcon = 'definitions' | 'instances' | 'assignments' | 'access' | 'tenants'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    immersive?: boolean
    requiredAnyRoles?: readonly AppRole[]
    requiredAnyPermissions?: readonly AppPermission[]
    navigation?: {
      label: string
      icon: NavigationIcon
      order: number
    }
  }
}
