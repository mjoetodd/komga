<template>
  <v-app-bar>
    <template #prepend>
      <v-btn
        icon="i-mdi:arrow-left"
        title="Back to book"
        @click="goToBook"
      />
    </template>
    <v-app-bar-title>
      Listen<template v-if="book"> · {{ book.metadata.title || book.name }}</template>
    </v-app-bar-title>
  </v-app-bar>

  <v-container
    fluid
    class="pa-0 pa-sm-4"
  >
    <div
      v-if="isPending"
      class="pa-4 pa-sm-0"
    >
      <v-skeleton-loader type="article" />
    </div>

    <EmptyStateNetworkError v-else-if="bookError" />

    <v-card
      v-else-if="book && noAudiobook"
      class="ma-4 ma-sm-0 pa-6 text-center"
      variant="tonal"
    >
      <v-icon
        icon="i-mdi:headphones-off"
        size="48"
        class="mb-3"
      />
      <div class="text-h6 mb-1">No audiobook for this book yet</div>
      <div class="text-body-2 text-medium-emphasis">
        This book doesn't have a prebuilt audiobook. Books with one show a Listen button on their
        page.
      </div>
    </v-card>

    <div
      v-else-if="book && audiobook"
      class="pa-4 pa-sm-0"
    >
      <AudiobookPlayer
        :book="book"
        :audiobook="audiobook"
      />
    </div>
  </v-container>
</template>

<script lang="ts" setup>
import { useQuery } from '@pinia/colada'
import { audiobookQuery } from '@/colada/audiobooks'
import { bookDetailQuery } from '@/colada/books'
import { isApiErrorWithCause } from '@/api/komga-client'
import AudiobookPlayer from '@/components/book/AudiobookPlayer.vue'
import EmptyStateNetworkError from '@/components/EmptyStateNetworkError.vue'

const route = useRoute('/book/[id]/listen')
const router = useRouter()
const bookId = computed(() => route.params.id)

const {
  data: book,
  error: bookError,
  isPending,
} = useQuery(() => ({
  ...bookDetailQuery({ bookId: bookId.value }),
}))

const { data: audiobook, error: audiobookError } = useQuery(() => ({
  ...audiobookQuery({ bookId: bookId.value }),
  enabled: book.value !== undefined,
}))

// a 404 from the audiobook endpoint means the book simply has none
const noAudiobook = computed(
  () =>
    (isApiErrorWithCause(audiobookError.value) && audiobookError.value.cause.status === 404) ||
    (audiobook.value !== undefined && !audiobook.value.available),
)

function goToBook() {
  void router.push({ name: '/book/[id]', params: { id: bookId.value } })
}
</script>
