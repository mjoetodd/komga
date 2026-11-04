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
        :disabled="busy != null"
        @click="analyze"
      >
        {{ state.castState === 'READY' ? 'Re-analyze book' : 'Analyze book' }}
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="i-mdi:headphones"
        :loading="busy === 'generate'"
        :disabled="busy != null || state.castState !== 'READY'"
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
  postAnalyzeCharacters,
  postCharacterMarks,
  postGenerateAudiobooks,
} from '@/api/series-characters'

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

async function refresh() {
  await queryCache.invalidateQueries({
    key: QUERY_KEYS_SERIES_CHARACTERS.bySeriesId(props.seriesId),
  })
}

async function analyze() {
  busy.value = 'analyze'
  error.value = null
  try {
    await postAnalyzeCharacters(props.seriesId, [props.bookId])
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
