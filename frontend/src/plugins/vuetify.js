import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import {
  VApp,
  VAppBar,
  VMain,
} from 'vuetify/components'

const components = {
  VApp,
  VAppBar,
  VMain,
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
          'on-background': '#403b31',
          'on-surface': '#403b31',
          secondary: '#6f633d',
          error: '#b3261e',
          info: '#4b6382',
          divider: '#eeeae1',
          record: '#67bdf3',
          muted: '#736c5e',
          'category-card': '#cda509',
          'category-border': '#cda509',
          'on-category-card': '#ffffff',
        },
      },
      unipuDark: {
        dark: true,
        colors: {
          background: '#332800',
          surface: '#332800',
          primary: '#fac91a',
          'on-primary': '#241a01',
          'on-background': '#e4c79b',
          'on-surface': '#e4c79b',
          secondary: '#c69f13',
          error: '#ffb4ab',
          info: '#67bdf3',
          divider: '#806b18',
          record: '#67bdf3',
          muted: '#cbb58e',
          'category-card': '#241a01',
          'category-border': '#c69f13',
          'on-category-card': '#fac91a',
        },
      },
    },
  },
})

export default vuetify
