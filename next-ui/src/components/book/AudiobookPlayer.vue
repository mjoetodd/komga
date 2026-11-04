<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center ga-3 mb-3">
      <v-img
        v-if="posterUrl"
        :src="posterUrl"
        width="54"
        max-width="54"
        aspect-ratio="0.7"
        cover
        class="rounded"
      />
      <div class="flex-grow-1 overflow-hidden">
        <div class="text-h6 text-truncate">{{ title }}</div>
        <div class="text-body-2 text-medium-emphasis text-truncate">
          {{ book.seriesTitle }}<template v-if="authors"> · {{ authors }}</template>
        </div>
      </div>
      <v-chip
        v-if="audiobook.voice"
        prepend-icon="i-mdi:account-voice"
        size="small"
        variant="tonal"
      >
        {{ audiobook.voice }}
      </v-chip>
    </div>

    <!-- Follow-along text -->
    <v-card
      ref="listCard"
      variant="outlined"
      class="mb-3"
    >
      <div
        ref="listEl"
        class="segments px-4 py-3"
      >
        <p
          v-for="segment in audiobook.segments"
          :key="segment.i"
          :data-seg="segment.i"
          class="segment"
          :class="{ active: segment.i === activeSegment?.i }"
          @click="seekTo(segment.start)"
        >
          {{ segment.text }}
        </p>
        <p
          v-if="audiobook.segments.length === 0"
          class="text-medium-emphasis"
        >
          This audiobook has no sync map, so there is no text to follow along with.
        </p>
      </div>
    </v-card>

    <v-alert
      v-if="audioError"
      type="error"
      variant="tonal"
      class="mb-3"
      text="The audio file could not be played. It may have been moved or deleted."
    />

    <!-- Controls -->
    <div class="d-flex align-center ga-2">
      <span class="text-body-2 time-label">{{ formatPlaybackTime(displayTime) }}</span>
      <v-slider
        :model-value="displayTime"
        :max="duration"
        :step="0.1"
        hide-details
        @start="scrubbing = true"
        @update:model-value="displayTime = $event"
        @end="commitSeek"
      />
      <span class="text-body-2 time-label">{{ formatPlaybackTime(duration) }}</span>
    </div>

    <div class="d-flex align-center justify-center ga-1 ga-sm-2">
      <!-- Sleep timer -->
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            icon="i-mdi:sleep"
            :color="sleepMinutes !== null ? 'primary' : undefined"
            :title="sleepMinutes !== null ? `Sleep timer: ${sleepMinutes} min` : 'Sleep timer'"
          />
        </template>
        <v-list>
          <v-list-item
            title="Sleep timer off"
            @click="setSleepTimer(null)"
          />
          <v-list-item
            v-for="minutes in sleepOptions"
            :key="minutes"
            :title="`${minutes} minutes`"
            @click="setSleepTimer(minutes)"
          />
        </v-list>
      </v-menu>

      <v-btn
        icon="i-mdi:skip-previous"
        title="Previous segment"
        :disabled="activeIndex <= 0"
        @click="previousSegment"
      />
      <v-btn
        icon="i-mdi:rewind-15"
        title="Back 15 seconds"
        @click="skipBy(-15)"
      />
      <v-btn
        :icon="isPlaying ? 'i-mdi:pause' : 'i-mdi:play'"
        color="primary"
        size="large"
        variant="flat"
        :title="isPlaying ? 'Pause' : 'Play'"
        @click="togglePlay"
      />
      <v-btn
        icon="i-mdi:fast-forward-15"
        title="Forward 15 seconds"
        @click="skipBy(15)"
      />
      <v-btn
        icon="i-mdi:skip-next"
        title="Next segment"
        :disabled="activeIndex >= audiobook.segments.length - 1"
        @click="nextSegment"
      />

      <!-- Playback rate -->
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            :title="`Playback speed: ${playbackRate}x`"
            class="text-body-2"
            min-width="52"
          >
            {{ playbackRate }}x
          </v-btn>
        </template>
        <v-list>
          <v-list-item
            v-for="rate in rateOptions"
            :key="rate"
            :title="`${rate}x`"
            :active="rate === playbackRate"
            @click="setRate(rate)"
          />
        </v-list>
      </v-menu>

      <v-btn
        :icon="follow ? 'i-mdi:crosshairs-gps' : 'i-mdi:crosshairs'"
        :color="follow ? 'primary' : undefined"
        title="Follow along with the text"
        @click="follow = !follow"
      />
    </div>

    <audio
      ref="audioEl"
      :src="fileUrl"
      preload="metadata"
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @play="isPlaying = true"
      @pause="onPause"
      @ended="onEnded"
      @error="audioError = true"
    />
  </div>
