import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import GuidanceView from '../views/GuidanceView.vue'
import StatsView from '../views/StatsView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',          name: 'home',     component: HomeView },
    { path: '/guidance',  name: 'guidance', component: GuidanceView },
    { path: '/stats',     name: 'stats',    component: StatsView },
  ],
})
