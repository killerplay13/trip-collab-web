<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Calendar, HomeFilled, Money, ScaleToOriginal } from "@element-plus/icons-vue";

const route = useRoute();
const router = useRouter();

const tripId = computed(() => String(route.params.tripId || ""));

type Tab = { label: string; to: (tripId: string) => string; icon: Component };

const tabs: Tab[] = [
  { label: "Home", to: (id) => `/t/${id}`, icon: HomeFilled },
  { label: "Itinerary", to: (id) => `/t/${id}/itinerary`, icon: Calendar },
  { label: "Expenses", to: (id) => `/t/${id}/expenses`, icon: Money },
  { label: "Settlement", to: (id) => `/t/${id}/settlement`, icon: ScaleToOriginal },
];

function isActive(path: string) {
  // active if current route path starts with the tab path
  return route.path === path || route.path.startsWith(path + "/") || route.path.startsWith(path);
}

async function go(path: string) {
  if (route.path !== path) await router.push(path);
}
</script>

<template>
<div class="min-h-[100svh] w-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
    <!-- Content -->
<main class="mx-auto max-w-md px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <RouterView />
    </main>

    <!-- Bottom Tabs -->
    <nav
      class="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <div class="mx-auto grid max-w-md grid-cols-4 px-2 py-2">
        <el-button
          v-for="t in tabs"
          :key="t.label"
          size="small"
          :icon="t.icon"
          :text="!isActive(t.to(tripId))"
          class="rounded-xl px-2 py-2 text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          :class="isActive(t.to(tripId)) ? 'bg-zinc-900 text-white' : 'text-zinc-400'"
          @click="go(t.to(tripId))"
        >
          {{ t.label }}
        </el-button>
      </div>
    </nav>
  </div>
</template>
