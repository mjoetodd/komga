<template>
  <v-container
    v-if="info?.available"
    fluid
  >
    <div class="text-title-medium d-flex align-center ga-2 mb-1">
      <v-icon icon="i-mdi:account-group" />
      Characters
      <v-chip
        v-if="info.suggestions.length > 0"
        size="x-small"
        rounded
        label
        color="warning"
        :text="`${info.suggestions.length} possible ${info.suggestions.length === 1 ? 'duplicate' : 'duplicates'}`"
      />
    </div>

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
      <SeriesCharacterDetail
        v-if="selected"
        :character="selected"
        :all-characters="info.characters"
        @close="selected = null"
      />
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { seriesCharactersQuery } from '@/colada/series-characters'
import type { SeriesCharacter } from '@/functions/series-characters'
import SeriesCharacterDetail from './SeriesCharacterDetail.vue'

const props = defineProps<{
  seriesId: string
}>()

const { data: info } = useQuery(() => ({
  ...seriesCharactersQuery({ seriesId: props.seriesId }),
}))

const selected = ref<SeriesCharacter | null>(null)

function characterSubtitle(character: SeriesCharacter): string {
  const parts = [`voiced by ${character.voice}`]
  if (character.status === 'merged') parts.push('merged into another character')
  else if (character.description) parts.push(character.description)
  return parts.join(' — ')
}
</script>
