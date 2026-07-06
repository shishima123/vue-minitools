<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useStorage } from '@vueuse/core'
import {
  NFormItem,
  NTimePicker,
  NInputNumber,
  NRadioGroup,
  NRadioButton,
  NButton,
  NSpace,
  NAlert,
  NTable,
  NTag,
  NText,
  NGrid,
  NGi,
  NStatistic,
  NTabs,
  NTabPane,
} from 'naive-ui'

// Đồng hồ "bây giờ", tự cập nhật để kết quả luôn đúng
const now = ref(new Date())
let tick
onMounted(() => {
  tick = setInterval(() => (now.value = new Date()), 15000)
})
onBeforeUnmount(() => clearInterval(tick))

// Config được lưu vào localStorage — lần sau mở lại vẫn giữ nguyên
// Giờ muốn hoàn thành (mặc định 07:00 sáng)
const finishAt = useStorage(
  'washing-timer:finish-at',
  (() => {
    const d = new Date()
    d.setHours(7, 0, 0, 0)
    return d.getTime()
  })(),
)

// Thời lượng chu trình giặt
const cycleHours = useStorage('washing-timer:cycle-hours', 1)
const cycleMinutes = useStorage('washing-timer:cycle-minutes', 30)
const cycleMin = computed(() => (cycleHours.value || 0) * 60 + (cycleMinutes.value || 0))

const presets = [
  { label: '15 phút', h: 0, m: 15 },
  { label: '30 phút', h: 0, m: 30 },
  { label: '45 phút', h: 0, m: 45 },
  { label: '1 giờ', h: 1, m: 0 },
  { label: '1g 30p', h: 1, m: 30 },
  { label: '2 giờ', h: 2, m: 0 },
  { label: '3 giờ', h: 3, m: 0 },
]
function applyPreset(p) {
  cycleHours.value = p.h
  cycleMinutes.value = p.m
}
const isPresetActive = (p) => cycleHours.value === p.h && cycleMinutes.value === p.m

// Kiểu hẹn giờ của máy
// 'end'  : máy hiện tổng thời gian đến khi HOÀN THÀNH (Delay End — phổ biến trên Electrolux UltimateCare)
// 'start': máy hẹn thời gian chờ trước khi BẮT ĐẦU (Delay Start)
const mode = useStorage('washing-timer:mode', 'end')

// Bước chỉnh của máy (30 phút hoặc 1 giờ)
const step = useStorage('washing-timer:step', 30)

// Chiều tính toán:
// 'to-setting': chọn giờ xong → tính mức hẹn cần cài
// 'to-finish' : nhập mức hẹn đang cài trên máy → tính giờ xong
const direction = useStorage('washing-timer:direction', 'to-setting')

// Mức hẹn giờ đang hiển thị trên máy (cho chiều 'to-finish')
const delayHours = useStorage('washing-timer:delay-hours', 2)
const delayMinutes = useStorage('washing-timer:delay-minutes', 0)

const MAX_DELAY_MIN = 20 * 60 // Electrolux thường hẹn tối đa 20 giờ

