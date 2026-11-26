import { readFileSync, writeFileSync } from 'node:fs'

// Input: JSON produced by Redocly bundle from the backend OpenAPI contract.
const source = process.argv[2]
if (!source) throw new Error('Supply the bundled backend OpenAPI JSON file')
const schemas = JSON.parse(readFileSync(source, 'utf8')).components.schemas
const names = [
  'CapacityLimits',
  'CapacityOverrides',
  'CapacityUsage',
  'CapacityView',
  'CapacityPlatformUpdate',
  'CapacityTenantUpdate',
]
const typeOf = (value) => {
  const type = value.$ref
    ? value.$ref.split('/').at(-1)
    : value.type === 'integer'
      ? 'number'
      : value.type
  if (!type || !['number', 'string', 'boolean', ...names].includes(type))
    throw new Error('Unsupported capacity schema')
  return value.nullable ? `${type} | null` : type
}
const result = names
  .map((name) => {
    const schema = schemas[name]
    if (!schema?.properties) throw new Error(`Missing schema ${name}`)
    return `export interface ${name} {\n${Object.entries(schema.properties)
      .map(
        ([key, value]) => `  ${key}${schema.required.includes(key) ? '' : '?'}: ${typeOf(value)}`,
      )
      .join('\n')}\n}`
  })
  .join('\n\n')
writeFileSync(
  'src/features/tenant/capacity-contract.generated.ts',
  `// Generated from backend OpenAPI. Run scripts/generate-capacity-types.mjs to refresh.\n${result}\n`,
)
