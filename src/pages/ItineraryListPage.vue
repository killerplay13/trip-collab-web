<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const tripId = computed(() => String(route.params.tripId || ""));
</script>

<template>
  <div class="min-h-dvh bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-md px-4 py-6">
      <h1 class="text-xl font-semibold">Itinerary</h1>
      <p class="mt-2 text-sm text-zinc-400">tripId: {{ tripId }}</p>

      <div class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
        <p class="text-sm text-zinc-300">
          Placeholder page. Next step: day switch with <code class="text-zinc-100">?date=YYYY-MM-DD</code>.
        </p>
      </div>
    </div>
  </div>
</template>
