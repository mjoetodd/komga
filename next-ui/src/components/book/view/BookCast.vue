<template>
  <div v-if="castInfo">
    <div class="text-title-medium d-flex align-center ga-2 mb-2">
      <v-icon icon="i-mdi:account-voice" />
      Audiobook cast
    </div>

    <div class="d-flex flex-wrap ga-1">
      <v-chip
        v-if="castInfo.narrator"
        rounded
        label
        :color="castInfo.narrator.voiceType === 'custom' ? 'primary' : undefined"
        :variant="castInfo.narrator.voiceType === 'custom' ? 'outlined' : undefined"
        :title="`Narrator — voiced by ${castInfo.narrator.voice}`"
        text="Narrator"
      />
      <v-chip
        v-for="member in castInfo.cast"
        :key="member.id"
        rounded
        label
        clickable
        :color="member.voiceType === 'custom' ? 'primary' : undefined"
        :variant="member.voiceType === 'custom' ? 'outlined' : undefined"
        :title="`${member.name} — ${memberSubtitle(member)} · ${member.dialogueSegments} ${member.dialogueSegments === 1 ? 'line' : 'lines'} in this book`"
        :text="member.name"
        @click="openCharacter(member.id)"
      />
    </div>

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
