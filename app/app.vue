<script setup lang="ts">
useHead({
  titleTemplate: (title) => title || 'Kalorientracker',
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