</template>

<script setup lang="ts">
import { bookPosterUrl } from '@/api/images'
import {
  audiobookFileUrl,
  fetchPositions,
  fetchProgression,
  saveProgression,
} from '@/api/audiobooks'
import type { BookDto } from '@/generated/openapi'
import {
  type AudiobookInfo,
  findSegmentIndex,
  formatPlaybackTime,
  locatorToTime,
  timeToLocator,
} from '@/functions/audiobook'

const props = defineProps<{
  book: BookDto
  audiobook: AudiobookInfo
}>()

const audioEl = ref<HTMLAudioElement>()
const listEl = ref<HTMLElement>()
const isPlaying = ref(false)
const audioError = ref(false)
const currentTime = ref(0)
const displayTime = ref(0)
const scrubbing = ref(false)
const mediaDuration = ref(0)
const playbackRate = ref(1)
const follow = ref(true)
const sleepMinutes = ref<number | null>(null)
let sleepTimeout: ReturnType<typeof setTimeout> | undefined
let lastSavedAt = 0
let lastServerSyncMs = 0
let positionsCache: Awaited<ReturnType<typeof fetchPositions>> = []
let metadataLoaded = false
let progressionSettled = false
let startResolved = false
let serverStart: { t: number; ts: number } | undefined

const rateOptions = [0.75, 1, 1.25, 1.5, 1.75, 2]
const sleepOptions = [5, 10, 15, 20, 30, 45, 60]

const fileUrl = computed(() => audiobookFileUrl(props.book.id))
const posterUrl = computed(() => bookPosterUrl(props.book.id))
const title = computed(() => props.book.metadata.title || props.book.name)
const authors = computed(() =>
  [...new Set(props.book.metadata.authors.map((a) => a.name))].join(', '),
)
const duration = computed(() => mediaDuration.value || props.audiobook.durationSec || 0)
const activeIndex = computed(() => findSegmentIndex(props.audiobook.segments, currentTime.value))
const activeSegment = computed(() =>
  activeIndex.value >= 0 ? props.audiobook.segments[activeIndex.value] : undefined,
)

const storageKey = computed(() => `komga-audiobook-position:${props.book.id}`)

function seekTo(time: number) {
  const audio = audioEl.value
  if (!audio) return
  audio.currentTime = Math.min(Math.max(time, 0), duration.value || time)
}

function commitSeek() {
  scrubbing.value = false
  seekTo(displayTime.value)
}

function togglePlay() {
  const audio = audioEl.value
  if (!audio) return
  if (audio.paused) void audio.play().catch(() => (audioError.value = true))
  else audio.pause()
}

function skipBy(seconds: number) {
  seekTo(currentTime.value + seconds)
}

function previousSegment() {
  const target = props.audiobook.segments[activeIndex.value - 1]
  if (target) seekTo(target.start)
}

function nextSegment() {
  const target = props.audiobook.segments[activeIndex.value + 1]
  if (target) seekTo(target.start)
}

function setRate(rate: number) {
  playbackRate.value = rate
  if (audioEl.value) audioEl.value.playbackRate = rate
}

function setSleepTimer(minutes: number | null) {
  sleepMinutes.value = minutes
  if (sleepTimeout) clearTimeout(sleepTimeout)
  sleepTimeout = undefined
  if (minutes !== null) {
    sleepTimeout = setTimeout(() => {
      audioEl.value?.pause()
      sleepMinutes.value = null
    }, minutes * 60_000)
  }
}

function savePosition() {
  lastSavedAt = currentTime.value
  try {
    localStorage.setItem(
      storageKey.value,
      JSON.stringify({ t: Math.floor(currentTime.value), ts: Date.now() }),
    )
  } catch {
    // storage unavailable (private mode etc.): resume is best-effort
  }
}

function readLocalPosition(): { t: number; ts: number } | undefined {
  try {
    const raw = localStorage.getItem(storageKey.value)
    if (!raw) return undefined
    // legacy entries are a plain seconds number with no timestamp
    if (!raw.startsWith('{')) {
      const t = Number(raw)
      return Number.isFinite(t) ? { t, ts: 0 } : undefined
    }
    const parsed = JSON.parse(raw) as { t?: number; ts?: number }
    return typeof parsed.t === 'number' ? { t: parsed.t, ts: parsed.ts ?? 0 } : undefined
  } catch {
    return undefined
  }
}

