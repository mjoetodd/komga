<template>
  <div v-if="!$_.isEmpty(book)">
    <toolbar-sticky>
      <v-tooltip bottom :disabled="!isAdmin">
        <template v-slot:activator="{ on }">
          <v-btn icon
                 v-on="on"
                 :to="parentLocation"
          >
            <rtl-icon icon="mdi-arrow-left" rtl="mdi-arrow-right"/>
          </v-btn>
        </template>
        <span v-if="contextReadList">{{ $t('common.go_to_readlist') }}</span>
        <span v-else>{{ $t('common.go_to_series') }}</span>
      </v-tooltip>

      <!--   Action menu   -->
      <book-actions-menu v-if="book"
                         :book="book"
      />

      <v-btn icon @click="editBook" v-if="isAdmin">
        <v-icon>mdi-pencil</v-icon>
      </v-btn>

      <v-spacer/>

      <!--   Context notification for navigation   -->
      <v-alert
        v-if="contextReadList && $vuetify.breakpoint.mdAndUp"
        type="info"
        text
        dense
        border="right"
        class="mb-0"
      >{{ $t('browse_book.navigation_within_readlist', {name: contextName}) }}
      </v-alert>

      <!--   Navigate to previous book   -->
      <v-btn
        icon
        :disabled="$_.isEmpty(siblingPrevious)"
        :to="{ name: siblingPrevious.oneshot ? 'browse-oneshot' : 'browse-book', params: { seriesId: siblingPrevious.seriesId, bookId: previousId }, query: { context: context.origin, contextId: context.id}  }"
      >
        <rtl-icon icon="mdi-chevron-left" rtl="mdi-chevron-right"/>
      </v-btn>

      <!--   List of all books in context (series/readlist) for navigation   -->
      <v-menu bottom
              offset-y
              :max-height="$vuetify.breakpoint.height * .7"
              :max-width="250"
      >
        <template v-slot:activator="{ on }">
          <v-btn icon v-on="on">
            <v-icon>mdi-menu</v-icon>
          </v-btn>
        </template>

        <v-list
          flat
        >
          <v-list-item-group color="primary">
            <v-list-item
              v-for="(book, i) in siblings"
              :key="i"
              :to="{ name: book.oneshot ? 'browse-oneshot' : 'browse-book', params: { seriesId: book.seriesId, bookId: book.id }, query: { context: context.origin, contextId: context.id}  }"
            >
              <v-list-item-title class="text-wrap text-body-2">
                <template v-if="contextReadList && !book.oneshot">{{ book.seriesTitle }} {{ book.metadata.number }}:
                  {{ book.metadata.title }}
                </template>
                <template v-else-if="contextReadList && book.oneshot">{{ book.metadata.title }}</template>
                <template v-else>{{ book.metadata.number }} - {{ book.metadata.title }}</template>
              </v-list-item-title>
            </v-list-item>
          </v-list-item-group>
        </v-list>
      </v-menu>

      <!--   Navigate to next book   -->
      <v-btn
        icon
        :disabled="$_.isEmpty(siblingNext)"
        :to="{ name: siblingNext.oneshot ? 'browse-oneshot' : 'browse-book', params: { seriesId: siblingNext.seriesId, bookId: nextId }, query: { context: context.origin, contextId: context.id}  }"
      >
        <rtl-icon icon="mdi-chevron-right" rtl="mdi-chevron-left"/>
      </v-btn>
    </toolbar-sticky>

    <v-container fluid class="pa-6">
      <!--   Context notification for navigation   -->
      <v-row>
        <v-alert
          v-if="contextReadList && $vuetify.breakpoint.smAndDown"
          type="info"
          text
          dense
          border="right"
          class="mb-0"
        >{{ $t('browse_book.navigation_within_readlist', {name: contextName}) }}
        </v-alert>
      </v-row>

      <v-row>
        <v-col cols="4" sm="4" md="auto" lg="auto" xl="auto">
          <item-card
            v-if="book.hasOwnProperty('id')"
            width="212"
            :item="book"
            thumbnail-only
            no-link
            :action-menu="false"
          ></item-card>
          <div v-if="isInProgress"
               class="text-caption text-center mt-1"
               :title="$t('common.read_on', {date: readProgressDate})"
          >
            {{ $tc('common.pages_left', pagesLeft) }}
          </div>
          <div v-else-if="isRead"
               class="text-caption text-center mt-1"
          >
            {{ $t('common.read_on', {date: readProgressDate}) }}
          </div>
        </v-col>

        <v-col cols="8">
          <v-container>
            <v-row>
              <v-col class="py-1">
                <router-link
                  :to="{name:'browse-series', params: {seriesId: book.seriesId}}"
                  class="link-underline text-h5"
                >{{ book.seriesTitle }}
                </router-link>
                <router-link
                  class="caption link-underline"
                  :class="$vuetify.breakpoint.smAndUp ? 'mx-1' : ''"
                  :style="$vuetify.breakpoint.xsOnly ? 'display: block' : ''"
                  :to="{name:'browse-libraries', params: {libraryId: book.libraryId }}"
                >{{ $t('searchbox.in_library', {library: getLibraryName(book)}) }}
                </router-link>
              </v-col>
            </v-row>
            <v-row>
              <v-col class="py-1">
                <div class="text-h6">{{ book.metadata.title }}</div>
              </v-col>
            </v-row>

            <v-row class="text-caption" align="center">
              <v-col cols="auto" v-if="book.media.status === MediaStatus.UNKNOWN">
                {{ book.metadata.number }} · {{ $t('book_card.unknown') }}
              </v-col>

              <v-col cols="auto" v-else>
                {{ book.metadata.number }} · {{ $tc('common.pages_n', book.media.pagesCount) }}
              </v-col>

              <v-col cols="auto" v-if="book.metadata.releaseDate">
                {{
                  new Intl.DateTimeFormat($i18n.locale, {
                    dateStyle: 'long',
                    timeZone: 'UTC'
                  }).format(new Date(book.metadata.releaseDate))
                }}
              </v-col>

              <v-col class="py-1 pe-0"
                     cols="auto"
                     v-if="book.media.status === MediaStatus.OUTDATED">
                <v-tooltip bottom :disabled="!isAdmin">
                  <template v-slot:activator="{ on }">
                    <v-chip label small color="warning" v-on="on">
                      {{ $t('common.outdated') }}
                    </v-chip>
                  </template>
                  {{ $t('browse_book.outdated_tooltip') }}
                </v-tooltip>
              </v-col>

              <v-col class="py-1 pe-0" cols="auto" v-if="unavailable">
                <v-chip label small color="error">
                  {{ $t('common.unavailable') }}
                </v-chip>
              </v-col>

              <v-col class="py-1 pe-0" cols="auto" v-if="book.audiobook">
                <v-chip label small color="primary" title="A prebuilt audiobook is available for this book — open it in the reader and press Listen">
                  <v-icon left small>mdi-headphones</v-icon>
                  Audiobook available
                </v-chip>
              </v-col>
            </v-row>


            <template v-if="$vuetify.breakpoint.smAndUp">
              <v-row class="align-center">
                <v-col cols="auto">
                  <v-btn color="accent"
                         small
                         :title="$t('browse_book.read_book')"
                         :to="{name: readRouteName, params: { bookId: bookId}, query: { context: context.origin, contextId: context.id}}"
                         :disabled="!canRead"
                  >
                    <v-icon left small>mdi-book-open-page-variant</v-icon>
                    {{ $t('common.read') }}
                  </v-btn>
                </v-col>

                <v-col cols="auto" v-if="book.audiobook">
                  <v-btn color="primary"
                         small
                         title="Listen to the audiobook"
                         :href="`/next/listen/${bookId}`"
                  >
                    <v-icon left small>mdi-headphones</v-icon>
                    Listen
                  </v-btn>
                </v-col>

                <v-col cols="auto">
                  <v-btn small
                         :title="$t('browse_book.read_incognito')"
                         :to="{name: readRouteName, params: { bookId: bookId}, query: { context: context.origin, contextId: context.id, incognito: true}}"
                         :disabled="!canRead"
                  >
                    <v-icon left small>mdi-incognito</v-icon>
                    {{ $t('common.read') }}
                  </v-btn>
                </v-col>

                <v-col cols="auto">
                  <v-btn :title="$t('browse_book.download_file')"
                         small
                         :disabled="!canDownload"
                         :href="fileUrl">
                    <v-icon left small>mdi-file-download</v-icon>
                    {{ $t('common.download') }}
                  </v-btn>
                </v-col>
              </v-row>

              <v-row v-if="book.metadata.summary">
                <v-col>
                  <read-more v-model="readMore">{{ book.metadata.summary }}</read-more>
                </v-col>
              </v-row>
            </template>
          </v-container>
        </v-col>
      </v-row>

      <template v-if="$vuetify.breakpoint.xsOnly">
        <v-row class="align-center">
          <v-col cols="auto">
            <v-btn color="accent"
                   small
                   :title="$t('browse_book.read_book')"
                   :to="{name: readRouteName, params: { bookId: bookId}, query: { context: context.origin, contextId: context.id}}"
                   :disabled="!canRead"
            >
              <v-icon left small>mdi-book-open-page-variant</v-icon>
              {{ $t('common.read') }}
            </v-btn>
          </v-col>

          <v-col cols="auto" v-if="book.audiobook">
            <v-btn color="primary"
                   small
                   title="Listen to the audiobook"
                   :href="`/next/listen/${bookId}`"
            >
              <v-icon left small>mdi-headphones</v-icon>
              Listen
            </v-btn>
          </v-col>

          <v-col cols="auto">
            <v-btn small
                   :title="$t('browse_book.read_incognito')"
                   :to="{name: readRouteName, params: { bookId: bookId}, query: { context: context.origin, contextId: context.id, incognito: true}}"
                   :disabled="!canRead"
            >
              <v-icon left small>mdi-incognito</v-icon>
              {{ $t('common.read') }}
            </v-btn>
          </v-col>

          <v-col cols="auto">
            <v-btn :title="$t('browse_book.download_file')"
                   small
                   :disabled="!canDownload"
                   :href="fileUrl">
              <v-icon left small>mdi-file-download</v-icon>
              {{ $t('common.download') }}
            </v-btn>
          </v-col>
        </v-row>

        <v-row v-if="book.metadata.summary">
          <v-col>
            <read-more v-model="readMore">{{ book.metadata.summary }}</read-more>
          </v-col>
        </v-row>
      </template>

      <v-row v-for="role in displayedRoles"
             :key="role"
             class="align-center text-caption"
      >
        <v-col cols="4" sm="3" md="2" xl="1" class="py-1 text-uppercase">
          {{ $te(`author_roles.${role}`) ? $t(`author_roles.${role}`) : role }}
        </v-col>
        <v-col cols="8" sm="9" md="10" xl="11" class="py-1">
          <vue-horizontal>
            <template v-slot:btn-prev>
              <v-btn icon small>
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
            </template>

            <template v-slot:btn-next>
              <v-btn icon small>
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </template>
            <v-chip v-for="(name, i) in authorsByRole[role]"
                    :key="i"
                    class="me-2"
                    :title="name"
                    :to="{name:'browse-series', params: {seriesId: book.seriesId }, query: {[role]: [name]}}"
                    label
                    small
                    outlined
                    link
            >{{ name }}
            </v-chip>
          </vue-horizontal>
        </v-col>
      </v-row>

      <v-row v-if="castInfo" class="text-caption">
        <v-col cols="4" sm="3" md="2" xl="1" class="py-1 text-uppercase">Audiobook cast</v-col>
        <v-col cols="8" sm="9" md="10" xl="11" class="py-1">
          <div v-if="castInfo.narrator" class="py-1">
            Narrator — voiced by {{ castInfo.narrator.voice }}
            <v-chip label x-small outlined :color="castInfo.narrator.voiceType === 'custom' ? 'primary' : undefined">{{ castInfo.narrator.voiceType === 'custom' ? 'Custom voice' : 'Standard voice' }}</v-chip>
          </div>
          <div v-for="member in castInfo.cast" :key="member.id" class="py-1">
            <a href="#" @click.prevent="openBookCharacter(member.id)">{{ member.name }}</a> — voiced by {{ member.voice }}<span v-if="member.description"> — {{ member.description }}</span>
            · {{ member.dialogueSegments }} {{ member.dialogueSegments === 1 ? 'line' : 'lines' }}
            <v-chip label x-small outlined :color="member.voiceType === 'custom' ? 'primary' : undefined">{{ member.voiceType === 'custom' ? 'Custom voice' : 'Standard voice' }}</v-chip>
          </div>
        </v-col>
      </v-row>

      <v-row v-if="bookCharState" class="text-caption">
        <v-col cols="4" sm="3" md="2" xl="1" class="py-1 text-uppercase">Characters &amp; audiobook</v-col>
        <v-col cols="8" sm="9" md="10" xl="11" class="py-1">
          <v-chip label small outlined :color="bookCharState.castState === 'READY' ? 'success' : 'warning'">{{ bookCharState.castState === 'READY' ? 'Characters ready' : 'Character analysis needed' }}</v-chip>
          <v-chip v-if="bookCharState.hasAudiobook" label small outlined color="success">Audiobook ready</v-chip>
          <v-chip v-if="bookCharState.reprocessCharacters" label small outlined color="info">Marked: re-analyze</v-chip>
          <v-chip v-if="bookCharState.reprocessAudiobook" label small outlined color="info">Marked: re-render</v-chip>
          <div class="py-1 mt-1">
            <v-btn small class="me-2" :disabled="bookCharBusy" @click="bookCharPost('analyze')">{{ bookCharState.castState === 'READY' ? 'Re-analyze book' : 'Analyze book' }}</v-btn>
            <v-btn small class="me-2" :disabled="bookCharBusy || bookCharState.castState !== 'READY'" @click="bookCharPost('generate-audiobooks')">{{ bookCharState.hasAudiobook ? 'Regenerate audiobook' : 'Generate audiobook' }}</v-btn>
            <v-btn small text :disabled="bookCharBusy" @click="bookCharMark('reprocessCharacters', !bookCharState.reprocessCharacters)">{{ bookCharState.reprocessCharacters ? 'Unmark re-analyze' : 'Mark for re-analysis' }}</v-btn>
            <v-btn small text :disabled="bookCharBusy" @click="bookCharMark('reprocessAudiobook', !bookCharState.reprocessAudiobook)">{{ bookCharState.reprocessAudiobook ? 'Unmark re-render' : 'Mark for re-render' }}</v-btn>
            <span v-if="bookCharJobText" class="ms-2">{{ bookCharJobText }}</span>
            <span v-else-if="bookCharMessage" class="ms-2">{{ bookCharMessage }}</span>
          </div>
        </v-col>
      </v-row>

      <v-dialog v-model="bookCharDialog" max-width="640">
        <v-card v-if="bookCharDetail">
          <v-card-title>{{ bookCharDetail.name }}</v-card-title>
          <v-card-text>
            <div>Voiced by <strong>{{ bookCharDetail.voice }}</strong><span v-if="bookCharDetail.firstBook != null"> · first speaks in book {{ bookCharDetail.firstBook }}</span> · {{ bookCharDetail.totalLines }} lines across {{ bookCharDetail.books.length }} books</div>
            <p v-if="bookCharDetail.description" class="mt-2">{{ bookCharDetail.description }}</p>
            <div v-if="bookCharDetail.aliases && bookCharDetail.aliases.length > 0" class="mt-2">
              Also known as:
              <v-chip v-for="a in bookCharDetail.aliases" :key="a" label small class="me-1">{{ a }}</v-chip>
            </div>
            <div v-if="bookCharDetail.sampleLines && bookCharDetail.sampleLines.length > 0" class="mt-2">
              <div>Sample lines</div>
              <div v-for="(line, i) in bookCharDetail.sampleLines" :key="i" class="font-italic">“{{ line }}”</div>
            </div>
            <div v-if="bookCharDetail.books && bookCharDetail.books.length > 0" class="mt-2">
              <div>Dialogue by book</div>
              <div v-for="b in bookCharDetail.books" :key="b.number" class="py-0">
                Book {{ b.number }} — {{ b.lines }} {{ b.lines === 1 ? 'line' : 'lines' }}
                <div v-for="(ev, ei) in (b.evidence || [])" :key="ei" class="font-italic text-medium-emphasis ms-2">{{ ev }}</div>
              </div>
            </div>
            <div v-if="bookCharDetail.status !== 'merged'" class="mt-4">
              <div class="d-flex align-center">
                <span>Parent character</span>
                <v-tooltip top>
                  <template v-slot:activator="{ on }">
                    <v-icon small class="ms-1" v-on="on">mdi-information-outline</v-icon>
                  </template>
                  <span>Same person as another character? Pick the parent — this character becomes its alias and affected audiobooks are marked for re-rendering.</span>
                </v-tooltip>
              </div>
              <v-select v-model="bookCharMergeParent" :items="bookCharMergeCandidates" item-text="name" item-value="id" label="Parent character" clearable dense></v-select>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn v-if="bookCharDetail.status !== 'merged'" color="warning" text :disabled="!bookCharMergeParent || bookCharBusy" @click="bookCharMerge">Merge into parent</v-btn>
            <v-spacer></v-spacer>
            <v-btn text @click="bookCharDialog = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-row v-if="book.metadata.tags.length > 0" class="align-center text-caption">
        <v-col cols="4" sm="3" md="2" xl="1" class="py-1 text-uppercase">{{ $i18n.t('common.tags') }}</v-col>
        <v-col cols="8" sm="9" md="10" xl="11" class="py-1 text-capitalize">
          <vue-horizontal>
            <template v-slot:btn-prev>
              <v-btn icon small>
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
            </template>

            <template v-slot:btn-next>
              <v-btn icon small>
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </template>
            <v-chip v-for="(t, i) in book.metadata.tags"
                    :key="i"
                    class="me-2"
                    :title="t"
                    :to="{name:'browse-series', params: {seriesId: book.seriesId}, query: {tag: [new SearchConditionTag(new SearchOperatorIs(t))]}}"
                    label
                    small
                    outlined
                    link
            >{{ t }}
            </v-chip>
          </vue-horizontal>
        </v-col>
      </v-row>

      <v-row>
        <v-col>
          <read-lists-expansion-panels :read-lists="readLists">
            <template v-slot:prepend="props">
              <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                  <v-btn icon class="me-2" v-on="on" @click="removeFromReadList(props.readlist.id)">
                    <v-icon>mdi-book-remove</v-icon>
                  </v-btn>
                </template>
                <span>{{ $t('browse_book.remove_from_readlist') }}</span>
              </v-tooltip>
            </template>
          </read-lists-expansion-panels>
        </v-col>
      </v-row>

      <v-row v-if="book.metadata.links.length > 0" class="align-center text-caption">
        <v-col class="py-1 text-uppercase" cols="4" sm="3" md="2" xl="1">{{ $t('browse_book.links') }}</v-col>
        <v-col class="py-1" cols="8" sm="9" md="10" xl="11">
          <v-chip
            v-for="(link, i) in book.metadata.links"
            :href="link.url"
            rel="noreferrer"
            target="_blank"
            class="me-2"
            label
            small
            outlined
            link
            :key="i"
          >
            {{ link.label }}
            <v-icon
              x-small
              color="grey"
              class="ps-1"
            >
              mdi-open-in-new
            </v-icon>
          </v-chip>
        </v-col>
      </v-row>

      <v-row class="align-center text-caption">
        <v-col class="py-1 text-uppercase" cols="4" sm="3" md="2" xl="1">{{ $t('browse_book.size') }}</v-col>
        <v-col class="py-1" cols="8" sm="9" md="10" xl="11">{{ book.size }}</v-col>
      </v-row>

      <v-row v-if="book.media.comment" class="align-center text-caption">
        <v-col class="py-1 text-uppercase" cols="4" sm="3" md="2" xl="1">{{ $t('browse_book.comment') }}</v-col>
        <v-col class="py-1 error--text font-weight-bold" cols="8" sm="9" md="10" xl="11">{{ mediaComment }}</v-col>
      </v-row>

      <v-row class="align-center text-caption">
        <v-col class="py-1 text-uppercase" cols="4" sm="3" md="2" xl="1">{{ $t('browse_book.format') }}</v-col>
        <v-col class="py-1" cols="8" sm="9" md="10" xl="11">{{ format.type }}</v-col>
      </v-row>

      <v-row v-if="book.metadata.isbn" class="align-center text-caption">
        <v-col class="py-1 text-uppercase" cols="4" sm="3" md="2" xl="1">{{ $t('browse_book.isbn') }}</v-col>
        <v-col class="py-1" cols="8" sm="9" md="10" xl="11">{{ book.metadata.isbn }}</v-col>
      </v-row>

      <v-row class="align-center text-caption">
        <v-col class="py-1 text-uppercase" cols="4" sm="3" md="2" xl="1">{{ $t('browse_book.file') }}</v-col>
        <v-col class="py-1" cols="8" sm="9" md="10" xl="11">{{ book.url }}</v-col>
      </v-row>

      <v-row class="align-center text-caption">
        <v-col class="py-1 text-uppercase" cols="4" sm="3" md="2" xl="1">{{ $t('browse_book.date_created') }}</v-col>
        <v-col class="py-1" cols="8" sm="9" md="10" xl="11">{{
            new Intl.DateTimeFormat($i18n.locale, {
              dateStyle: 'long',
              timeStyle: 'short'
            }).format(new Date(book.created))
          }}
        </v-col>
      </v-row>

      <v-row class="align-center text-caption">
        <v-col class="py-1 text-uppercase" cols="4" sm="3" md="2" xl="1">{{ $t('browse_book.date_modified') }}</v-col>
        <v-col class="py-1" cols="8" sm="9" md="10" xl="11">{{
            new Intl.DateTimeFormat($i18n.locale, {
              dateStyle: 'long',
              timeStyle: 'short'
            }).format(new Date(book.lastModified))
          }}
        </v-col>
      </v-row>

    </v-container>

  </div>
