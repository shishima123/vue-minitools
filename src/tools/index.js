import { defineAsyncComponent } from 'vue'

// Đăng ký tool mới ở đây: thêm 1 entry là tool tự xuất hiện trên menu
export const tools = [
  {
    key: 'washing-timer',
    label: 'Hẹn giờ máy giặt',
    icon: '🧺',
    description: 'Tính giờ hẹn cho máy giặt Electrolux để hoàn thành đúng giờ mong muốn',
    component: defineAsyncComponent(() => import('./WashingTimer.vue')),
  },
]

export function getTool(key) {
  return tools.find((t) => t.key === key)
}
