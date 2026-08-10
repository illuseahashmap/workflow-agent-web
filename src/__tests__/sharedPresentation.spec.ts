import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ListEmptyState from '@/components/ListEmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { getStatusPresentation } from '@/utils/status'

describe('shared data presentation', () => {
  it('maps technical lifecycle states to consistent Chinese presentations', () => {
    expect(getStatusPresentation('RUNNING')).toEqual({ label: '运行中', tone: 'primary' })
    expect(getStatusPresentation('FAILED')).toEqual({ label: '失败', tone: 'danger' })
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
})
