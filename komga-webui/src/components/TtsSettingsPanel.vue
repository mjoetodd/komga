<template>
  <v-card flat class="pa-4">
    <div class="text-subtitle-1 font-weight-bold mb-3">
      Text-to-Speech Settings
    </div>
    
    <v-select
      v-model="providerId"
      :items="providers"
      item-text="name"
      item-value="id"
      label="TTS Provider"
      outlined
      dense
      class="mb-2"
      @change="onProviderChange"
    />

    <!-- Voice picker with an audition button: server providers can expose dozens of
         voices (38 on Phonon), and a name alone says nothing about how one sounds.
         Preview speaks one sample sentence with the selected voice. -->
    <div class="d-flex align-start mb-2">
      <v-select
        v-model="voiceId"
        :items="voices"
        item-text="name"
        item-value="id"
        label="Voice"
        outlined
        dense
        :loading="loadingVoices"
        :disabled="loadingVoices || voices.length === 0"
        style="flex: 1 1 auto"
      />
      <v-btn
        icon
        class="ml-2 mt-1"
        :color="previewing ? 'error' : 'primary'"
        :disabled="loadingVoices || voices.length === 0"
        :title="previewing ? 'Stop preview' : 'Preview this voice'"
        @click="togglePreview"
      >
        <v-icon>{{ previewing ? 'mdi-stop' : 'mdi-play-circle-outline' }}</v-icon>
      </v-btn>
    </div>

    <v-slider
      v-model="rate"
      label="Speed"
      min="0.5"
      max="3.0"
      step="0.1"
      thumb-label="always"
      class="mt-4 mb-2"
    >
      <template v-slot:append>
        <span class="text-caption font-weight-bold" style="width: 30px; display: inline-block;">
          {{ rate }}x
        </span>
      </template>
    </v-slider>

    <v-select
      v-model="chunkMode"
      :items="chunkModes"
      label="Chunk Size"
      hint="Sentence sends one request per sentence. Smart groups 2-3 sentences per request - fewer gaps between sentences and more natural flow, with word highlighting kept. Paragraph sends the fewest requests, but highlights a whole paragraph at a time."
      persistent-hint
      outlined
      dense
      class="mb-2"
    />

    <v-select
      v-model="highlightMode"
      :items="highlightModes"
      label="Highlight Mode"
      outlined
      dense
      class="mb-2"
    />

    <v-combobox
      v-model="language"
      :items="languages"
      label="Language"
      hint="Some providers (e.g. Qwen3-TTS) need an explicit language name like &quot;English&quot; rather than auto-detecting it. Leave blank to let the provider decide."
      persistent-hint
      clearable
      outlined
      dense
      class="mb-2"
    />

    <v-alert
      v-if="providerId === 'server' && !serverConfigured"
      type="info"
      dense
      outlined
      class="mb-2"
    >
      No TTS provider is configured on the server yet. Ask your administrator to set one up under Server Settings.
    </v-alert>
  </v-card>
</template>

<script lang="ts">
import Vue from 'vue'
import { TTSProviderRegistry } from '@/functions/tts/tts-provider-registry'
import { TTSVoice } from '@/functions/tts/tts-provider'

