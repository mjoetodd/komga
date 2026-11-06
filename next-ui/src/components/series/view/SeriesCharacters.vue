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

    <div class="d-flex flex-wrap align-center ga-2 mb-2">
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:account-search"
        :disabled="!!analyzeJob || (!canAnalyze && !analyzeJob) || submitting != null"
        :loading="submitting === 'analyze'"
        @click="submitAnalyze()"
      >
        {{ analyzeJob ? jobButtonText(analyzeJob) : analyzeLabel }}
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:headphones"
        :disabled="!!generateJob || !info?.canGenerateAllAudiobooks || submitting != null"
        :loading="submitting === 'generate'"
        @click="submitGenerate()"
      >
        {{ generateJob ? jobButtonText(generateJob) : 'Generate all audiobooks' }}
      </v-btn>
      <v-chip
        v-if="mergeJob"
        size="small"
        rounded
        label
        color="info"
        :text="mergeJob.state === 'queued' ? 'Merge — In Queue' : `Merging — ${jobPhaseLabel(mergeJob.phase)}`"
      />
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
          @open="openRelated"
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
import {
  displayJobError,
  jobButtonText,
  jobPhaseLabel,
  type CharacterJob,
  type SeriesCharacter,
} from '@/functions/series-characters'
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

const activeJob = computed(() =>
  jobs.value.find((j) => j.state === 'queued' || j.state === 'running'),
)

// The buttons ARE the status display: each shows its own job's live state,
// derived from the jobs endpoint on every poll — including after a refresh.
const analyzeJob = computed(() =>
  jobs.value.find(
    (j) => j.type === 'analyze_series' && (j.state === 'queued' || j.state === 'running'),
  ),
)
const generateJob = computed(() =>
  jobs.value.find(
    (j) => j.type === 'generate_audiobooks' && (j.state === 'queued' || j.state === 'running'),
  ),
)
const mergeJob = computed(() =>
  jobs.value.find(
    (j) => j.type === 'merge_characters' && (j.state === 'queued' || j.state === 'running'),
  ),
)

const markedCount = computed(
  () => info.value?.books.filter((b) => b.reprocessCharacters).length ?? 0,
)

const canAnalyze = computed(() => {
  if (!info.value || submitting.value) return false
  return info.value.needsAnalysisCount > 0 || markedCount.value > 0
})

const analyzeLabel = computed(() => {
  if (info.value && info.value.castReadyCount === 0 && markedCount.value === 0)
    return 'Analyze characters'
  if (markedCount.value > 0) return `Analyze (${markedCount.value} marked + new)`
  return 'Analyze new books'
})

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
  const failed = displayJobError(jobs.value)
  if (failed) dismissedErrorJobId.value = failed.id
  lastError.value = null
}

async function pollJobs() {
  try {
    const before = jobs.value
    jobs.value = await fetchCharacterJobs(props.seriesId)
    const wasActive = before.some((j) => j.state === 'queued' || j.state === 'running')
    const nowActive = jobs.value.some((j) => j.state === 'queued' || j.state === 'running')
    if (wasActive && !nowActive) {
      const failed = displayJobError(jobs.value)
      if (failed?.error) lastError.value = failed.error
      await refresh()
    } else if (!nowActive && !lastError.value) {
      // surface a recent failure even if the job finished before this page opened
      const failed = displayJobError(jobs.value)
      if (
        failed?.error &&
        failed.id !== dismissedErrorJobId.value &&
        failed.createdAt != null &&
        Date.now() - new Date(failed.createdAt).getTime() < 30 * 60 * 1000
      ) {
        lastError.value = failed.error
      }
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

function openRelated(characterId: string) {
  const target = info.value?.characters.find((c) => c.id === characterId)
  if (target) selected.value = target
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