</template>

<script lang="ts">
import BookActionsMenu from '@/components/menus/BookActionsMenu.vue'
import ItemCard from '@/components/ItemCard.vue'
import ToolbarSticky from '@/components/bars/ToolbarSticky.vue'
import {groupAuthorsByRole} from '@/functions/authors'
import {getBookFormatFromMedia, getBookReadRouteFromMedia} from '@/functions/book-format'
import {getPagesLeft, getReadProgress, getReadProgressPercentage} from '@/functions/book-progress'
import {getBookTitleCompact} from '@/functions/book-title'
import urls, {bookFileUrl, bookThumbnailUrl} from '@/functions/urls'
import {MediaStatus, ReadStatus} from '@/types/enum-books'
import {
  BOOK_CHANGED,
  BOOK_DELETED,
  LIBRARY_DELETED,
  READLIST_ADDED,
  READLIST_CHANGED,
  READLIST_DELETED,
  READPROGRESS_CHANGED,
  READPROGRESS_DELETED,
} from '@/types/events'
import Vue from 'vue'
import ReadListsExpansionPanels from '@/components/ReadListsExpansionPanels.vue'
import {BookDto, BookFormat} from '@/types/komga-books'
import {Context, ContextOrigin} from '@/types/context'
import ReadMore from '@/components/ReadMore.vue'
import VueHorizontal from 'vue-horizontal'
import {authorRoles} from '@/types/author-roles'
import {convertErrorCodes} from '@/functions/error-codes'
import RtlIcon from '@/components/RtlIcon.vue'
import {BookSseDto, LibrarySseDto, ReadListSseDto, ReadProgressSseDto} from '@/types/komga-sse'
import {RawLocation} from 'vue-router/types/router'
import {ReadListDto} from '@/types/komga-readlists'
import {BookSearch, SearchConditionSeriesId, SearchConditionTag, SearchOperatorIs} from '@/types/komga-search'

