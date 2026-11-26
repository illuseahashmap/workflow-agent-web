// Generated from backend OpenAPI. Run scripts/generate-capacity-types.mjs to refresh.
export interface CapacityLimits {
  outstanding: number
  active: number
  calls: number
}

export interface CapacityOverrides {
  outstanding: number | null
  active: number | null
  calls: number | null
}

export interface CapacityUsage {
  outstanding: number
  active: number
  calls: number
}

export interface CapacityView {
  revision: number
  platform: CapacityLimits
  defaults: CapacityLimits
  overrides: CapacityOverrides
  effective: CapacityLimits
  usage: CapacityUsage
}

export interface CapacityPlatformUpdate {
  revision: number
  platform: CapacityLimits
  defaults: CapacityLimits
}

export interface CapacityTenantUpdate {
  revision: number
  overrides: CapacityOverrides
}
