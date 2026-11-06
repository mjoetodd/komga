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

    <div class="d-flex flex-wrap ga-2">
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:account-search"
        :loading="busy === 'analyze'"
        :disabled="busy != null || !!bookJob"
        @click="analyze"
      >
        {{ analyzeText }}
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:headphones"
        :loading="busy === 'generate'"
        :disabled="busy != null || !!bookJob || state.castState !== 'READY'"
        :title="
          state.castState !== 'READY'
            ? 'Character analysis must finish first'
            : undefined
        "
        @click="generate"
      >
        {{ generateText }}
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
import {
  displayJobError,
  jobButtonText,
  type CharacterJob,
} from '@/functions/series-characters'

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
const jobs = ref<CharacterJob[]>([])

// The buttons ARE the status display: the active job covering this book
// (matched by the job's book list) drives both buttons' text and disabled
// state, derived from the jobs endpoint on every poll — so a refresh or a
// return visit always shows the true current state.
function matchesBook(j: CharacterJob): boolean {
  const num = state.value?.number
  if (num != null && j.bookNumbers && j.bookNumbers.length > 0) {
    return j.bookNumbers.includes(num)
  }
  return num != null && (j.detail?.includes(`#${num}`) ?? false)
}

const bookJob = computed(() => {
  return jobs.value.find((j) => {
    if (j.state !== 'queued' && j.state !== 'running') return false
    return matchesBook(j)
  })
})

const analyzeText = computed(() => {
  const job = bookJob.value
  if (job?.type === 'analyze_series') return jobButtonText(job)
  return state.value?.castState === 'READY' ? 'Re-analyze book' : 'Analyze book'
})

const generateText = computed(() => {
  const job = bookJob.value
  if (job?.type === 'generate_audiobooks') return jobButtonText(job)
  return state.value?.hasAudiobook ? 'Regenerate audiobook' : 'Generate audiobook'
})

async function refresh() {
  await queryCache.invalidateQueries({
    key: QUERY_KEYS_SERIES_CHARACTERS.bySeriesId(props.seriesId),
  })
}

async function pollJobs() {
  try {
    const before = jobs.value
    jobs.value = await fetchCharacterJobs(props.seriesId)
    const wasActive = before.some((j) => j.state === 'queued' || j.state === 'running')
    const nowActive = jobs.value.some((j) => j.state === 'queued' || j.state === 'running')
    if (wasActive && !nowActive) {
      const failed = displayJobError(jobs.value, matchesBook)
      if (failed?.error) error.value = failed.error
      await refresh()
    }
  } catch {
    // jobs endpoint unavailable — stay silent
  }
}

let jobTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void pollJobs()
  jobTimer = setInterval(() => void pollJobs(), 4000)
})
onUnmounted(() => {
  if (jobTimer) clearInterval(jobTimer)
})

async function analyze() {
  busy.value = 'analyze'
  error.value = null
  try {
    await postAnalyzeCharacters(props.seriesId, [props.bookId])
    await pollJobs()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not queue analysis'
  } finally {
    busy.value = null
  }
}

async function generate() {
  busy.value = 'generate'
  error.value = null
  try {
    await postGenerateAudiobooks(props.seriesId, [props.bookId])
    await pollJobs()
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
