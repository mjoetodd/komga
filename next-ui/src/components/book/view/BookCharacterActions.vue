<template>
  <div v-if="state">
    <div class="text-title-medium d-flex align-center ga-2 mb-2">
      <v-icon icon="i-mdi:account-voice" />
      Characters &amp; audiobook
    </div>

    <div class="d-flex flex-wrap align-center ga-2 mb-2">
      <v-chip
        size="small"
        rounded
        label
        :color="state.castState === 'READY' ? 'success' : 'warning'"
        :text="
          state.castState === 'READY'
            ? 'Characters ready'
            : 'Character analysis needed'
        "
      />
      <v-chip
        v-if="state.hasAudiobook"
        size="small"
        rounded
        label
        color="success"
        text="Audiobook ready"
      />
      <v-chip
        v-if="state.reprocessCharacters"
        size="small"
        rounded
        label
        color="info"
        text="Marked: re-analyze"
      />
      <v-chip
        v-if="state.reprocessAudiobook"
        size="small"
        rounded
        label
        color="info"
        text="Marked: re-render audiobook"
      />
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-2"
      :text="error"
    />
    <v-alert
      v-if="notice"
      type="success"
      variant="tonal"
      density="compact"
      class="mb-2"
      :text="notice"
    />
    <v-alert
      v-if="jobProgress"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      {{ jobProgress }}
      <v-progress-linear
        v-if="trackedJob?.bookCount"
        :model-value="((trackedJob.bookIndex ?? 0) / trackedJob.bookCount) * 100"
        color="primary"
        rounded
        class="mt-1"
      />
    </v-alert>

    <div class="d-flex flex-wrap ga-2">
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:account-search"
        :loading="busy === 'analyze'"
        :disabled="busy != null || !!trackedJob"
        @click="analyze"
      >
        {{ state.castState === 'READY' ? 'Re-analyze book' : 'Analyze book' }}
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:headphones"
        :loading="busy === 'generate'"
        :disabled="busy != null || !!trackedJob || state.castState !== 'READY'"
        :title="
          state.castState !== 'READY'
            ? 'Character analysis must finish first'
            : undefined
        "
        @click="generate"
      >
        {{ state.hasAudiobook ? 'Regenerate audiobook' : 'Generate audiobook' }}
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        :disabled="busy != null"
        @click="toggleMark('characters')"
      >
        {{ state.reprocessCharacters ? 'Unmark re-analyze' : 'Mark for re-analysis' }}
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        :disabled="busy != null"
        @click="toggleMark('audiobook')"
      >
        {{ state.reprocessAudiobook ? 'Unmark re-render' : 'Mark for re-render' }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useQuery, useQueryCache } from '@pinia/colada'
import { seriesCharactersQuery, QUERY_KEYS_SERIES_CHARACTERS } from '@/colada/series-characters'
import {
  fetchCharacterJobs,
  postAnalyzeCharacters,
  postCharacterMarks,
  postGenerateAudiobooks,
} from '@/api/series-characters'
import type { CharacterJob } from '@/functions/series-characters'

const props = defineProps<{
  bookId: string
  seriesId: string
}>()

const queryCache = useQueryCache()
const { data: info } = useQuery(() => ({
  ...seriesCharactersQuery({ seriesId: props.seriesId }),
}))

const bookState = computed(() => info.value?.books.find((b) => b.bookId === props.bookId))
// The character/audiobook pipeline only handles EPUB series; stay invisible
// for comics and other formats.
const state = computed(() =>
  bookState.value?.file.toLowerCase().endsWith('.epub') ? bookState.value : undefined,
)
const busy = ref<string | null>(null)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const trackedJob = ref<CharacterJob | null>(null)

const jobProgress = computed(() => {
  const job = trackedJob.value
  if (!job || (job.state !== 'queued' && job.state !== 'running')) return ''
  const label =
    job.type === 'analyze_series'
      ? 'Analyzing characters'
      : job.type === 'generate_audiobooks'
        ? 'Generating audiobook'
        : 'Working'
  if (job.state === 'queued') return `${label} — queued…`
  const parts = [label, job.phase ?? 'working']
  let text = parts.join(' — ')
  if (job.bookIndex != null && job.bookCount && job.bookCount > 1) {
    text += ` (book ${job.bookIndex} of ${job.bookCount})`
  }
  if (job.detail) text += ` · ${job.detail}`
  return text
})

async function refresh() {
  await queryCache.invalidateQueries({
    key: QUERY_KEYS_SERIES_CHARACTERS.bySeriesId(props.seriesId),
  })
}

async function pollTracked() {
  try {
    const jobs = await fetchCharacterJobs(props.seriesId)
    if (trackedJob.value) {
      const current = jobs.find((j) => j.id === trackedJob.value!.id)
      if (!current) return
      trackedJob.value = current
      if (current.state === 'done') {
        notice.value =
          current.type === 'generate_audiobooks'
            ? 'Audiobook generation complete.'
            : 'Character analysis complete.'
        trackedJob.value = null
        await refresh()
      } else if (current.state === 'error') {
        error.value = current.error ?? 'The job failed'
        trackedJob.value = null
      }
    } else {
      // adopt an in-flight job that names this book (e.g. started from the
      // series page) so progress shows here too
      const num = state.value?.number
      const active = jobs.find(
        (j) =>
          (j.state === 'queued' || j.state === 'running') &&
          num != null &&
          (j.detail?.includes(`#${num}`) ?? false),
      )
      if (active) trackedJob.value = active
    }
  } catch {
    // jobs endpoint unavailable — stay silent
  }
}

let jobTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void pollTracked()
  jobTimer = setInterval(() => void pollTracked(), 4000)
})
onUnmounted(() => {
  if (jobTimer) clearInterval(jobTimer)
})

async function analyze() {
  busy.value = 'analyze'
  error.value = null
  notice.value = null
  try {
    const job = await postAnalyzeCharacters(props.seriesId, [props.bookId])
    trackedJob.value = { ...job, state: 'queued' }
    notice.value = 'Analysis queued.'
    void pollTracked()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not queue analysis'
  } finally {
    busy.value = null
  }
}

async function generate() {
  busy.value = 'generate'
  error.value = null
  notice.value = null
  try {
    const job = await postGenerateAudiobooks(props.seriesId, [props.bookId])
    trackedJob.value = { ...job, state: 'queued' }
    notice.value = 'Audiobook generation queued.'
    void pollTracked()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not queue audiobook generation'
  } finally {
    busy.value = null
  }
}

async function toggleMark(kind: 'characters' | 'audiobook') {
  if (!state.value) return
  busy.value = 'mark'
  error.value = null
  try {
    await postCharacterMarks(props.seriesId, [props.bookId], {
      reprocessCharacters:
        kind === 'characters' ? !state.value.reprocessCharacters : undefined,
      reprocessAudiobook: kind === 'audiobook' ? !state.value.reprocessAudiobook : undefined,
    })
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not update marks'
  } finally {
    busy.value = null
  }
}
</script>
