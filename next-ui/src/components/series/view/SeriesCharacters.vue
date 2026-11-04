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
      class="mb-2"
      :text="lastError"
    />

    <div class="d-flex flex-wrap ga-2 mb-2">
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:account-search"
        :disabled="!canAnalyze || submitting"
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
      <v-btn
        size="small"
        variant="text"
        :prepend-icon="showBooks ? 'i-mdi:chevron-up' : 'i-mdi:chevron-down'"
        @click="showBooks = !showBooks"
      >
        Book states
      </v-btn>
    </div>

    <v-expand-transition>
      <div v-if="showBooks && info">
        <div class="d-flex flex-wrap ga-2 mb-2">
          <v-btn
            size="x-small"
            variant="tonal"
            :disabled="selectedBooks.length === 0"
            @click="mark({ reprocessCharacters: true })"
          >
            Mark character reprocessing ({{ selectedBooks.length }})
          </v-btn>
          <v-btn
            size="x-small"
            variant="tonal"
            :disabled="selectedBooks.length === 0"
            @click="mark({ reprocessAudiobook: true })"
          >
            Mark audiobook reprocessing ({{ selectedBooks.length }})
          </v-btn>
          <v-btn
            size="x-small"
            variant="text"
            :disabled="selectedBooks.length === 0"
            @click="mark({ reprocessCharacters: false, reprocessAudiobook: false })"
          >
            Clear marks
          </v-btn>
        </div>
        <v-list
          density="compact"
          class="py-0 bg-transparent mb-2"
        >
          <v-list-item
            v-for="book in info.books"
            :key="book.file"
          >
            <template #prepend>
              <v-checkbox-btn
                :model-value="book.bookId ? selectedBooks.includes(book.bookId) : false"
                :disabled="!book.bookId"
                @update:model-value="(v: boolean) => toggleBook(book.bookId, v)"
              />
            </template>
            <v-list-item-title>Book {{ book.number }} — {{ book.file }}</v-list-item-title>
            <v-list-item-subtitle>
              <span v-if="book.castState === 'READY'">Characters ready</span>
              <span v-else>Needs analysis</span>
              <span v-if="book.hasAudiobook"> · Audiobook ✓</span>
              <span v-if="book.reprocessCharacters"> · Marked: characters</span>
              <span v-if="book.reprocessAudiobook"> · Marked: audiobook</span>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>
    </v-expand-transition>

    <template v-if="info?.available">
      <v-list
        density="compact"
        class="py-0 bg-transparent"
      >
        <v-list-item
          v-if="info.narrator"
          title="Narrator"
          :subtitle="`voiced by ${info.narrator.voice}`"
        >
          <template #append>
            <v-chip
              size="x-small"
              rounded
              label
              :color="info.narrator.voiceType === 'custom' ? 'primary' : undefined"
              :text="info.narrator.voiceType === 'custom' ? 'Custom voice' : 'Standard voice'"
            />
          </template>
        </v-list-item>

        <v-list-item
          v-for="character in info.characters"
          :key="character.id"
          :title="character.name"
          :subtitle="characterSubtitle(character)"
          :class="character.status === 'merged' ? 'text-medium-emphasis' : undefined"
          @click="selected = character"
        >
          <template #append>
            <div class="d-flex align-center ga-2">
              <span class="text-body-small text-medium-emphasis">
                {{ character.totalLines }} {{ character.totalLines === 1 ? 'line' : 'lines' }}
              </span>
              <v-chip
                size="x-small"
                rounded
                label
                :color="character.voiceType === 'custom' ? 'primary' : undefined"
                :text="character.voiceType === 'custom' ? 'Custom voice' : 'Standard voice'"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>

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
  postGenerateAudiobooks,
} from '@/api/series-characters'
import type { CharacterJob, SeriesCharacter } from '@/functions/series-characters'

const props = defineProps<{
  seriesId: string
}>()

const queryCache = useQueryCache()
const { data: info } = useQuery(() => ({
  ...seriesCharactersQuery({ seriesId: props.seriesId }),
}))

const selected = ref<SeriesCharacter | null>(null)
const showBooks = ref(false)
const selectedBooks = ref<string[]>([])
const submitting = ref<string | null>(null)
const lastError = ref<string | null>(null)
const jobs = ref<CharacterJob[]>([])

const activeJob = computed(() =>
  jobs.value.find((j) => j.state === 'queued' || j.state === 'running'),
)

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

function characterSubtitle(character: SeriesCharacter): string {
  const parts = [`voiced by ${character.voice}`]
  if (character.status === 'merged') parts.push('merged into another character')
  else if (character.description) parts.push(character.description)
  return parts.join(' — ')
}

function toggleBook(bookId: string | null | undefined, on: boolean) {
  if (!bookId) return
  selectedBooks.value = on
    ? [...selectedBooks.value, bookId]
    : selectedBooks.value.filter((id) => id !== bookId)
}

async function refresh() {
  await queryCache.invalidateQueries({ key: QUERY_KEYS_SERIES_CHARACTERS.bySeriesId(props.seriesId) })
}

async function pollJobs() {
  try {
    const before = jobs.value
    jobs.value = await fetchCharacterJobs(props.seriesId)
    const wasActive = before.some((j) => j.state === 'queued' || j.state === 'running')
    const nowActive = jobs.value.some((j) => j.state === 'queued' || j.state === 'running')
    if (wasActive && !nowActive) {
      const failed = jobs.value.find((j) => j.state === 'error')
      if (failed?.error) lastError.value = failed.error
      await refresh()
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

async function mark(marks: { reprocessCharacters?: boolean; reprocessAudiobook?: boolean }) {
  try {
    await postCharacterMarks(props.seriesId, selectedBooks.value, marks)
    await refresh()
  } catch (e) {
    lastError.value = e instanceof Error ? e.message : 'Could not update marks'
  }
}
</script>
