<template>
  <v-slide-y-reverse-transition>
    <div v-if="active" class="komga-tts-playback-bar-container">
      <v-card class="komga-tts-playback-bar elevation-8" rounded="lg">
        <v-row no-gutters align="center" class="px-4 py-2">
          
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
            <span class="preview-label text-caption text--secondary d-block">Reading:</span>
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

export default Vue.extend({
  name: 'TtsPlaybackBar',
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
}

.komga-tts-playback-bar {
  pointer-events: auto;
  background: rgba(var(--v-theme-surface), 0.85) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s ease;
}

.theme--light .komga-tts-playback-bar {
  background: rgba(255, 255, 255, 0.9) !important;
  border: 1px solid rgba(0, 0, 0, 0.06);
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