export default Vue.extend({
  name: 'TtsSettingsPanel',
  props: {
    settings: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      registry: TTSProviderRegistry.getInstance(),
      providers: [] as { id: string; name: string }[],
      voices: [] as TTSVoice[],
      languages: [] as string[],
      loadingVoices: false,
      previewing: false,
      serverConfigured: true,
      highlightModes: [
        { text: 'Segment highlighting', value: 'sentence' },
        { text: 'Word & segment highlighting', value: 'word' },
        { text: 'No highlighting', value: 'off' },
      ],
      chunkModes: [
        { text: 'Sentence', value: 'sentence' },
        { text: 'Smart (2-3 sentences)', value: 'smart' },
        { text: 'Paragraph', value: 'paragraph' },
      ],
    }
  },
  computed: {
    providerId: {
      get(): string {
        return this.settings.ttsProviderId || 'browser'
      },
      set(val: string) {
        this.$emit('update-setting', { key: 'ttsProviderId', value: val })
      },
    },
    voiceId: {
      get(): string {
        return this.settings.ttsVoiceId || ''
      },
      set(val: string) {
        this.$emit('update-setting', { key: 'ttsVoiceId', value: val })
      },
    },
    rate: {
      get(): number {
        return this.settings.ttsRate || 1.0
      },
      set(val: number) {
        this.$emit('update-setting', { key: 'ttsRate', value: val })
      },
    },
    highlightMode: {
      get(): string {
        return this.settings.ttsHighlightMode || 'sentence'
      },
      set(val: string) {
        this.$emit('update-setting', { key: 'ttsHighlightMode', value: val })
      },
    },
    chunkMode: {
      get(): string {
        return this.settings.ttsChunkMode || 'sentence'
      },
      set(val: string) {
        this.$emit('update-setting', { key: 'ttsChunkMode', value: val })
      },
    },
    language: {
      get(): string {
        return this.settings.ttsLanguage || ''
      },
      set(val: string) {
        this.$emit('update-setting', { key: 'ttsLanguage', value: val || '' })
      },
    },
  },
  mounted() {
    this.providers = this.registry.getRegisteredProviders()
    this.loadVoices()
    this.refreshServerStatus()
  },
  beforeDestroy() {
    if (this.previewing) this.registry.getActiveProvider().cancel()
  },
  methods: {
    async refreshServerStatus() {
      try {
        const { data } = await this.$http.get('/api/v1/tts/status')
        this.serverConfigured = !!data.configured
      } catch (e) {
        // If the check itself fails, don't block the UI on it
        this.serverConfigured = true
      }
    },
    async loadVoices() {
      this.loadingVoices = true
      try {
        const provider = this.registry.getActiveProvider()
        this.voices = await provider.getVoices()
        // Fallback or select first voice if empty
        if (this.voices.length > 0 && !this.voices.some(v => v.id === this.voiceId)) {
          const defaultVoice = this.voices.find(v => v.isDefault) || this.voices[0]
          this.voiceId = defaultVoice.id
        }
        this.languages = (await provider.getLanguages?.()) ?? []
      } catch (e) {
        this.$err('Error loading voices:', e)
        this.voices = []
        this.languages = []
      } finally {
        this.loadingVoices = false
      }
    },
    // Auditions the selected voice with one sample sentence. Shares the provider
    // singleton with the reading session, so: refuse to start while a session owns the
    // provider, and park the controller's provider callbacks for the duration - the
    // provider's onEnd/onError otherwise belong to TTSController, and a preview ending
    // would look exactly like a sentence ending to it.
    async togglePreview() {
      const provider = this.registry.getActiveProvider()
      if (this.previewing) {
        provider.cancel()
        return
      }
      if (provider.state !== 'idle') {
        this.$emit('toast', 'Stop playback to preview a voice.')
        return
      }
      const voice = this.voices.find(v => v.id === this.voiceId)
      if (!voice) return

      const parked = {
        onEnd: provider.onEnd,
        onError: provider.onError,
        onBoundary: provider.onBoundary,
      }
      provider.onEnd = () => {}
      provider.onError = () => {}
      provider.onBoundary = () => {}
      const restore = () => {
        provider.onEnd = parked.onEnd
        provider.onError = parked.onError
        provider.onBoundary = parked.onBoundary
        this.previewing = false
      }

      this.previewing = true
      try {
        const utterance = await provider.speak(
          'This is the voice that will read your book aloud.',
          { voice, rate: this.rate },
        )
        utterance.promise.then(restore, restore)
      } catch (e) {
        restore()
        this.$emit('toast', 'Voice preview failed.')
      }
    },
    async onProviderChange(newProviderId: string) {
      if (this.previewing) this.registry.getActiveProvider().cancel()
      try {
        // Don't seed the new provider with the outgoing provider's voiceId - it's a
        // foreign id (e.g. a browser voice name) that the new provider doesn't recognize.
        // ServerTTSProvider would otherwise treat it as a real, default-selected option in
        // its voice list fallback, so loadVoices() below would "match" it and immediately
        // pre-warm audio for a voice id the server has never heard of.
        await this.registry.setActiveProvider(newProviderId, {})
        this.$emit('provider-changed', newProviderId)
        await this.loadVoices()
        if (newProviderId === 'server') await this.refreshServerStatus()
      } catch (e) {
        this.$err('Failed to change provider:', e)
      }
    },
  },
})
</script>
