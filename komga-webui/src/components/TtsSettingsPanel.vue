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

    <v-select
      v-model="voiceId"
      :items="voices"
      item-text="name"
      item-value="id"
      label="Voice"
      outlined
      dense
      class="mb-2"
      :loading="loadingVoices"
      :disabled="loadingVoices || voices.length === 0"
    />

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
      serverConfigured: true,
      highlightModes: [
        { text: 'Sentence highlighting', value: 'sentence' },
        { text: 'Word & sentence highlighting', value: 'word' },
        { text: 'No highlighting', value: 'off' },
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
    async onProviderChange(newProviderId: string) {
      try {
        await this.registry.setActiveProvider(newProviderId, {
          voiceId: this.voiceId,
        })
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
