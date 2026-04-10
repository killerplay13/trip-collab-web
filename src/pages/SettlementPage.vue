<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useTripAccess } from "../composables/useTripAccess";

const route = useRoute();
const tripId = computed(() => String(route.params.tripId || ""));
const { isOwner, role } = useTripAccess();
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold">Settlement</h1>
    <p class="mt-2 text-sm text-zinc-400">tripId: {{ tripId }}</p>

    <div class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <div class="text-sm text-zinc-400">Access</div>
      <div class="mt-1 text-sm text-zinc-200">
        {{ role || "member" }}
      </div>
    </div>

    <div
      v-if="isOwner"
      class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800"
    >
      <div class="text-sm text-zinc-400">Owner Controls</div>
      <div class="mt-1 text-sm text-zinc-200">
        Settlement actions stay owner-only in this view.
      </div>
    </div>

    <div
      v-else
      class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800"
    >
      <div class="text-sm text-zinc-400">Member View</div>
      <div class="mt-1 text-sm text-zinc-300">
        Only the trip owner can manage settlement actions.
      </div>
    </div>
  </div>
</template>
