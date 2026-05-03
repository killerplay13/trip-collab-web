<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Calendar, HomeFilled, Money, ScaleToOriginal, Wallet } from "@element-plus/icons-vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const tripId = computed(() => String(route.params.tripId || ""));

type Tab = { label: string; to: (tripId: string) => string; icon: Component };

const tabs = computed<Tab[]>(() => [
  { label: t("nav.home"), to: (id) => `/t/${id}`, icon: HomeFilled },
  { label: t("nav.itinerary"), to: (id) => `/t/${id}/itinerary`, icon: Calendar },
  { label: t("nav.expenses"), to: (id) => `/t/${id}/expenses`, icon: Money },
  { label: t("nav.wallet"), to: (id) => `/t/${id}/wallet`, icon: Wallet },
  { label: t("nav.settlement"), to: (id) => `/t/${id}/settlement`, icon: ScaleToOriginal },
]);

function isActive(path: string) {
  // If the path is exactly the home path (e.g., /t/123), it should only match exactly
  if (path === `/t/${tripId.value}`) {
    return route.path === path || route.path === path + "/";
  }
  // Otherwise, active if current route path starts with the tab path
  return route.path === path || route.path.startsWith(path + "/");
}

async function go(path: string) {
  if (route.path !== path) await router.push(path);
}
</script>

<template>
  <div class="min-h-[100svh] w-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
    <!-- Content -->
    <main class="mx-auto max-w-md px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] animate-fade-in-up">
      <RouterView />
    </main>

    <!-- Bottom Tabs with Glassmorphism -->
    <nav
      class="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style="padding-bottom: env(safe-area-inset-bottom)"
    >
      <div class="mx-auto max-w-md px-4 pb-4 pt-2">
        <div class="glass flex items-center justify-between rounded-3xl px-2 py-2 pointer-events-auto shadow-2xl shadow-black/50">
          <button
            v-for="tab in tabs"
            :key="tab.label"
            class="group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-all duration-300 ease-out active:scale-95 focus-visible:outline-none"
            :class="isActive(tab.to(tripId)) ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'"
            @click="go(tab.to(tripId))"
          >
            <!-- Active Indicator Background -->
            <div
              class="absolute inset-0 rounded-2xl transition-all duration-300"
              :class="isActive(tab.to(tripId)) ? 'bg-emerald-400/10 scale-100 opacity-100' : 'scale-75 opacity-0 group-hover:bg-zinc-800/50 group-hover:scale-100 group-hover:opacity-100'"
            ></div>
            
            <el-icon class="relative z-10 text-xl transition-transform duration-300" :class="isActive(tab.to(tripId)) ? 'scale-110' : ''">
              <component :is="tab.icon" />
            </el-icon>
            
            <span class="relative z-10 text-[10px] sm:text-xs font-medium tracking-wide transition-all duration-300 w-full truncate px-1 text-center"
                  :class="isActive(tab.to(tripId)) ? 'opacity-100' : 'opacity-70'">
              {{ tab.label }}
            </span>
          </button>
        </div>
      </div>
    </nav>
  </div>
</template>
