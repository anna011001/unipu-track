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
          record: '#256a8f',
          'record-hover': '#174d6b',
          'membership-link': '#8a6800',
          muted: '#736c5e',
          'category-card': '#cda509',
          'category-card-hover': '#b99208',
          'category-border': '#cda509',
          'table-border': '#cda509',
          'table-header-border': '#8a6800',
          'on-category-card': '#ffffff',
        },
      },
      unipuDark: {
        dark: true,
        colors: {
          background: '#1c180d',
          surface: '#1c180d',
          primary: '#fac91a',
          'on-primary': '#1c180d',
          'on-background': '#e7d7b4',
          'on-surface': '#e7d7b4',
          secondary: '#b89220',
          error: '#ffb4ab',
          info: '#67bdf3',
          divider: '#4b4022',
          record: '#67bdf3',
          'record-hover': '#318fc5',
          'membership-link': '#fac91a',
          muted: '#bbaa83',
          'category-card': '#2b230d',
          'category-card-hover': '#382e14',
          'category-border': '#8d721a',
          'table-border': '#4b4022',
          'table-header-border': '#8d721a',
          'on-category-card': '#fac91a',
        },
      },
    },
  },
})

export default vuetify
