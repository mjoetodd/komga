import Vue from 'vue'
import VueI18n, {LocaleMessages} from 'vue-i18n'

Vue.use(VueI18n)

// Vuetify itself looks up its own internal strings (aria-labels like "$vuetify.badge",
// "$vuetify.input.clear", etc - see plugins/vuetify.ts's `lang.t`) through this same vue-i18n
// instance, under the "$vuetify" key. The app's own locale files only carry a partial,
// hand-maintained copy of those strings, which drifts out of sync as Vuetify adds new ones -
// hence the "Cannot translate... $vuetify.badge" warnings. Pull Vuetify's own (always
// up-to-date) locale data in instead, with the app's overrides layered on top.
function loadVuetifyMessages(code: string): Record<string, any> {
  const vuetifyLocales = require.context('vuetify/lib/locale', false, /\.js$/)
  for (const candidate of [code, code.split('-')[0], 'en']) {
    const file = `./${candidate}.js`
    if (vuetifyLocales.keys().includes(file)) {
      return vuetifyLocales(file).default
    }
  }
  return {}
}

function loadLocaleMessages(): LocaleMessages {
  const locales = require.context('./locales', true, /[A-Za-z0-9-_,\s]+\.json$/i)
  const messages: LocaleMessages = {}
  locales.keys().forEach(key => {
    const matched = key.match(/([A-Za-z0-9-_]+)\./i)
    if (matched && matched.length > 1) {
      const locale = matched[1]
      const appMessages = locales(key)
      messages[locale] = {
        ...appMessages,
        $vuetify: { ...loadVuetifyMessages(locale), ...appMessages.$vuetify },
      }
    }
  })
  return messages
}

export default new VueI18n({
  locale: process.env.VUE_APP_I18N_LOCALE || 'en',
  fallbackLocale: process.env.VUE_APP_I18N_FALLBACK_LOCALE || 'en',
  messages: loadLocaleMessages(),
  pluralizationRules: {
    /**
     * @param choice {number} a choice index given by the input to $tc: `$tc('path.to.rule', choiceIndex)`
     * @param choicesLength {number} an overall amount of available choices
     * @returns a final choice index to select plural word by
     */
    'pl': function (choice, choicesLength) {
      // brak stron
      if (choice === 0) {
        return 0
      }

      // 1 strona
      if (choice === 1) {
        return 1
      }

      const betweenTwoAndFour = ((choice % 10) >= 2 && (choice % 10) <= 4)
      const lessThanTen = choice < 10
      const moreThanTwenty = choice > 20

      // 2 strony, 3 strony, 4 strony, 22 strony ...
      if (betweenTwoAndFour && (lessThanTen || moreThanTwenty)) {
        return 2
      }

      // other cases, 5 stron, 67 stron, 259 stron and so on
      return (choicesLength < 4) ? 2 : 3
    },
  },
})
