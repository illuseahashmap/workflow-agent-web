# workflow-agent-web

Workflow management frontend for `workflow-agent-service`.

## Features

- Process definition list, BPMN designer, plain XML import/export, deployment and version publishing
- Process instance list, tracking diagram, task/variable details, termination and task transfer
- Assignment rule CRUD with BPMN task-mode validation and version inheritance
- Tenant CRUD, enable/disable operations and enabled-tenant refresh
- Responsive workspace, typed API client, unit tests and Playwright workflow tests

## Stack

- Vue 3 and TypeScript
- Vite and pnpm
- Vue Router, Pinia, and TanStack Vue Query
- Element Plus and Lucide
- bpmn-js
- Vitest and Playwright

## Requirements

- Node.js 24 LTS
- pnpm 11

## Development

```bash
corepack pnpm install
corepack pnpm dev
```

The development server proxies `/api` to `http://localhost:8080`. Override it through a local environment file based on `.env.example`.

## Verification

```bash
corepack pnpm lint
corepack pnpm test:unit --run
corepack pnpm build
corepack pnpm test:e2e --project=chromium
```

## Security boundary

The browser application must not store a workflow service-client secret or generate `X-Workflow-Token`. Browser authentication will be added after the backend exposes a user-authentication contract or a dedicated BFF is introduced.
