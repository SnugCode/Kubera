<template>
  <div class="app-layout">
    <nav class="app-nav">
      <span class="app-nav-brand">Kube<span>ra</span></span>
      <RouterLink to="/"         class="nav-tab" :class="{ active: route.name === 'home' }">Home</RouterLink>
      <RouterLink to="/guidance" class="nav-tab" :class="{ active: route.name === 'guidance' }">Guidance</RouterLink>
      <RouterLink to="/stats"    class="nav-tab" :class="{ active: route.name === 'stats' }">Stats</RouterLink>
    </nav>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
const route = useRoute()
</script>
