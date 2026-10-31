<template>
  <v-slide-y-reverse-transition>
    <div v-if="active" class="komga-tts-playback-bar-container">
      <!-- Minimized: a slim floating pill with just play/pause, to avoid permanently
           occluding ~15-20% of the readable area on mobile. Tap it to expand back out. -->
      <v-card
        v-if="minimized"
        class="komga-tts-pill elevation-8"
        rounded="pill"
        :style="barStyle"
        @click="minimized = false"
      >
        <v-btn icon @click.stop="$emit('toggle-play')" :title="state === 'speaking' ? 'Pause' : 'Play'">
          <v-icon>{{ state === 'speaking' ? 'mdi-pause' : 'mdi-play' }}</v-icon>
        </v-btn>
      </v-card>

      <v-card v-else class="komga-tts-playback-bar elevation-8" rounded="lg" :style="barStyle">
        <!-- Chapter progress: how far through this chapter's segments playback has got.
             Purely positional (segment count), so it advances in sentence/paragraph steps
             rather than smoothly - accurate, and honest about the granularity. -->
        <div v-if="totalSegments > 0" class="progress-track">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
        </div>
        <v-row no-gutters align="center" class="bar-row px-2 px-sm-4 py-2">

          <!-- Minimize Button -->
          <v-col cols="auto" class="d-flex align-center">
            <v-btn icon small @click="minimized = true" title="Minimize">
              <v-icon small>mdi-chevron-down</v-icon>
            </v-btn>
          </v-col>

          <!-- Prev Button -->
          <v-col cols="auto" class="d-flex align-center">
            <v-btn icon small @click="$emit('prev')" title="Previous sentence">
              <v-icon>mdi-skip-previous</v-icon>
            </v-btn>
          </v-col>

          <!-- Play/Pause Button -->
          <v-col cols="auto" class="d-flex align-center mx-1">
            <v-btn fab x-small color="primary" @click="$emit('toggle-play')" :title="state === 'speaking' ? 'Pause' : 'Play'">
              <v-icon>{{ state === 'speaking' ? 'mdi-pause' : 'mdi-play' }}</v-icon>
            </v-btn>
          </v-col>

          <!-- Next Button -->
          <v-col cols="auto" class="d-flex align-center">
            <v-btn icon small @click="$emit('next')" title="Next sentence">
              <v-icon>mdi-skip-next</v-icon>
            </v-btn>
          </v-col>

          <!-- Preview Text / Sentence - dropped below the 'sm' breakpoint: the active
               sentence/paragraph is already highlighted in the page itself, and this was the
               main thing pushing the bar's minimum width past what fits on a phone screen. -->
          <v-col class="preview-col d-none d-sm-flex px-4 text-truncate text-body-2 font-weight-medium">
            <span class="preview-label text-caption d-block" style="opacity: 0.7">
              Reading<template v-if="totalSegments > 0"> · {{ currentSegment + 1 }} of {{ totalSegments }}</template>:
            </span>
            <span class="preview-text" :title="sentenceText">{{ sentenceText || '...' }}</span>
          </v-col>

          <!-- Speed Display & Controls -->
          <v-col cols="auto" class="d-flex align-center mr-1 mr-sm-2">
            <v-btn icon x-small @click="$emit('speed-down')" title="Slower">
              <v-icon small>mdi-minus</v-icon>
            </v-btn>
            <span class="mx-1 text-caption font-weight-bold" style="min-width: 28px; text-align: center;">
              {{ speed.toFixed(1) }}x
            </span>
            <v-btn icon x-small @click="$emit('speed-up')" title="Faster">
              <v-icon small>mdi-plus</v-icon>
            </v-btn>
          </v-col>

          <!-- Sleep Timer: stop playback after a set time - the read-aloud equivalent of
               an audiobook sleep timer. Lives entirely in this component: it counts down
               locally and simply emits the existing 'stop' when it fires. -->
          <v-col cols="auto" class="d-flex align-center">
            <v-menu offset-y>
              <template v-slot:activator="{ on, attrs }">
                <v-btn
                  icon
                  small
                  v-bind="attrs"
                  v-on="on"
                  :color="sleepRemainingSec > 0 ? 'primary' : ''"
                  title="Sleep timer"
                >
                  <v-icon>mdi-timer-outline</v-icon>
                </v-btn>
              </template>
              <v-list dense>
                <v-list-item
                  v-for="option in sleepOptions"
                  :key="option.minutes"
                  @click="setSleepTimer(option.minutes)"
                >
                  <v-list-item-title>
                    {{ option.label }}
                    <v-icon v-if="sleepMinutes === option.minutes" small class="ml-1">mdi-check</v-icon>
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
            <span v-if="sleepRemainingSec > 0" class="text-caption font-weight-bold mr-1" style="min-width: 34px;">
              {{ sleepRemainingLabel }}
            </span>
          </v-col>

          <!-- Stop/Close Button -->
          <v-col cols="auto" class="d-flex align-center pl-1 pl-sm-2 border-left">
            <v-btn icon small color="error" @click="$emit('stop')" title="Stop read aloud">
              <v-icon>mdi-stop</v-icon>
            </v-btn>
          </v-col>

        </v-row>
      </v-card>
    </div>
  </v-slide-y-reverse-transition>