function fmtTime(d) {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
function fmtDur(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} phút`
  if (m === 0) return `${h} giờ`
  return `${h} giờ ${m} phút`
}

const result = computed(() => {
  const cyc = cycleMin.value
  if (!finishAt.value || cyc <= 0) return null

  const nowD = now.value
  const picked = new Date(finishAt.value)
  const target = new Date(nowD)
  target.setHours(picked.getHours(), picked.getMinutes(), 0, 0)

  // Không kịp hoàn thành hôm nay → tính cho ngày mai
  let rolledToTomorrow = false
  let startNowFinish = null
  if (target.getTime() - nowD.getTime() < cyc * 60000) {
    if (target.getTime() > nowD.getTime()) {
      startNowFinish = new Date(nowD.getTime() + cyc * 60000)
    }
    target.setDate(target.getDate() + 1)
    rolledToTomorrow = true
  }

  const totalMin = Math.round((target.getTime() - nowD.getTime()) / 60000)
  const neededExact = mode.value === 'end' ? totalMin : totalMin - cyc
  const st = step.value
  const minSetting = mode.value === 'end' ? Math.ceil(cyc / st) * st : 0

  let recommended = Math.round(neededExact / st) * st
  if (recommended < minSetting) recommended = minSetting

  const settings = [...new Set([recommended - st, recommended, recommended + st])].filter(
    (v) => v >= minSetting,
  )

  const candidates = settings.map((setting) => {
    let start, finish
    if (mode.value === 'end') {
      finish = new Date(nowD.getTime() + setting * 60000)
      start = new Date(finish.getTime() - cyc * 60000)
    } else {
      start = new Date(nowD.getTime() + setting * 60000)
      finish = new Date(start.getTime() + cyc * 60000)
    }
    const diff = Math.round((finish.getTime() - target.getTime()) / 60000)
    return { setting, start, finish, diff, recommended: setting === recommended }
  })

  const best = candidates.find((c) => c.recommended)

  return {
    target,
    totalMin,
    recommended,
    candidates,
    best,
    rolledToTomorrow,
    startNowFinish,
    overMax: recommended > MAX_DELAY_MIN,
  }
})

// Chiều ngược: từ thông số trên máy → giờ hoàn thành
const reverseResult = computed(() => {
  const cyc = cycleMin.value
  const delay = (delayHours.value || 0) * 60 + (delayMinutes.value || 0)
  if (cyc <= 0 || delay <= 0) return null

  const nowD = now.value
  // Máy kiểu "kết thúc" không nhận mức hẹn thấp hơn thời gian giặt
  const belowMinimum = mode.value === 'end' && delay < cyc
  const effectiveDelay = belowMinimum ? cyc : delay

  let start, finish
  if (mode.value === 'end') {
    finish = new Date(nowD.getTime() + effectiveDelay * 60000)
    start = new Date(finish.getTime() - cyc * 60000)
  } else {
    start = new Date(nowD.getTime() + effectiveDelay * 60000)
    finish = new Date(start.getTime() + cyc * 60000)
  }

  return {
    start,
    finish,
    belowMinimum,
    startNextDay: start.getDate() !== nowD.getDate(),
    finishNextDay: finish.getDate() !== nowD.getDate(),
  }
})

function diffLabel(diff) {
  if (diff === 0) return 'Đúng giờ'
  return diff > 0 ? `Trễ ${fmtDur(diff)}` : `Sớm ${fmtDur(-diff)}`
}
function diffType(diff) {
  if (diff === 0) return 'success'
  return diff > 0 ? 'warning' : 'info'
}
</script>

<template>
  <div class="washing-timer">
    <n-grid cols="1 900:2" :x-gap="24" :y-gap="24">
      <!-- Cột nhập liệu -->
      <n-gi>
        <div class="section">
          <div class="section-title">Thiết lập</div>

          <n-tabs v-model:value="direction" type="segment" size="small" class="direction-tabs">
            <n-tab-pane name="to-setting" tab="Muốn xong đúng giờ" />
            <n-tab-pane name="to-finish" tab="Xem máy sẽ xong lúc nào" />
          </n-tabs>

          <n-form-item
            v-if="direction === 'to-setting'"
            label="Giờ muốn hoàn thành"
            :show-feedback="false"
            class="field"
          >
            <n-time-picker
              v-model:value="finishAt"
              format="HH:mm"
              :minutes="5"
              size="large"
              style="width: 100%"
            />
          </n-form-item>

          <n-form-item
            label="Thời gian chu trình giặt (xem trên màn hình máy)"
            :show-feedback="false"
            class="field field-tight"
          >
            <n-space :size="8">
              <n-input-number
                v-model:value="cycleHours"
                :min="0"
                :max="12"
                :show-button="false"
                style="width: 110px"
              >
                <template #suffix>giờ</template>
              </n-input-number>
              <n-input-number
                v-model:value="cycleMinutes"
                :min="0"
                :max="59"
                :show-button="false"
                style="width: 110px"
              >
                <template #suffix>phút</template>
              </n-input-number>
            </n-space>
          </n-form-item>

          <n-space :size="6" style="margin-bottom: 20px">
            <n-button
              v-for="p in presets"
              :key="p.label"
              size="tiny"
              round
              :type="isPresetActive(p) ? 'primary' : 'default'"
              :secondary="!isPresetActive(p)"
              @click="applyPreset(p)"
            >
              {{ p.label }}
            </n-button>
          </n-space>

          <n-form-item
            v-if="direction === 'to-finish'"
            label="Mức hẹn giờ đang cài trên máy"
            :show-feedback="false"
            class="field"
          >
            <n-space :size="8">
              <n-input-number
                v-model:value="delayHours"
                :min="0"
                :max="20"
                :show-button="false"
                style="width: 110px"
              >
                <template #suffix>giờ</template>
              </n-input-number>
              <n-input-number
                v-model:value="delayMinutes"
                :min="0"
                :max="59"
                :show-button="false"
                style="width: 110px"
              >
                <template #suffix>phút</template>
              </n-input-number>
            </n-space>
          </n-form-item>

          <n-form-item label="Kiểu hẹn giờ của máy" :show-feedback="false" class="field field-tight">
            <n-radio-group v-model:value="mode">
              <n-radio-button value="end">Hẹn giờ kết thúc</n-radio-button>
              <n-radio-button value="start">Hẹn giờ bắt đầu</n-radio-button>
            </n-radio-group>
          </n-form-item>
          <n-text depth="3" style="display: block; font-size: 13px; margin: 6px 0 20px">
            <template v-if="mode === 'end'">
              Máy hiển thị tổng thời gian đến khi <b>hoàn thành</b> (Delay End) — phổ biến trên
              Electrolux UltimateCare.
            </template>
            <template v-else>
              Máy hẹn thời gian chờ trước khi <b>bắt đầu giặt</b> (Delay Start).
            </template>
          </n-text>

          <n-form-item
            v-if="direction === 'to-setting'"
            label="Bước chỉnh hẹn giờ trên máy"
            :show-feedback="false"
            class="field"
          >
            <n-radio-group v-model:value="step">
              <n-radio-button :value="30">30 phút</n-radio-button>
              <n-radio-button :value="60">1 giờ</n-radio-button>
            </n-radio-group>
          </n-form-item>
        </div>
      </n-gi>

      <!-- Cột kết quả -->
      <n-gi>
        <div class="section result-col">
          <div class="section-title">Kết quả</div>
          <template v-if="direction === 'to-setting' && result">
          <n-alert
            v-if="result.rolledToTomorrow"
            type="info"
            :show-icon="true"
            style="margin-bottom: 12px"
          >
            Không kịp hoàn thành hôm nay — kết quả tính cho <b>ngày mai</b>.
            <template v-if="result.startNowFinish">
              Nếu giặt ngay bây giờ sẽ xong lúc <b>{{ fmtTime(result.startNowFinish) }}</b>.
            </template>
          </n-alert>

          <n-alert v-if="result.overMax" type="warning" style="margin-bottom: 12px">
            Cần hẹn {{ fmtDur(result.recommended) }} — vượt mức hẹn tối đa thường gặp (20 giờ).
            Hãy hẹn giờ muộn hơn trong ngày.
          </n-alert>

          <n-statistic label="Cài hẹn giờ trên máy" style="margin-bottom: 16px">
            <span class="big-setting">
              {{ result.recommended === 0 ? 'Giặt ngay (không hẹn)' : fmtDur(result.recommended) }}
            </span>
          </n-statistic>

          <div v-if="result.best" class="timeline">
            <div class="timeline-row">
              <span class="dot dot-now"></span>
              <span>Bấm bắt đầu bây giờ — <b>{{ fmtTime(now) }}</b></span>
            </div>
            <div class="timeline-row">
              <span class="dot dot-start"></span>
              <span>Máy bắt đầu giặt lúc <b>{{ fmtTime(result.best.start) }}</b></span>
            </div>
            <div class="timeline-row">
              <span class="dot dot-finish"></span>
              <span>
                Hoàn thành lúc <b>{{ fmtTime(result.best.finish) }}</b>
                <n-tag :type="diffType(result.best.diff)" size="small" round style="margin-left: 8px">
                  {{ diffLabel(result.best.diff) }}
                </n-tag>
              </span>
            </div>
          </div>

          <div class="table-scroll">
          <n-table size="small" :single-line="false">
            <thead>
              <tr>
                <th>Cài đặt</th>
                <th>Bắt đầu</th>
                <th>Hoàn thành</th>
                <th>So với mong muốn</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in result.candidates" :key="c.setting" :class="{ recommended: c.recommended }">
                <td>
                  {{ c.setting === 0 ? 'Giặt ngay' : fmtDur(c.setting) }}
                  <n-tag v-if="c.recommended" type="primary" size="tiny" round style="margin-left: 6px">
                    Khuyên dùng
                  </n-tag>
                </td>
                <td>{{ fmtTime(c.start) }}</td>
                <td>{{ fmtTime(c.finish) }}</td>
                <td>
                  <n-tag :type="diffType(c.diff)" size="small" round>{{ diffLabel(c.diff) }}</n-tag>
                </td>
              </tr>
            </tbody>
          </n-table>
          </div>
          </template>

          <!-- Chiều ngược: từ thông số trên máy → giờ hoàn thành -->
          <template v-else-if="direction === 'to-finish' && reverseResult">
            <n-alert v-if="reverseResult.belowMinimum" type="warning" style="margin-bottom: 12px">
              Máy kiểu "hẹn giờ kết thúc" không nhận mức hẹn thấp hơn thời gian giặt
              ({{ fmtDur(cycleMin) }}) — kết quả tính theo mức tối thiểu.
            </n-alert>

            <n-statistic label="Máy sẽ hoàn thành lúc" style="margin-bottom: 16px">
              <span class="big-setting">{{ fmtTime(reverseResult.finish) }}</span>
              <n-tag
                v-if="reverseResult.finishNextDay"
                type="info"
                size="small"
                round
                style="margin-left: 10px"
              >
                ngày mai
              </n-tag>
            </n-statistic>

            <div class="timeline">
              <div class="timeline-row">
                <span class="dot dot-now"></span>
                <span>Bấm bắt đầu bây giờ — <b>{{ fmtTime(now) }}</b></span>
              </div>
              <div class="timeline-row">
                <span class="dot dot-start"></span>
                <span>
                  Máy bắt đầu giặt lúc <b>{{ fmtTime(reverseResult.start) }}</b>
                  <n-tag v-if="reverseResult.startNextDay" size="tiny" round style="margin-left: 6px">
                    ngày mai
                  </n-tag>
                </span>
              </div>
              <div class="timeline-row">
                <span class="dot dot-finish"></span>
                <span>
                  Hoàn thành lúc <b>{{ fmtTime(reverseResult.finish) }}</b>
                  <n-tag v-if="reverseResult.finishNextDay" size="tiny" round style="margin-left: 6px">
                    ngày mai
                  </n-tag>
                </span>
              </div>
            </div>
          </template>

          <n-text v-else depth="3">
            Nhập đủ thông số để xem kết quả.
          </n-text>
        </div>
      </n-gi>
    </n-grid>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
}
.direction-tabs {
  margin-bottom: 20px;
}
/* :show-feedback="false" bỏ đệm mặc định nên tự thêm khoảng cách giữa các hàng */
.section :deep(.field) {
  margin-bottom: 20px;
}
.section :deep(.field-tight) {
  margin-bottom: 8px;
}
@media (min-width: 900px) {
  .result-col {
    border-left: 1px solid rgba(128, 128, 128, 0.18);
    padding-left: 24px;
    height: 100%;
  }
}
.big-setting {
  font-size: 32px;
  font-weight: 700;
}
.timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.timeline-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-now {
  background: #909399;
}
.dot-start {
  background: #2080f0;
}
.dot-finish {
  background: #18a058;
}
tr.recommended td {
  font-weight: 600;
}
.table-scroll {
  overflow-x: auto;
  margin-top: 16px;
}
.table-scroll .n-table {
  min-width: 420px;
}
</style>
