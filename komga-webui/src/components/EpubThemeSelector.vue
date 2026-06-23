<template>
  <div class="epub-theme-selector" role="group" aria-label="Reading theme">
    <button
      v-for="theme in EPUB_THEMES"
      :key="theme.id"
      type="button"
      class="theme-option"
      :title="theme.label"
      :aria-label="theme.label"
      :aria-pressed="themeId === theme.id"
      @click="$emit('update-setting', { key: 'themeId', value: theme.id })"
    >
      <span class="swatch" :style="swatchStyle(theme)" :class="{ 'swatch--active': themeId === theme.id }"/>
      <span class="label">{{ theme.label }}</span>
    </button>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import {EPUB_THEMES} from '@/functions/epub-themes'
import {EpubTheme} from '@/types/epub'

export default Vue.extend({
  name: 'EpubThemeSelector',
  props: {
    themeId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      EPUB_THEMES,
    }
  },
  methods: {
    swatchStyle(theme: EpubTheme): Record<string, string> {
      const dark = this.$vuetify.theme.dark
      const variant = dark ? theme.dark : theme.light
      const style: Record<string, string> = {backgroundColor: variant.swatch}
      // No transition animation on selection - the active border should appear instantly.
      if (this.themeId === theme.id) style.borderColor = variant.text
      return style
    },
  },
})
</script>

<style scoped>
.epub-theme-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 8px;
  padding: 4px 0;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 64px;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}

.swatch {
  display: block;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: 0 0 0 1px rgba(128, 128, 128, 0.3) inset;
}

.swatch--active {
  box-shadow: 0 0 0 1px rgba(128, 128, 128, 0.3) inset;
}

.label {
  margin-top: 4px;
  font-size: 0.65rem;
  text-align: center;
  line-height: 1.1;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
