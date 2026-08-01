import { fileURLToPath, URL } from 'node:url'
import { randomUUID, createCipheriv, createHash, randomBytes } from 'node:crypto'

import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

type RequestWithRawBody = IncomingMessage & { rawBody?: Buffer }

const API_PREFIX = '/api'
const LOCAL_CLIENT_CODE = process.env.WORKFLOW_CLIENT_CODE || 'local-dev'
const LOCAL_TENANT_CODE = process.env.WORKFLOW_TENANT_CODE || 'default'
const LOCAL_TOKEN_VERSION = Number(process.env.WORKFLOW_TOKEN_VERSION || 1)
const LOCAL_DEV_SECRET =
  process.env.WORKFLOW_LOCAL_DEV_SECRET ||
  process.env.VITE_WORKFLOW_LOCAL_DEV_SECRET ||
  process.env.USERNAME ||
  'change-me-local-dev-secret'

function sha256Hex(body: Buffer | string) {
  return createHash('sha256').update(body).digest('hex')
}

function backendPathFromProxyUrl(url = '/') {
  const stripped = url.startsWith(API_PREFIX) ? url.slice(API_PREFIX.length) || '/' : url
  return stripped.split('?')[0] || '/'
}

function createWorkflowToken(method: string, path: string, body: Buffer) {
  const payload = {
    clientCode: LOCAL_CLIENT_CODE,
    tenantCode: LOCAL_TENANT_CODE,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: randomUUID(),
    method,
    path,
    bodySha256: sha256Hex(body),
    tokenVersion: LOCAL_TOKEN_VERSION,
  }
  const iv = randomBytes(12)
  const key = createHash('sha256').update(LOCAL_DEV_SECRET, 'utf8').digest()
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ])
  return `${LOCAL_CLIENT_CODE}.${Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString(
    'base64url',
  )}`
}

function workflowTokenProxyPlugin(): Plugin {
  return {
    name: 'workflow-token-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(API_PREFIX, (req: RequestWithRawBody, _res, next) => {
        if (!req.method || ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
          req.rawBody = Buffer.alloc(0)
          next()
          return
        }

        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
        req.on('end', () => {
          req.rawBody = Buffer.concat(chunks)
          next()
        })
        req.on('error', next)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [workflowTokenProxyPlugin(), vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req: RequestWithRawBody) => {
            const body = req.rawBody ?? Buffer.alloc(0)
            proxyReq.setHeader(
              'X-Workflow-Token',
              createWorkflowToken(req.method || 'GET', backendPathFromProxyUrl(req.url), body),
            )
            if (body.length > 0) {
              proxyReq.setHeader('Content-Length', String(body.length))
              proxyReq.write(body)
            }
          })
        },
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
