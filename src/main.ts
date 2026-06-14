import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

import { useCommitmentsStore } from './stores/commitments'
import { useIncomeStore } from './stores/income'
import { useAllocationsStore } from './stores/allocations'
import { useListsStore } from './stores/lists'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Boot: load all data before mounting
const commitments = useCommitmentsStore()
const income = useIncomeStore()
const allocations = useAllocationsStore()
const lists = useListsStore()

Promise.all([
  commitments.load(),
  income.load(),
  allocations.load(),
  lists.load(),
]).then(() => {
  app.mount('#app')
})
