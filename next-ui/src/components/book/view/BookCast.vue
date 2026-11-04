<template>
  <div v-if="castInfo">
    <div class="text-title-medium d-flex align-center ga-2 mb-2">
      <v-icon icon="i-mdi:account-voice" />
      Audiobook cast
    </div>

    <v-list
      density="compact"
      class="py-0 bg-transparent"
    >
      <v-list-item
        v-if="castInfo.narrator"
        :title="'Narrator'"
        :subtitle="`voiced by ${castInfo.narrator.voice}`"
      >
        <template #append>
          <v-chip
            size="x-small"
            rounded
            label
            :color="castInfo.narrator.voiceType === 'custom' ? 'primary' : undefined"
            :text="castInfo.narrator.voiceType === 'custom' ? 'Custom voice' : 'Standard voice'"
          />
        </template>
      </v-list-item>

      <v-list-item
        v-for="member in castInfo.cast"
        :key="member.id"
        :title="member.name"
        :subtitle="memberSubtitle(member)"
        @click="openCharacter(member.id)"
      >
        <template #append>
          <div class="d-flex align-center ga-2">
            <span class="text-body-small text-medium-emphasis">
              {{ member.dialogueSegments }} {{ member.dialogueSegments === 1 ? 'line' : 'lines' }}
            </span>
            <v-chip
              size="x-small"
              rounded
              label
              :color="member.voiceType === 'custom' ? 'primary' : undefined"
              :text="member.voiceType === 'custom' ? 'Custom voice' : 'Standard voice'"
            />
          </div>
        </template>
      </v-list-item>
    </v-list>

    <v-dialog
      :model-value="selectedCharacter != null"
      max-width="640"
      @update:model-value="(v: boolean) => { if (!v) wantedCharacterId = null }"
    >
      <SeriesViewSeriesCharacterDetail
        v-if="selectedCharacter && seriesInfo"
        :character="selectedCharacter"
        :all-characters="seriesInfo.characters"
        @close="wantedCharacterId = null"
        @merge="onMerge"
        @open="(id: string) => { wantedCharacterId = id }"
      />
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { castQuery } from '@/colada/cast'
import { seriesCharactersQuery } from '@/colada/series-characters'
import { postMergeCharacters } from '@/api/series-characters'
import type { CastMember } from '@/functions/cast'
import type { SeriesCharacter } from '@/functions/series-characters'

const props = defineProps<{
  bookId: string
  seriesId: string
}>()

const { data: castInfo } = useQuery(() => ({
  ...castQuery({ bookId: props.bookId }),
}))

const wantedCharacterId = ref<string | null>(null)
const { data: seriesInfo } = useQuery(() => ({
  ...seriesCharactersQuery({ seriesId: props.seriesId }),
  enabled: wantedCharacterId.value != null,
}))

const selectedCharacter = computed<SeriesCharacter | null>(() => {
  if (!wantedCharacterId.value || !seriesInfo.value) return null
  return seriesInfo.value.characters.find((c) => c.id === wantedCharacterId.value) ?? null
})

function openCharacter(id: string) {
  wantedCharacterId.value = id
}

async function onMerge(parentId: string, childId: string) {
  wantedCharacterId.value = null
  try {
    await postMergeCharacters(props.seriesId, parentId, childId)
  } catch {
    // merge failures surface on the series page; the cast card stays quiet
  }
}

function memberSubtitle(member: CastMember): string {
  const parts = [`voiced by ${member.voice}`]
  if (member.description) parts.push(member.description)
  return parts.join(' — ')
}
</script>
