<script setup>
import { ref, computed, h, watchEffect } from 'vue'
import { useStorage, useWindowSize } from '@vueuse/core'
import {
  NConfigProvider,
  NGlobalStyle,
  NCard,
  NMenu,
  NSwitch,
  NText,
  NButton,
  NDrawer,
  NDrawerContent,
  darkTheme,
  viVN,
  dateViVN,
} from 'naive-ui'
import { tools, getTool } from './tools'

const isDark = useStorage('minitool:dark', false)
const theme = computed(() => (isDark.value ? darkTheme : null))

// 'only light' chặn Auto Dark Theme của Chrome Android tự ép tối trang
watchEffect(() => {
  document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'only light'
})

const themeOverrides = {
  common: {
    borderRadius: '8px',
  },
  Card: {
    borderRadius: '14px',
  },
}

const { width } = useWindowSize()
const isMobile = computed(() => width.value < 768)

const drawerOpen = ref(false)

const activeKey = useStorage('minitool:active-tool', tools[0].key)
if (!getTool(activeKey.value)) activeKey.value = tools[0].key
const activeTool = computed(() => getTool(activeKey.value))

const menuOptions = tools.map((t) => ({
  key: t.key,
  label: t.label,
  icon: () => h('span', { style: 'font-size:18px' }, t.icon),
}))

function onSelectTool() {
  drawerOpen.value = false
}
</script>

<template>
  <n-config-provider
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="viVN"
    :date-locale="dateViVN"
  >
    <n-global-style />
    <div class="page" :class="isDark ? 'page-dark' : 'page-light'">
      <!-- Card 1: điều hướng (desktop) -->
      <n-card
        v-if="!isMobile"
        class="nav-card"
        :bordered="false"
        content-style="padding: 0; display: flex; flex-direction: column; height: 100%;"
      >
        <div class="brand">
          <span class="brand-icon">🧰</span>
          <span class="brand-name">Mini Tools</span>
        </div>
        <n-menu v-model:value="activeKey" :options="menuOptions" class="nav-menu" />
        <div class="nav-footer">
          <n-text depth="3" style="font-size: 13px">Giao diện</n-text>
          <n-switch v-model:value="isDark" size="medium">
            <template #checked>🌙</template>
            <template #unchecked>☀️</template>
          </n-switch>
        </div>
      </n-card>

      <!-- Thanh trên cùng (mobile) -->
      <div v-if="isMobile" class="mobile-bar">
        <n-button quaternary size="large" class="menu-btn" @click="drawerOpen = true">☰</n-button>
        <span class="brand-name">🧰 Mini Tools</span>
        <n-switch v-model:value="isDark" size="medium">
          <template #checked>🌙</template>
          <template #unchecked>☀️</template>
        </n-switch>
      </div>

      <!-- Card 2: tool đang chọn -->
      <main class="content">
        <n-card v-if="activeTool" class="tool-card" :bordered="false">
          <template #header>
            <div class="tool-header">
              <span class="tool-icon">{{ activeTool.icon }}</span>
              <div class="tool-heading">
                <div class="tool-name">{{ activeTool.label }}</div>
                <n-text depth="3" class="tool-desc">{{ activeTool.description }}</n-text>
              </div>
            </div>
          </template>
          <component :is="activeTool.component" :key="activeTool.key" />
        </n-card>
      </main>
    </div>

    <!-- Menu dạng drawer trên mobile -->
    <n-drawer v-model:show="drawerOpen" placement="left" :width="260">
      <n-drawer-content body-content-style="padding: 0;">
        <template #header>
          <span class="brand-icon">🧰</span>
          <span style="margin-left: 8px; font-weight: 700">Mini Tools</span>
        </template>
        <n-menu v-model:value="activeKey" :options="menuOptions" @update:value="onSelectTool" />
      </n-drawer-content>
    </n-drawer>
  </n-config-provider>
</template>

<style scoped>
.page {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}
.page-light {
  background: #f2f4f7;
}
.page-dark {
  background: #101014;
}

/* Card điều hướng */
.nav-card {
  width: 240px;
  flex-shrink: 0;
  height: 100%;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 6px 20px rgba(0, 0, 0, 0.06);
}
.page-dark .nav-card {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 6px 20px rgba(0, 0, 0, 0.35);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px 10px;
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
}
.brand-icon {
  font-size: 22px;
}
.nav-menu {
  flex: 1;
  overflow-y: auto;
}
.nav-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid rgba(128, 128, 128, 0.15);
}

/* Thanh mobile */
.mobile-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.mobile-bar .brand-name {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
}
.menu-btn {
  font-size: 20px;
  padding: 0 10px;
}

/* Card tool */
.content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
.tool-card {
  max-width: 1100px;
  margin: 0 auto;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 6px 20px rgba(0, 0, 0, 0.06);
}
.page-dark .tool-card {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4),
    0 6px 20px rgba(0, 0, 0, 0.35);
}
.tool-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.tool-icon {
  font-size: 28px;
}
.tool-heading {
  min-width: 0;
}
.tool-name {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
}
.tool-desc {
  font-size: 13px;
  display: block;
}

/* Mobile: xếp dọc */
@media (max-width: 767px) {
  .page {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }
}
</style>
