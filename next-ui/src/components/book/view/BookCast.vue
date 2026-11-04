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
  </div>
</template>

<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { castQuery } from '@/colada/cast'
import type { CastMember } from '@/functions/cast'

const props = defineProps<{
  bookId: string
}>()

const { data: castInfo } = useQuery(() => ({
  ...castQuery({ bookId: props.bookId }),
}))

function memberSubtitle(member: CastMember): string {
  const parts = [`voiced by ${member.voice}`]
  if (member.description) parts.push(member.description)
  return parts.join(' — ')
}
</script>
