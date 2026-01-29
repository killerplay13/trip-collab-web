<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { getTrip } from "../api/trips";

const route = useRoute();
const tripId = String(route.params.tripId);
const tripTitle = ref("");
const errorMsg = ref("");

onMounted(async () => {
  try {
    const trip = await getTrip(tripId);
    tripTitle.value = trip.title;
  } catch (e: any) {
    errorMsg.value = e?.message ?? "Load trip failed";
  }
});
</script>

<template>
  <div class="min-h-dvh bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-md px-4 py-6">
      <h1 class="text-xl font-semibold">Trip Home</h1>
      <p class="mt-2 text-sm text-zinc-400">tripId: {{ tripId }}</p>

      <div class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
        <div class="text-sm text-zinc-400">Title</div>
        <div class="mt-1 text-lg">{{ tripTitle || "-" }}</div>
      </div>

      <p v-if="errorMsg" class="mt-4 text-sm text-red-300">{{ errorMsg }}</p>
    </div>
  </div>
</template>
