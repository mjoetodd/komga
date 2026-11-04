<template>
  <v-container
    v-if="info?.available || info"
    fluid
  >
    <div class="text-title-medium d-flex align-center ga-2 mb-1">
      <v-icon icon="i-mdi:account-group" />
      Characters
      <v-chip
        v-if="info && info.suggestions.length > 0"
        size="x-small"
        rounded
        label
        color="warning"
        :text="`${info.suggestions.length} possible ${info.suggestions.length === 1 ? 'duplicate' : 'duplicates'}`"
      />
    </div>

    <template v-if="info?.available">
      <div class="text-body-small text-medium-emphasis mb-1">
        Character analysis: {{ info.castReadyCount }} of {{ info.totalBooks }} books
        <span v-if="info.canGenerateAllAudiobooks"> — series audiobooks unlocked</span>
        <span v-else-if="info.needsAnalysisCount > 0">
          — {{ info.needsAnalysisCount }}
          {{ info.needsAnalysisCount === 1 ? 'book needs' : 'books need' }} analysis before series
          audiobooks unlock
        </span>
        <span
          v-if="activeJob"
          class="text-primary"
        >
          · {{ jobStatusText(activeJob) }}
        </span>
      </div>
      <v-progress-linear
        :model-value="info.totalBooks ? (info.castReadyCount / info.totalBooks) * 100 : 0"
        color="primary"
        rounded
        class="mb-2"
      />
    </template>
    <div
      v-else-if="info"
      class="text-body-small text-medium-emphasis mb-2"
    >
      No character analysis yet for this series — {{ info.totalBooks }}
      {{ info.totalBooks === 1 ? 'book' : 'books' }} waiting.
    </div>

    <div
      v-if="activeJob"
      class="mb-2"
    >
      <v-alert
        type="info"
        variant="tonal"
        density="compact"
      >
        <span v-if="activeJob.state === 'queued'">Job queued…</span>
        <span v-else>
          {{ jobLabel(activeJob) }} — {{ activeJob.phase ?? 'working' }}
          <span v-if="activeJob.bookIndex != null && activeJob.bookCount">
            (book {{ activeJob.bookIndex }} of {{ activeJob.bookCount }})
          </span>
          <span v-if="activeJob.detail"> · {{ activeJob.detail }}</span>
          <span v-if="elapsedText"> · {{ elapsedText }}</span>
        </span>
        <v-progress-linear
          v-if="activeJob.bookIndex != null && activeJob.bookCount"
          :model-value="(activeJob.bookIndex / activeJob.bookCount) * 100"
          color="primary"
          rounded
          class="mt-1"
        />
      </v-alert>
    </div>
    <v-alert
      v-if="lastError"
      type="error"
      variant="tonal"
      density="compact"
      closable
      class="mb-2"
      :text="lastError"
      @click:close="dismissError"
    />

    <div class="d-flex flex-wrap ga-2 mb-2">
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:account-search"
        :disabled="!canAnalyze || submitting != null"
        :loading="submitting === 'analyze'"
        @click="submitAnalyze()"
      >
        {{ analyzeLabel }}
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:headphones"
        :disabled="!info?.canGenerateAllAudiobooks || submitting != null || !!activeJob"
        :loading="submitting === 'generate'"
        @click="submitGenerate()"
      >
        Generate all audiobooks
      </v-btn>
    </div>

    <div
      v-if="info?.available && info.suggestions.length > 0"
      class="mb-2"
    >
      <div class="text-label-medium text-medium-emphasis mb-1">Possible duplicates</div>
      <v-alert
        v-for="(s, i) in info.suggestions"
        :key="i"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-2"
      >
        <div class="text-body-medium">
          <strong>{{ s.aName }}</strong> and <strong>{{ s.bName }}</strong> may be the same person
          <span v-if="s.confidence != null">
            (confidence {{ Math.round(s.confidence * 100) }}%)
          </span>
        </div>
        <div
          v-if="s.reason"
          class="text-body-small text-medium-emphasis"
        >
          {{ s.reason }}
        </div>
        <div class="d-flex flex-wrap ga-2 mt-2">
          <v-btn
            size="x-small"
            variant="tonal"
            :disabled="!s.aId || !s.bId"
            @click="mergePair(s.aId!, s.bId!)"
          >
            Merge {{ s.bName }} into {{ s.aName }}
          </v-btn>
          <v-btn
            size="x-small"
            variant="tonal"
            :disabled="!s.aId || !s.bId"
            @click="mergePair(s.bId!, s.aId!)"
          >
            Merge {{ s.aName }} into {{ s.bName }}
          </v-btn>
          <v-btn
            size="x-small"
            variant="text"
            @click="dismissSuggestion(s.aName, s.bName)"
          >
            Not the same person
          </v-btn>
        </div>
      </v-alert>
    </div>

    <template v-if="info?.available">
      <div class="d-flex flex-wrap ga-1">
        <v-chip
          v-if="info.narrator"
          rounded
          label
          :color="info.narrator.voiceType === 'custom' ? 'primary' : undefined"
          :variant="info.narrator.voiceType === 'custom' ? 'outlined' : undefined"
          :title="`Narrator — voiced by ${info.narrator.voice}`"
          text="Narrator"
        />
        <v-chip
          v-for="character in info.characters"
          :key="character.id"
          rounded
          label
          clickable
          :color="character.voiceType === 'custom' ? 'primary' : undefined"
          :variant="character.voiceType === 'custom' ? 'outlined' : undefined"
          :class="character.status === 'merged' ? 'text-medium-emphasis' : undefined"
          :title="`${character.name} — voiced by ${character.voice} · ${character.totalLines} lines`"
          :text="character.name"
          @click="selected = character"
        />
      </div>

      <v-dialog
        :model-value="selected != null"
        max-width="640"
        @update:model-value="(v: boolean) => { if (!v) selected = null }"
      >
        <SeriesViewSeriesCharacterDetail
          v-if="selected"
          :character="selected"
          :all-characters="info.characters"
          @close="selected = null"
          @merge="onMerge"
        />
      </v-dialog>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { useQuery, useQueryCache } from '@pinia/colada'
