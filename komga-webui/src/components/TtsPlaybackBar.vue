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
        <v-row no-gutters align="center" class="px-4 py-2">

          <!-- Minimize Button -->
          <v-col cols="auto" class="d-flex align-center">
            <v-btn icon small @click="minimized = true" title="Minimize">
              <v-icon small>mdi-chevron-down</v-icon>
            </v-btn>
          </v-col>

          <!-- Prev Button -->
          <v-col cols="auto" class="d-flex align-center">
            <v-btn icon @click="$emit('prev')" title="Previous sentence">
              <v-icon>mdi-skip-previous</v-icon>
            </v-btn>
          </v-col>

          <!-- Play/Pause Button -->
          <v-col cols="auto" class="d-flex align-center mx-1">
            <v-btn fab small color="primary" @click="$emit('toggle-play')" :title="state === 'speaking' ? 'Pause' : 'Play'">
              <v-icon>{{ state === 'speaking' ? 'mdi-pause' : 'mdi-play' }}</v-icon>
            </v-btn>
          </v-col>

          <!-- Next Button -->
          <v-col cols="auto" class="d-flex align-center">
            <v-btn icon @click="$emit('next')" title="Next sentence">
              <v-icon>mdi-skip-next</v-icon>
            </v-btn>
          </v-col>

          <!-- Preview Text / Sentence -->
          <v-col class="px-4 text-truncate text-body-2 font-weight-medium">
            <span class="preview-label text-caption d-block" style="opacity: 0.7">Reading:</span>
            <span class="preview-text" :title="sentenceText">{{ sentenceText || '...' }}</span>
          </v-col>

          <!-- Speed Display & Controls -->
          <v-col cols="auto" class="d-flex align-center mr-2">
            <v-btn icon small @click="$emit('speed-down')" title="Slower">
              <v-icon small>mdi-minus</v-icon>
            </v-btn>
            <span class="mx-2 text-caption font-weight-bold" style="min-width: 32px; text-align: center;">
              {{ speed.toFixed(1) }}x
            </span>
            <v-btn icon small @click="$emit('speed-up')" title="Faster">
              <v-icon small>mdi-plus</v-icon>
            </v-btn>
          </v-col>

          <!-- Stop/Close Button -->
          <v-col cols="auto" class="d-flex align-center pl-2 border-left">
            <v-btn icon color="error" @click="$emit('stop')" title="Stop read aloud">
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
    // { background, text, uiChrome, swatch, highlight } from the active reading theme
    // (komga-webui/src/functions/epub-themes.ts), or undefined before EpubReader resolves it.
    themeVariant: {
      type: Object,
      default: undefined,
    },
  },
  computed: {
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
