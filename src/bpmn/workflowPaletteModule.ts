interface PaletteEntry {
  group: string
  className: string
  title: string
  action: {
    dragstart: (event: Event) => void
    click: (event: Event) => void
  }
}

interface Palette {
  registerProvider(priority: number, provider: WorkflowPaletteProvider): void
}

interface CreateService {
  start(event: Event, shape: unknown): void
}

interface ElementFactory {
  createShape(properties: { type: string }): unknown
}

class WorkflowPaletteProvider {
  static $inject = ['palette', 'create', 'elementFactory']

  constructor(
    palette: Palette,
    private readonly create: CreateService,
    private readonly elementFactory: ElementFactory,
  ) {
    palette.registerProvider(500, this)
  }

  getPaletteEntries() {
    return (entries: Record<string, PaletteEntry>) => {
      const createUserTask = (event: Event) => {
        const shape = this.elementFactory.createShape({ type: 'bpmn:UserTask' })
        this.create.start(event, shape)
      }

      entries['create.task'] = {
        group: 'activity',
        className: 'bpmn-icon-user-task',
        title: '创建用户任务',
        action: {
          dragstart: createUserTask,
          click: createUserTask,
        },
      }
      const createAgentTask = (event: Event) => {
        const shape = this.elementFactory.createShape({ type: 'bpmn:ServiceTask' })
        this.create.start(event, shape)
      }
      entries['create.agent-task'] = {
        group: 'activity',
        className: 'bpmn-icon-service-task',
        title: '创建 Agent 任务',
        action: { dragstart: createAgentTask, click: createAgentTask },
      }
      return entries
    }
  }
}

export default {
  __init__: ['workflowPaletteProvider'],
  workflowPaletteProvider: ['type', WorkflowPaletteProvider],
}