import { seriesCharactersQuery, QUERY_KEYS_SERIES_CHARACTERS } from '@/colada/series-characters'
import {
  fetchCharacterJobs,
  postAnalyzeCharacters,
  postCharacterMarks,
  postDismissSuggestion,
  postGenerateAudiobooks,
  postMergeCharacters,
} from '@/api/series-characters'
import type { CharacterJob, SeriesCharacter } from '@/functions/series-characters'
import { useSelectionStore } from '@/stores/selection'

const props = defineProps<{
  seriesId: string
}>()

const queryCache = useQueryCache()
const { data: info } = useQuery(() => ({
  ...seriesCharactersQuery({ seriesId: props.seriesId }),
}))

const selected = ref<SeriesCharacter | null>(null)
const submitting = ref<string | null>(null)
const lastError = ref<string | null>(null)
const jobs = ref<CharacterJob[]>([])
const nowTs = ref(Date.now())

const activeJob = computed(() =>
  jobs.value.find((j) => j.state === 'queued' || j.state === 'running'),
)

const elapsedText = computed(() => {
  const job = activeJob.value
  if (!job?.createdAt) return ''
  const secs = Math.max(0, Math.floor((nowTs.value - new Date(job.createdAt).getTime()) / 1000))
  if (secs < 5) return ''
  return secs < 60 ? `${secs}s elapsed` : `${Math.floor(secs / 60)}m ${secs % 60}s elapsed`
})

const markedCount = computed(
  () => info.value?.books.filter((b) => b.reprocessCharacters).length ?? 0,
)

const canAnalyze = computed(() => {
  if (!info.value || submitting.value || activeJob.value) return false
  return info.value.needsAnalysisCount > 0 || markedCount.value > 0
})

const analyzeLabel = computed(() => {
  if (info.value && info.value.castReadyCount === 0 && markedCount.value === 0)
    return 'Analyze characters'
  if (markedCount.value > 0) return `Analyze (${markedCount.value} marked + new)`
  return 'Analyze new books'
})

function jobLabel(job: CharacterJob): string {
  return job.type === 'analyze_series'
    ? 'Analyzing characters'
    : job.type === 'generate_audiobooks'
      ? 'Generating audiobooks'
      : job.type === 'merge_characters'
        ? 'Merging characters'
        : 'Working'
}

function jobStatusText(job: CharacterJob): string {
  if (job.state === 'queued') return `${jobLabel(job)} queued`
  const parts = [jobLabel(job), job.phase ?? 'working']
  let text = parts.join(' — ')
  if (job.bookIndex != null && job.bookCount) text += ` (book ${job.bookIndex} of ${job.bookCount})`
  if (job.detail) text += ` · ${job.detail}`
  return text
}

// Marking lives in Komga's native selection bar: when books of this series
// are selected, add character/audiobook reprocessing actions to it.
const selectionStore = useSelectionStore()
const MARK_CHARS_TEXT = 'Mark for re-analysis'
const MARK_AUDIO_TEXT = 'Mark for re-render'

