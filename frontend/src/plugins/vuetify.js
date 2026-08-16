import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import {
  VAlert,
  VApp,
  VAppBar,
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VCol,
  VContainer,
  VForm,
  VMain,
  VProgressCircular,
  VRow,
  VSpacer,
  VTable,
  VTextField,
} from 'vuetify/components'

const components = {
  VAlert,
  VApp,
  VAppBar,
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VCol,
  VContainer,
  VForm,
  VMain,
  VProgressCircular,
  VRow,
  VSpacer,
  VTable,
  VTextField,
}

const vuetify = createVuetify({
  components,
  theme: {
    defaultTheme: 'unipuTheme',
    themes: {
      unipuTheme: {
        dark: false,
        colors: {
          background: '#ffffff',
          surface: '#ffffff',
          primary: '#d0a30b',
          'on-primary': '#2d2405',
          secondary: '#6f633d',
          error: '#b3261e',
          info: '#4b6382',
        },
      },
    },
  },
})

export default vuetify
