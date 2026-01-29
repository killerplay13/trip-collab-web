<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { createTrip } from "../api/trips";
import { useSessionStore } from "../stores/session";

const router = useRouter();
const session = useSessionStore();

const title = ref("Tottori & Okayama");
const timezone = ref("Asia/Taipei");
const startDate = ref("2026-02-10");
const endDate = ref("2026-02-14");
const notes = ref("v0.1 backend milestone");

const loading = ref(false);
const errorMsg = ref("");

async function handleCreate() {
  errorMsg.value = "";
  loading.value = true;
  try {
    const trip = await createTrip({
      title: title.value,
      timezone: timezone.value,
      startDate: startDate.value,
      endDate: endDate.value,
      notes: notes.value,
    });

    if (!trip.inviteToken) {
      throw new Error("API did not return inviteToken");
    }

    session.setTripToken(trip.id, trip.inviteToken);
    await router.push(`/t/${trip.id}`);
  } catch (e: any) {
    errorMsg.value = e?.message ?? "Create trip failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-dvh bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-md px-4 py-6">
      <h1 class="text-xl font-semibold">Create a Trip</h1>
      <p class="mt-1 text-sm text-zinc-400">v0.1 — no login, token-based</p>

      <div class="mt-6 space-y-4">
        <label class="block">
          <div class="text-sm text-zinc-300">Title</div>
          <input v-model="title" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
        </label>

        <label class="block">
          <div class="text-sm text-zinc-300">Start Date</div>
          <input type="date" v-model="startDate" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
        </label>

        <label class="block">
          <div class="text-sm text-zinc-300">End Date</div>
          <input type="date" v-model="endDate" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
        </label>

        <label class="block">
          <div class="text-sm text-zinc-300">Notes</div>
          <textarea v-model="notes" rows="3" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
        </label>

        <button
          :disabled="loading"
          @click="handleCreate"
          class="w-full rounded-xl bg-white px-4 py-2 text-zinc-900 font-medium disabled:opacity-60"
        >
          {{ loading ? "Creating..." : "Create & Enter" }}
        </button>

        <p v-if="errorMsg" class="text-sm text-red-300">{{ errorMsg }}</p>
      </div>
    </div>
  </div>
</template>