</template>

<script lang="ts">
import Vue from 'vue'

// WCAG 2.x relative luminance / contrast ratio (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance)
function srgbToLinear(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const m = hex.replace('#', '')
  const r = parseInt(m.substring(0, 2), 16)
  const g = parseInt(m.substring(2, 4), 16)
  const b = parseInt(m.substring(4, 6), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA) + 0.05
  const lB = relativeLuminance(hexB) + 0.05
  return lA > lB ? lA / lB : lB / lA
}

export default Vue.extend({
  name: 'TtsPlaybackBar',
  data() {
    return {
      minimized: false,
      sleepMinutes: 0,
      sleepRemainingSec: 0,
      sleepIntervalId: null as number | null,
      sleepOptions: [
        { minutes: 0, label: 'Off' },
        { minutes: 10, label: '10 minutes' },
        { minutes: 20, label: '20 minutes' },
        { minutes: 30, label: '30 minutes' },
        { minutes: 45, label: '45 minutes' },
        { minutes: 60, label: '60 minutes' },
      ],
    }
  },
  props: {
    active: {
      type: Boolean,
      required: true,
    },
    state: {
      type: String, // 'idle' | 'speaking' | 'paused'
      required: true,
    },
    sentenceText: {
      type: String,
      default: '',
    },
    speed: {
      type: Number,
      required: true,
    },
    // 0..1 through the current chapter's segments, plus the raw position for the
    // "12 of 348" caption. Optional: older callers may not pass them.
    progress: {
      type: Number,
      default: 0,
    },
    currentSegment: {
      type: Number,
      default: 0,
    },
    totalSegments: {
      type: Number,
      default: 0,
    },
    // { background, text, uiChrome, swatch, highlight } from the active reading theme
    // (komga-webui/src/functions/epub-themes.ts), or undefined before EpubReader resolves it.
    themeVariant: {
      type: Object,
      default: undefined,
    },
  },
  computed: {
    progressPercent(): number {
      return Math.round(Math.min(Math.max(this.progress, 0), 1) * 100)
    },
    sleepRemainingLabel(): string {
      const total = this.sleepRemainingSec
      const m = Math.floor(total / 60)
      const s = total % 60
      return `${m}:${s.toString().padStart(2, '0')}`
    },
    // Prefer the active reading theme's own chrome/text colors so the bar visually matches
    // whichever of the 5 themes is selected, but only if that pairing clears WCAG AA (4.5:1).
    // Themes are authored as reading backgrounds, not necessarily as UI-chrome/text pairs, so
    // this can't be assumed - fall back to a semi-transparent dark scrim, which is legible
    // against any reading theme, when it doesn't.
    barStyle(): Record<string, string> {
      const variant = this.themeVariant as { uiChrome: string, text: string } | undefined
      if (variant && contrastRatio(variant.uiChrome, variant.text) >= 4.5) {
        return {
          backgroundColor: variant.uiChrome,
          color: variant.text,
        }
      }
      return {
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        color: '#FFFFFF',
      }
    },
  },
  watch: {
    // A stopped session shouldn't leave a live countdown behind (it would fire 'stop'
    // into a future session).
    active(isActive: boolean) {
      if (!isActive) this.clearSleepTimer()
    },
  },
  beforeDestroy() {
    this.clearSleepTimer()
  },
  methods: {
    setSleepTimer(minutes: number) {
      this.clearSleepTimer()
      this.sleepMinutes = minutes
      if (minutes <= 0) return
      // Anchor to a wall-clock deadline rather than decrementing blindly: interval ticks
      // are throttled in background tabs, and the remaining label should stay truthful.
      const deadline = Date.now() + minutes * 60 * 1000
      const tick = () => {
        const remaining = Math.round((deadline - Date.now()) / 1000)
        this.sleepRemainingSec = Math.max(remaining, 0)
        if (remaining <= 0) {
          this.clearSleepTimer()
          this.$emit('stop')
        }
      }
      tick()
      this.sleepIntervalId = window.setInterval(tick, 1000)
    },
    clearSleepTimer() {
      if (this.sleepIntervalId !== null) {
        clearInterval(this.sleepIntervalId)
        this.sleepIntervalId = null
      }
      this.sleepMinutes = 0
      this.sleepRemainingSec = 0
    },
  },
})
</script>

<style scoped>
.komga-tts-playback-bar-container {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  width: 90%;
  max-width: 650px;
  pointer-events: none;
  text-align: center;
}

.komga-tts-playback-bar {
  pointer-events: auto;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(128, 128, 128, 0.15);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.progress-track {
  height: 3px;
  background-color: rgba(128, 128, 128, 0.25);
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--v-primary-base, #1976d2);
  transition: width 0.4s ease;
}

.bar-row {
  flex-wrap: nowrap;
}

.preview-col {
  min-width: 0;
}

.komga-tts-pill {
  pointer-events: auto;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(128, 128, 128, 0.15);
  display: inline-flex;
  margin: 0 auto;
  cursor: pointer;
}

.border-left {
  border-left: 1px solid rgba(128, 128, 128, 0.2);
}

.preview-label {
  line-height: 1.2;
}

.preview-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
