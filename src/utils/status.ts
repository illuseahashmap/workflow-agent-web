export type StatusTone = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface StatusPresentation {
  label: string
  tone: StatusTone
}

const STATUS_PRESENTATIONS: Record<string, StatusPresentation> = {
  ENABLED: { label: '启用', tone: 'success' },
  DISABLED: { label: '停用', tone: 'info' },
  DRAFT: { label: '草稿', tone: 'warning' },
  PUBLISHED: { label: '已发布', tone: 'success' },
  DEPLOYED: { label: '已部署', tone: 'success' },
  QUEUED: { label: '排队中', tone: 'primary' },
  PENDING: { label: '待执行', tone: 'info' },
  ACTIVE: { label: '待处理', tone: 'primary' },
  RUNNING: { label: '运行中', tone: 'primary' },
  SUCCEEDED: { label: '成功', tone: 'success' },
  SUCCESS: { label: '成功', tone: 'success' },
  COMPLETED: { label: '已完成', tone: 'success' },
  TERMINATED: { label: '已终止', tone: 'info' },
  ASSIGNED: { label: '已分配', tone: 'info' },
  NOT_DISCOVERED: { label: '未发现', tone: 'info' },
  FAILED: { label: '失败', tone: 'danger' },
  TIMED_OUT: { label: '已超时', tone: 'danger' },
  CANCELLED: { label: '已取消', tone: 'info' },
  SKIPPED: { label: '已跳过', tone: 'info' },
  EMPTY: { label: '空结果', tone: 'warning' },
  PARTIAL: { label: '部分完成', tone: 'warning' },
  REJECTED: { label: '已拒绝', tone: 'danger' },
  WAITING_FOR_REVIEW: { label: '等待人工', tone: 'warning' },
  RETRYING: { label: '已安排重试', tone: 'primary' },
  DECIDED: { label: '已决策', tone: 'success' },
  WAIT_FOR_REVIEW: { label: '等待人工', tone: 'warning' },
  RETRY_SCHEDULED: { label: '已安排重试', tone: 'primary' },
  DECISION_RECORDED: { label: '已记录', tone: 'info' },
  UNKNOWN: { label: '未知', tone: 'info' },
}

export function getStatusPresentation(status: string | boolean): StatusPresentation {
  const normalized = typeof status === 'boolean' ? (status ? 'ENABLED' : 'DISABLED') : status
  return STATUS_PRESENTATIONS[normalized] ?? { label: normalized || '未知', tone: 'info' }
}

export function getStatusLabel(status: string | boolean) {
  return getStatusPresentation(status).label
}
