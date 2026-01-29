<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const tripId = computed(() => String(route.params.tripId || ""));
</script>

<template>
  <div class="min-h-dvh bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-md px-4 py-6">
      <h1 class="text-xl font-semibold">Notes</h1>
      <p class="mt-2 text-sm text-zinc-400">tripId: {{ tripId }}</p>
    </div>
  </div>
</template>
