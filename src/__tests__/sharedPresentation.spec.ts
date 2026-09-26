import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ListEmptyState from '@/components/ListEmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import DirectoryPageShell from '@/components/DirectoryPageShell.vue'
import QueryPanel from '@/components/QueryPanel.vue'
import DataTablePanel from '@/components/DataTablePanel.vue'
import { getStatusPresentation } from '@/utils/status'

describe('shared data presentation', () => {
  it('maps technical lifecycle states to consistent Chinese presentations', () => {
    expect(getStatusPresentation('RUNNING')).toEqual({ label: '运行中', tone: 'primary' })
    expect(getStatusPresentation('FAILED')).toEqual({ label: '失败', tone: 'danger' })
    expect(getStatusPresentation('TERMINATED')).toEqual({ label: '已终止', tone: 'info' })
    expect(getStatusPresentation('ASSIGNED')).toEqual({ label: '已分配', tone: 'info' })
    expect(getStatusPresentation('NOT_DISCOVERED')).toEqual({ label: '未发现', tone: 'info' })
    expect(getStatusPresentation(true)).toEqual({ label: '启用', tone: 'success' })
  })

  it('renders a readable status badge while retaining the raw status as its title', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: 'SUCCEEDED' },
      global: { stubs: { 'el-tag': { template: '<span><slot /></span>' } } },
    })

    expect(wrapper.text()).toContain('成功')
    expect(wrapper.find('[title="SUCCEEDED"]').exists()).toBe(true)
    expect(wrapper.find('.status-badge__dot').exists()).toBe(false)
  })

  it('renders a shared list empty state with guidance', () => {
    const wrapper = mount(ListEmptyState, {
      props: { title: '暂无运行记录', description: '提交运行后会显示在这里。' },
    })

    expect(wrapper.text()).toContain('暂无运行记录')
    expect(wrapper.text()).toContain('提交运行后会显示在这里。')
  })

  it('provides one semantic shell for directory pages and query actions', () => {
    const shell = mount(DirectoryPageShell, { slots: { default: '<div>目录内容</div>' } })
    const query = mount(QueryPanel, {
      props: { ariaLabel: '流程查询' },
      slots: { default: '<span>查询字段</span>', actions: '<button>新建</button>' },
    })

    expect(shell.element.tagName).toBe('DIV')
    expect(shell.classes()).toContain('directory-page')
    expect(query.attributes('aria-label')).toBe('流程查询')
    expect(query.find('.query-panel__actions').text()).toContain('新建')
  })

  it('keeps table content and pagination in stable data panel regions', () => {
    const wrapper = mount(DataTablePanel, {
      props: { title: '运行记录', description: '按时间倒序显示。' },
      slots: { default: '<div>表格内容</div>', footer: '<div>分页</div>' },
    })

    expect(wrapper.find('.section-header__title').text()).toBe('运行记录')
    expect(wrapper.find('.data-table-panel__body').text()).toContain('表格内容')
    expect(wrapper.find('.data-table-panel__footer').text()).toContain('分页')
  })
})
