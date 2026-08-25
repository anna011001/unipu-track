import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import vuetify from './plugins/vuetify.js'
import CountryAutocomplete from './components/CountryAutocomplete.vue'
import './style.css'

const app = createApp(App)

app.component('CountryAutocomplete', CountryAutocomplete)

app.use(router)
app.use(vuetify)

app.mount('#app')