/** Write the listening position back as reading progression for the EPUB reader. */
function syncServerProgress(force = false) {
  const now = Date.now()
  if (!force && now - lastServerSyncMs < 20_000) return
  lastServerSyncMs = now
  const locator = timeToLocator(props.audiobook.segments, currentTime.value, positionsCache)
  if (!locator) return
  void saveProgression(props.book.id, locator).then((ok) => {
    // visible in dev tools when the sync breaks again; the local resume
    // still covers the user in the meantime
    if (!ok) console.warn('[audiobook] reading-progression sync failed')
  })
}

/**
 * Resume where the listener or reader left off: the local position and the
 * server-side reading progression are both candidates; the fresher one wins.
 */
function resolveStartPosition() {
  if (startResolved || !metadataLoaded || !progressionSettled) return
  startResolved = true
  const audio = audioEl.value
  if (!audio) return
  const local = readLocalPosition()
  const candidates = [local, serverStart].filter((c) => c !== undefined)
  if (!candidates.length) return
  const best = candidates.reduce((a, b) => (b.ts > a.ts ? b : a))
  if (best.t > 5 && best.t < (mediaDuration.value || Infinity) - 15) {
    audio.currentTime = best.t
    currentTime.value = best.t
    displayTime.value = best.t
  }
}

function onLoadedMetadata() {
  const audio = audioEl.value
  if (!audio) return
  mediaDuration.value = Number.isFinite(audio.duration) ? audio.duration : 0
  audio.playbackRate = playbackRate.value
  metadataLoaded = true
  resolveStartPosition()
  setupMediaSession()
}

function onTimeUpdate() {
  const audio = audioEl.value
  if (!audio) return
  currentTime.value = audio.currentTime
  if (!scrubbing.value) displayTime.value = audio.currentTime
  if (Math.abs(audio.currentTime - lastSavedAt) > 5) savePosition()
  syncServerProgress()
  updateMediaSessionPosition()
}

function onPause() {
  isPlaying.value = false
  savePosition()
  syncServerProgress(true)
}

function onEnded() {
  isPlaying.value = false
  setSleepTimer(null)
  syncServerProgress(true)
  try {
    localStorage.removeItem(storageKey.value)
  } catch {
    // ignore
  }
}

// keep the playing segment visible in the follow-along text
watch(activeIndex, async (index) => {
  if (!follow.value || index < 0) return
  await nextTick()
  listEl.value
    ?.querySelector(`[data-seg="${props.audiobook.segments[index]?.i}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})

// Lock-screen / headphone controls, mirroring the classic reader's TTS bar.
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title.value,
      artist: authors.value || undefined,
      album: props.book.seriesTitle,
      artwork: posterUrl.value
        ? [{ src: posterUrl.value, sizes: '512x512', type: 'image/jpeg' }]
        : undefined,
    })
    navigator.mediaSession.setActionHandler('play', () => void audioEl.value?.play())
    navigator.mediaSession.setActionHandler('pause', () => audioEl.value?.pause())
    navigator.mediaSession.setActionHandler('previoustrack', previousSegment)
    navigator.mediaSession.setActionHandler('nexttrack', nextSegment)
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seekTo(details.seekTime)
    })
  } catch {
    // Media Session is a progressive enhancement only
  }
}

function updateMediaSessionPosition() {
  if (!('mediaSession' in navigator) || !mediaDuration.value) return
  try {
    navigator.mediaSession.setPositionState({
      duration: mediaDuration.value,
      position: Math.min(currentTime.value, mediaDuration.value),
      playbackRate: playbackRate.value,
    })
  } catch {
    // ignore out-of-range reports
  }
}

onMounted(() => {
  void fetchPositions(props.book.id).then((positions) => {
    positionsCache = positions
  })
  void fetchProgression(props.book.id)
    .then((progression) => {
      if (progression?.locator) {
        const t = locatorToTime(props.audiobook.segments, progression.locator)
        if (t !== undefined) {
          serverStart = {
            t,
            ts: progression.modified ? new Date(progression.modified).getTime() : 0,
          }
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      progressionSettled = true
      resolveStartPosition()
    })
})

onBeforeUnmount(() => {
  savePosition()
  syncServerProgress(true)
  if (sleepTimeout) clearTimeout(sleepTimeout)
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
      navigator.mediaSession.setActionHandler('seekto', null)
    } catch {
      // ignore
    }
  }
})
</script>

<style scoped>
.segments {
  max-height: 46vh;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.segment {
  margin: 0 0 0.35rem;
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  cursor: pointer;
  line-height: 1.55;
}

.segment:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.segment.active {
  background: rgba(var(--v-theme-primary), 0.18);
}

.time-label {
  min-width: 44px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