function syncSelectionActions() {
  const others = selectionStore.contextualActions.filter(
    (a) => a.text !== MARK_CHARS_TEXT && a.text !== MARK_AUDIO_TEXT,
  )
  const selectedIds = [...selectionStore.selection.keys()]
  const bookIds = selectedIds.filter((id) => info.value?.books.some((b) => b.bookId === id))
  if (info.value?.available && bookIds.length > 0) {
    selectionStore.contextualActions = [
      ...others,
      {
        text: MARK_CHARS_TEXT,
        icon: 'i-mdi:account-search',
        callback: () => void markSelected(bookIds, { reprocessCharacters: true }),
      },
      {
        text: MARK_AUDIO_TEXT,
        icon: 'i-mdi:headphones',
        callback: () => void markSelected(bookIds, { reprocessAudiobook: true }),
      },
    ]
  } else {
    selectionStore.contextualActions = others
  }
}

async function markSelected(
  bookIds: string[],
  marks: { reprocessCharacters?: boolean; reprocessAudiobook?: boolean },
) {
  try {
    await postCharacterMarks(props.seriesId, bookIds, marks)
    await refresh()
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : 'Could not update marks'
  }
}

watch(
  () => [...selectionStore.selection.keys()].join(','),
  () => syncSelectionActions(),
)
watch(
  () => info.value?.available,
  () => syncSelectionActions(),
)
onUnmounted(() => {
  selectionStore.contextualActions = selectionStore.contextualActions.filter(
    (a) => a.text !== MARK_CHARS_TEXT && a.text !== MARK_AUDIO_TEXT,
  )
})

async function refresh() {
  await queryCache.invalidateQueries({ key: QUERY_KEYS_SERIES_CHARACTERS.bySeriesId(props.seriesId) })
}

const dismissedErrorJobId = ref<string | null>(null)

function dismissError() {
  const failed = jobs.value.find((j) => j.state === 'error')
  if (failed) dismissedErrorJobId.value = failed.id
  lastError.value = null
}

async function pollJobs() {
  nowTs.value = Date.now()
  try {
    const before = jobs.value
    jobs.value = await fetchCharacterJobs(props.seriesId)
    const wasActive = before.some((j) => j.state === 'queued' || j.state === 'running')
    const nowActive = jobs.value.some((j) => j.state === 'queued' || j.state === 'running')
    if (wasActive && !nowActive) {
      const failed = jobs.value.find((j) => j.state === 'error')
      if (failed?.error) lastError.value = failed.error
      await refresh()
    } else if (!nowActive && !lastError.value) {
      // surface a recent failure even if the job finished before this page opened
      const failed = jobs.value.find(
        (j) =>
          j.state === 'error' &&
          j.error &&
          j.id !== dismissedErrorJobId.value &&
          j.createdAt != null &&
          Date.now() - new Date(j.createdAt).getTime() < 30 * 60 * 1000,
      )
      if (failed?.error) lastError.value = failed.error
    }
  } catch {
    // jobs endpoint unavailable (worker not connected yet) — stay silent
  }
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void pollJobs()
  timer = setInterval(() => void pollJobs(), 4000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function submitAnalyze(bookIds?: string[]) {
  submitting.value = 'analyze'
  lastError.value = null
  try {
    await postAnalyzeCharacters(props.seriesId, bookIds)
    await pollJobs()
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : 'Could not queue analysis'
  } finally {
    submitting.value = null
  }
}

async function submitGenerate(bookIds?: string[]) {
  submitting.value = 'generate'
  lastError.value = null
  try {
    await postGenerateAudiobooks(props.seriesId, bookIds)
    await pollJobs()
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : 'Could not queue audiobook generation'
  } finally {
    submitting.value = null
  }
}

async function onMerge(parentId: string, childId: string) {
  selected.value = null
  lastError.value = null
  try {
    await postMergeCharacters(props.seriesId, parentId, childId)
    await pollJobs()
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : 'Could not queue the merge'
  }
}

async function mergePair(parentId: string, childId: string) {
  lastError.value = null
  try {
    await postMergeCharacters(props.seriesId, parentId, childId)
    await pollJobs()
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : 'Could not queue the merge'
  }
}

async function dismissSuggestion(aName: string, bName: string) {
  try {
    await postDismissSuggestion(props.seriesId, aName, bName)
    await refresh()
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : 'Could not dismiss the suggestion'
  }
}
</script>