export default Vue.extend({
  name: 'BrowseBook',
  components: {ReadMore, ToolbarSticky, ItemCard, BookActionsMenu, ReadListsExpansionPanels, VueHorizontal, RtlIcon},
  data: () => {
    return {
      MediaStatus,
      SearchConditionTag,
      SearchOperatorIs,
      book: {} as BookDto,
      context: {} as Context,
      contextName: '',
      siblings: [] as BookDto[],
      siblingPrevious: {} as BookDto,
      siblingNext: {} as BookDto,
      readLists: [] as ReadListDto[],
      readMore: false,
      castInfo: null as any,
      bookCharState: null as any,
      bookCharBusy: false,
      bookCharMessage: '',
      bookCharInfo: null as any,
      bookCharDialog: false,
      bookCharDetail: null as any,
      bookCharMergeParent: null as string | null,
      bookCharJobText: '',
      bookCharPollTimer: null as any,
      bookCharPollSawActive: false,
    }
  },
  async created() {
    this.loadBook(this.bookId)
    this.$eventHub.$on(BOOK_CHANGED, this.bookChanged)
    this.$eventHub.$on(BOOK_DELETED, this.bookDeleted)
    this.$eventHub.$on(READPROGRESS_CHANGED, this.readProgressChanged)
    this.$eventHub.$on(READPROGRESS_DELETED, this.readProgressChanged)
    this.$eventHub.$on(LIBRARY_DELETED, this.libraryDeleted)
    this.$eventHub.$on(READLIST_ADDED, this.readListChanged)
    this.$eventHub.$on(READLIST_CHANGED, this.readListChanged)
    this.$eventHub.$on(READLIST_DELETED, this.readListChanged)
  },
  beforeDestroy() {
    this.stopBookCharPoll()
    this.$eventHub.$off(BOOK_CHANGED, this.bookChanged)
    this.$eventHub.$off(BOOK_DELETED, this.bookDeleted)
    this.$eventHub.$off(READPROGRESS_CHANGED, this.readProgressChanged)
    this.$eventHub.$off(READPROGRESS_DELETED, this.readProgressChanged)
    this.$eventHub.$off(LIBRARY_DELETED, this.libraryDeleted)
    this.$eventHub.$off(READLIST_ADDED, this.readListChanged)
    this.$eventHub.$off(READLIST_CHANGED, this.readListChanged)
    this.$eventHub.$off(READLIST_DELETED, this.readListChanged)
  },
  props: {
    bookId: {
      type: String,
      required: true,
    },
  },
  async beforeRouteUpdate(to, from, next) {
    if (to.params.bookId !== from.params.bookId) {
      this.readMore = false
      this.loadBook(to.params.bookId)
    }

    next()
  },
  computed: {
    readRouteName(): string {
      return getBookReadRouteFromMedia(this.book.media)
    },
    isAdmin(): boolean {
      return this.$store.getters.meAdmin
    },
    bookCharMergeCandidates(): any[] {
      if (!this.bookCharInfo || !this.bookCharDetail) return []
      return (this.bookCharInfo.characters || []).filter((c: any) => c.id !== this.bookCharDetail.id && c.status !== 'merged')
    },
    unavailable(): boolean {
      return this.book.deleted || this.$store.getters.getLibraryById(this.book.libraryId).unavailable
    },
    canRead(): boolean {
      return this.book.media.status === 'READY' && this.$store.getters.mePageStreaming && !this.unavailable
    },
    canDownload(): boolean {
      return this.$store.getters.meFileDownload && !this.unavailable
    },
    thumbnailUrl(): string {
      return bookThumbnailUrl(this.bookId)
    },
    fileUrl(): string {
      return bookFileUrl(this.bookId)
    },
    format(): BookFormat {
      return getBookFormatFromMedia(this.book.media)
    },
    authorsByRole(): any {
      return groupAuthorsByRole(this.book.metadata.authors)
    },
    isRead(): boolean {
      return getReadProgress(this.book) === ReadStatus.READ
    },
    isUnread(): boolean {
      return getReadProgress(this.book) === ReadStatus.UNREAD
    },
    isInProgress(): boolean {
      return getReadProgress(this.book) === ReadStatus.IN_PROGRESS
    },
    pagesLeft(): number {
      return getPagesLeft(this.book)
    },
    readProgressPercentage(): number {
      return getReadProgressPercentage(this.book)
    },
    readProgressDate(): string | undefined {
      if (this.book.readProgress)
        return new Intl.DateTimeFormat(this.$i18n.locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        } as Intl.DateTimeFormatOptions).format(this.book.readProgress.readDate)
      return undefined
    },
    previousId(): string {
      return this.siblingPrevious?.id?.toString() || '0'
    },
    nextId(): string {
      return this.siblingNext?.id?.toString() || '0'
    },
    contextReadList(): boolean {
      return this.context.origin === ContextOrigin.READLIST
    },
    mediaComment(): string {
      return convertErrorCodes(this.book.media.comment)
    },
    parentLocation(): RawLocation {
      if (this.contextReadList)
        return {name: 'browse-readlist', params: {readListId: this.context.id}}
      else
        return {name: 'browse-series', params: {seriesId: this.book.seriesId}}
    },
    displayedRoles(): string[] {
      const allRoles = this.$_.uniq([...authorRoles, ...(this.book.metadata.authors.map(x => x.role))])
      return allRoles.filter(x => this.authorsByRole[x])
    },
  },
  methods: {
    getLibraryName(item: BookDto): string {
      return this.$store.getters.getLibraryById(item.libraryId).name
    },
    libraryDeleted(event: LibrarySseDto) {
      if (event.libraryId === this.book.libraryId) {
        this.$router.push({name: 'home'})
      }
    },
    readListChanged(event: ReadListSseDto) {
      if (event.bookIds.includes(this.bookId) || this.readLists.map(x => x.id).includes(event.readListId)) {
        this.$komgaBooks.getReadLists(this.bookId)
          .then(v => this.readLists = v)
      }
    },
    bookChanged(event: BookSseDto) {
      if (event.bookId === this.bookId) this.loadBook(this.bookId)
    },
    bookDeleted(event: BookSseDto) {
      if (event.bookId === this.bookId) {
        this.$router.push({name: 'browse-series', params: {seriesId: this.book.seriesId}})
      }
    },
    readProgressChanged(event: ReadProgressSseDto) {
      if (event.bookId === this.bookId) this.loadBook(this.bookId)
    },
    async loadBookCharState() {
      this.bookCharState = null
      try {
        if (!this.book.seriesId || !this.book.url || !this.book.url.toLowerCase().endsWith('.epub')) return
        const response = await fetch(`${urls.originNoSlash}/api/v1/series/${this.book.seriesId}/characters`, {
          credentials: 'include',
          headers: {Accept: 'application/json'},
        })
        if (!response.ok) return
        const info = await response.json()
        this.bookCharInfo = info
        this.bookCharState = (info.books || []).find((b: any) => b.bookId === this.bookId) || null
        this.startBookCharPoll()
      } catch (e) {
        this.bookCharState = null
      }
    },
    openBookCharacter(characterId: string) {
      const character = (this.bookCharInfo?.characters || []).find((c: any) => c.id === characterId)
      if (!character) return
      this.bookCharDetail = character
      this.bookCharMergeParent = null
      this.bookCharDialog = true
    },
    async bookCharMerge() {
      if (!this.bookCharDetail || !this.bookCharMergeParent) return
      this.bookCharBusy = true
      try {
        const response = await fetch(`${urls.originNoSlash}/api/v1/series/${this.book.seriesId}/characters/merge`, {
          method: 'POST',
          credentials: 'include',
          headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
          body: JSON.stringify({parentId: this.bookCharMergeParent, childId: this.bookCharDetail.id}),
        })
        if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`)
        this.bookCharDialog = false
        this.bookCharMessage = 'Merge queued.'
        this.startBookCharPoll()
      } catch (e: any) {
        this.bookCharMessage = e.message || 'Request failed'
      } finally {
        this.bookCharBusy = false
      }
    },
    async bookCharPollJobs() {
      try {
        const response = await fetch(`${urls.originNoSlash}/api/v1/series/${this.book.seriesId}/characters/jobs`, {
          credentials: 'include',
          headers: {Accept: 'application/json'},
        })
        if (!response.ok) return
        const jobs = await response.json()
        const num = (this.book as any).number
        const active = (jobs || []).find((j: any) => (j.state === 'queued' || j.state === 'running') && num != null && j.detail && j.detail.includes(`#${num}`))
        if (active) {
          this.bookCharPollSawActive = true
          const label = active.type === 'analyze_series' ? 'Analyzing characters' : active.type === 'generate_audiobooks' ? 'Generating audiobook' : 'Working'
          this.bookCharJobText = active.state === 'queued' ? `${label} — queued…` : `${label} — ${active.phase || 'working'} · ${active.detail}`
        } else if (this.bookCharPollSawActive) {
          this.bookCharJobText = ''
          this.bookCharPollSawActive = false
          const failed = (jobs || []).find((j: any) => j.state === 'error')
          if (failed && failed.error) this.bookCharMessage = failed.error
          await this.loadBookCharState()
          if (this.book.cast) this.loadCast(this.bookId)
          this.stopBookCharPoll()
        } else {
          this.stopBookCharPoll()
        }
      } catch (e) {
        // jobs endpoint unavailable — stay silent
      }
    },
    startBookCharPoll() {
      if (this.bookCharPollTimer) return
      this.bookCharPollJobs()
      this.bookCharPollTimer = setInterval(() => this.bookCharPollJobs(), 4000)
      setTimeout(() => this.stopBookCharPoll(), 15 * 60 * 1000)
    },
    stopBookCharPoll() {
      if (this.bookCharPollTimer) {
        clearInterval(this.bookCharPollTimer)
        this.bookCharPollTimer = null
      }
    },
    async bookCharPost(path: string) {
      this.bookCharBusy = true
      this.bookCharMessage = ''
      try {
        const response = await fetch(`${urls.originNoSlash}/api/v1/series/${this.book.seriesId}/characters/${path}`, {
          method: 'POST',
          credentials: 'include',
          headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
          body: JSON.stringify({bookIds: [this.bookId]}),
        })
        if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`)
        this.bookCharMessage = 'Queued.'
        this.startBookCharPoll()
      } catch (e: any) {
        this.bookCharMessage = e.message || 'Request failed'
      } finally {
        this.bookCharBusy = false
      }
    },
    async bookCharMark(field: string, value: boolean) {
      this.bookCharBusy = true
      this.bookCharMessage = ''
      try {
        const body: any = {bookIds: [this.bookId]}
        body[field] = value
        const response = await fetch(`${urls.originNoSlash}/api/v1/series/${this.book.seriesId}/characters/marks`, {
          method: 'POST',
          credentials: 'include',
          headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        })
        if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`)
        await this.loadBookCharState()
      } catch (e: any) {
        this.bookCharMessage = e.message || 'Request failed'
      } finally {
        this.bookCharBusy = false
      }
    },
    async loadCast(bookId: string) {
      try {
        const response = await fetch(`${urls.originNoSlash}/api/v1/books/${bookId}/cast`, {
          credentials: 'include',
          headers: {Accept: 'application/json'},
        })
        if (response.ok) this.castInfo = await response.json()
      } catch (e) {
        // cast display is best-effort only
      }
    },
    async loadBook(bookId: string) {
      this.castInfo = null
      this.book = await this.$komgaBooks.getBook(bookId)
      this.loadBookCharState()
      if (this.book.cast) this.loadCast(bookId)
      // for the cases where we can't change the origin target route because we don't have the full BookDto
      if (this.book.oneshot) await this.$router.replace({
        name: 'browse-oneshot',
        params: {seriesId: this.book.seriesId},
      })

      // parse query params to get context and contextId
      if (this.$route.query.contextId && this.$route.query.context
        && Object.values(ContextOrigin).includes(this.$route.query.context as ContextOrigin)) {
        this.context = {
          origin: this.$route.query.context as ContextOrigin,
          id: this.$route.query.contextId as string,
        }
        this.book.context = this.context
        this.$komgaReadLists.getOneReadList(this.context.id)
          .then(v => this.contextName = v.name)
      }

      // Get siblings depending on origin
      if (this?.context.origin === ContextOrigin.READLIST) {
        this.$komgaReadLists.getBooks(this.context.id, {unpaged: true} as PageRequest)
          .then(v => this.siblings = v.content)
      } else {
        this.$komgaBooks.getBooksList({
          condition: new SearchConditionSeriesId(new SearchOperatorIs(this.book.seriesId)),
        } as BookSearch, {unpaged: true, sort: ['metadata.numberSort']})
          .then(v => this.siblings = v.content)
      }

      this.$komgaBooks.getReadLists(this.bookId)
        .then(v => this.readLists = v)

      if (this.$_.has(this.book, 'metadata.title')) {
        document.title = `Komga - ${getBookTitleCompact(this.book.metadata.title, this.book.seriesTitle, this.book.oneshot ? undefined : this.book.metadata.number)}`
      }

      if (this?.context.origin === ContextOrigin.READLIST) {
        this.$komgaReadLists.getBookSiblingNext(this.context.id, bookId)
          .then(v => this.siblingNext = v)
          .catch(e => this.siblingNext = {} as BookDto)
      } else {
        this.$komgaBooks.getBookSiblingNext(bookId)
          .then(v => this.siblingNext = v)
          .catch(e => this.siblingNext = {} as BookDto)
      }
      if (this?.context.origin === ContextOrigin.READLIST) {
        this.$komgaReadLists.getBookSiblingPrevious(this.context.id, bookId)
          .then(v => this.siblingPrevious = v)
          .catch(e => this.siblingPrevious = {} as BookDto)
      } else {
        this.$komgaBooks.getBookSiblingPrevious(bookId)
          .then(v => this.siblingPrevious = v)
          .catch(e => this.siblingPrevious = {} as BookDto)
      }
    },
    analyze() {
      this.$komgaBooks.analyzeBook(this.book)
    },
    refreshMetadata() {
      this.$komgaBooks.refreshMetadata(this.book)
    },
    editBook() {
      this.$store.dispatch('dialogUpdateBooks', this.book)
    },
    removeFromReadList(readListId: string) {
      const rl = this.readLists.find(x => x.id == readListId)
      const modified = Object.assign({}, {bookIds: rl?.bookIds.filter(x => x != this.bookId)})
      if (modified!.bookIds!.length == 0)
        this.$komgaReadLists.deleteReadList(rl!.id)
      else
        this.$komgaReadLists.patchReadList(rl!.id, modified)
    },
  },
})
</script>

<style scoped>
</style>
