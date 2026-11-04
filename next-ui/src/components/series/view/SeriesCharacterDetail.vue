<template>
  <v-card>
    <v-card-title class="d-flex align-center ga-2">
      <span>{{ character.name }}</span>
      <v-chip
        size="x-small"
        rounded
        label
        :color="character.voiceType === 'custom' ? 'primary' : undefined"
        :text="character.voiceType === 'custom' ? 'Custom voice' : 'Standard voice'"
      />
      <v-chip
        v-if="character.status === 'merged'"
        size="x-small"
        rounded
        label
        color="warning"
        :text="`Merged into ${mergedIntoName ?? character.mergedInto}`"
      />
    </v-card-title>

    <v-card-text>
      <div class="text-body-medium mb-1">
        Voiced by <strong>{{ character.voice }}</strong>
        <span v-if="character.firstBook != null" class="text-medium-emphasis">
          · first speaks in book {{ character.firstBook }}
        </span>
        <span class="text-medium-emphasis">
          · {{ character.totalLines }} {{ character.totalLines === 1 ? 'line' : 'lines' }} across
          {{ character.books.length }} {{ character.books.length === 1 ? 'book' : 'books' }}
        </span>
      </div>

      <p v-if="character.description" class="text-body-medium my-3">
        {{ character.description }}
      </p>

      <div v-if="character.aliases.length > 0" class="mb-3">
        <div class="text-label-medium text-medium-emphasis mb-1">Also known as</div>
        <div class="d-flex flex-wrap ga-1">
          <v-chip
            v-for="alias in character.aliases"
            :key="alias"
            size="small"
            rounded
            label
            :text="alias"
          />
        </div>
      </div>

      <div v-if="traitRows.length > 0" class="mb-3">
        <div class="text-label-medium text-medium-emphasis mb-1">Traits</div>
        <div
          v-for="row in traitRows"
          :key="row.key"
          class="text-body-medium"
        >
          <span class="text-medium-emphasis">{{ row.key }}:</span> {{ row.value }}
        </div>
      </div>

      <div v-if="character.sampleLines.length > 0" class="mb-3">
        <div class="text-label-medium text-medium-emphasis mb-1">Sample lines</div>
        <div
          v-for="(line, i) in character.sampleLines"
          :key="i"
          class="text-body-medium font-italic mb-1"
        >
          “{{ line }}”
        </div>
      </div>

      <div v-if="character.books.length > 0">
        <div class="text-label-medium text-medium-emphasis mb-1">Dialogue by book</div>
        <v-list
          density="compact"
          class="py-0 bg-transparent"
        >
          <v-list-item
            v-for="b in character.books"
            :key="b.number ?? 0"
            :title="`Book ${b.number}`"
            :subtitle="`${b.lines} ${b.lines === 1 ? 'line' : 'lines'}`"
            :to="b.bookId ? { name: '/book/[id]', params: { id: b.bookId } } : undefined"
          >
            <div
              v-for="(ev, i) in b.evidence ?? []"
              :key="i"
              class="text-body-small text-medium-emphasis font-italic"
            >
              {{ ev }}
            </div>
          </v-list-item>
        </v-list>
      </div>
    </v-card-text>

    <v-card-text v-if="character.status !== 'merged'">
      <div class="d-flex align-center ga-1 mb-1">
        <span class="text-label-medium text-medium-emphasis">Parent character</span>
        <v-tooltip
          location="top"
          text="Same person as another character? Pick that character as the parent — this one becomes its alias, its lines move over, and affected audiobooks are marked for re-rendering."
        >
          <template #activator="{ props: tipProps }">
            <v-icon
              v-bind="tipProps"
              icon="i-mdi:information-outline"
              size="small"
              class="text-medium-emphasis"
            />
          </template>
        </v-tooltip>
      </div>
      <v-select
        v-model="mergeParentId"
        :items="mergeCandidates"
        item-title="name"
        item-value="id"
        label="Parent character"
        density="compact"
        clearable
      />
      <v-alert
        v-if="mergeParentId"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-2"
      >
        Merge {{ character.name }} into
        {{ allCharacters.find((c) => c.id === mergeParentId)?.name }}? This affects
        {{ character.books.length }} {{ character.books.length === 1 ? 'book' : 'books' }} where
        {{ character.name }} speaks.
      </v-alert>
    </v-card-text>

    <v-card-actions>
      <v-btn
        v-if="character.status !== 'merged'"
        color="warning"
        variant="tonal"
        :disabled="!mergeParentId"
        text="Merge into parent"
        @click="$emit('merge', mergeParentId!, character.id)"
      />
      <v-spacer />
      <v-btn
        variant="text"
        text="Close"
        @click="$emit('close')"
      />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import type { SeriesCharacter } from '@/functions/series-characters'

const props = defineProps<{
  character: SeriesCharacter
  allCharacters: SeriesCharacter[]
}>()

defineEmits<{
  close: []
  merge: [parentId: string, childId: string]
}>()

const mergeParentId = ref<string | null>(null)
const mergeCandidates = computed(() =>
  props.allCharacters.filter((c) => c.id !== props.character.id && c.status !== 'merged'),
)

const mergedIntoName = computed(
  () => props.allCharacters.find((c) => c.id === props.character.mergedInto)?.name,
)

const traitRows = computed(() =>
  Object.entries(props.character.traits)
    .filter(([, v]) => v)
    .map(([key, value]) => ({ key, value: value as string })),
)
</script>
