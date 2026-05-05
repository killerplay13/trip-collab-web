<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { createTrip } from "../api/trips";
import { useSessionStore } from "../stores/session";

import { useI18n } from "vue-i18n";

const router = useRouter();
const session = useSessionStore();
const { t } = useI18n();

const title = ref("Tottori & Okayama");
const timezone = ref("Asia/Taipei");
const startDate = ref("2026-02-10");
const endDate = ref("2026-02-14");
const notes = ref("v0.1 backend milestone");
const creatorNickname = ref("");
const currency = ref("TWD");

const availableCurrencies = computed(() => [
  { code: "TWD", label: t('currencies.TWD') },
  { code: "USD", label: t('currencies.USD') },
  { code: "JPY", label: t('currencies.JPY') },
  { code: "EUR", label: t('currencies.EUR') },
  { code: "KRW", label: t('currencies.KRW') },
]);

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
      nickname: creatorNickname.value || t('create.nicknamePlaceholder'),
      currency: currency.value,
    });

    if (!trip.inviteToken) {
      throw new Error("API did not return inviteToken");
    }
    if (!trip.memberToken) {
      throw new Error("API did not return memberToken");
    }

    session.setTripAccess(trip.id, {
      memberToken: trip.memberToken,
      memberId: trip.memberId ?? null,
      role: trip.role ?? "owner",
      nickname: trip.nickname ?? creatorNickname.value,
      tripToken: trip.inviteToken,
    });
    
    await router.push(`/t/${trip.id}`);
  } catch (e: any) {
    errorMsg.value = e?.message ?? t('create.error');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-dvh bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950 text-zinc-100 pb-12">
    <div class="mx-auto max-w-md px-4 py-8">
      <!-- Header -->
      <div class="text-center mb-8 animate-fade-in-up">
        <h1 class="text-3xl font-bold tracking-tight text-gradient-primary">{{ $t('create.title') }}</h1>
        <p class="mt-2 text-sm text-zinc-400 max-w-[250px] mx-auto leading-relaxed">
          {{ $t('create.subtitle') }}
        </p>
      </div>

      <!-- Form Card -->
      <div class="glass-card p-6 sm:p-8 space-y-5 animate-fade-in-up" style="animation-delay: 100ms;">
        <!-- Title -->
        <label class="block group">
          <div class="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5 transition-colors group-focus-within:text-emerald-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            {{ $t('create.formTitle') }}
          </div>
          <input
            v-model="title"
            class="w-full rounded-xl bg-zinc-900/50 px-4 py-3 text-base outline-none ring-1 ring-zinc-800 transition-all hover:ring-zinc-700 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/50 placeholder:text-zinc-600"
          />
        </label>

        <!-- Nickname -->
        <label class="block group">
          <div class="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5 transition-colors group-focus-within:text-emerald-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            {{ $t('create.nickname') }}
          </div>
          <input
            v-model="creatorNickname"
            :placeholder="$t('create.nicknamePlaceholder')"
            class="w-full rounded-xl bg-zinc-900/50 px-4 py-3 text-base outline-none ring-1 ring-zinc-800 transition-all hover:ring-zinc-700 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/50 placeholder:text-zinc-600"
          />
        </label>

        <!-- Dates Row -->
        <div class="grid grid-cols-2 gap-4">
          <label class="block group">
            <div class="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5 transition-colors group-focus-within:text-emerald-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              {{ $t('create.startDate') }}
            </div>
            <input
              type="date"
              v-model="startDate"
              class="w-full rounded-xl bg-zinc-900/50 px-3 py-3 text-base outline-none ring-1 ring-zinc-800 transition-all hover:ring-zinc-700 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/50 color-scheme-dark"
              style="color-scheme: dark;"
            />
          </label>
          <label class="block group">
            <div class="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5 transition-colors group-focus-within:text-emerald-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              {{ $t('create.endDate') }}
            </div>
            <input
              type="date"
              v-model="endDate"
              class="w-full rounded-xl bg-zinc-900/50 px-3 py-3 text-base outline-none ring-1 ring-zinc-800 transition-all hover:ring-zinc-700 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/50 color-scheme-dark"
              style="color-scheme: dark;"
            />
          </label>
        </div>

        <!-- Notes -->
        <label class="block group">
          <div class="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5 transition-colors group-focus-within:text-emerald-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
            {{ $t('create.notes') }}
          </div>
          <textarea
            v-model="notes"
            rows="3"
            class="w-full rounded-xl bg-zinc-900/50 px-4 py-3 text-base outline-none ring-1 ring-zinc-800 transition-all hover:ring-zinc-700 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/50 placeholder:text-zinc-600 resize-none"
          ></textarea>
        </label>

        <!-- Currency -->
        <label class="block group">
          <div class="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5 transition-colors group-focus-within:text-emerald-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {{ $t('create.currency') }}
          </div>
          <div class="relative">
            <select
              v-model="currency"
              class="w-full appearance-none rounded-xl bg-zinc-900/50 px-4 py-3 pr-10 text-base outline-none ring-1 ring-zinc-800 transition-all hover:ring-zinc-700 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/50"
            >
              <option v-for="c in availableCurrencies" :key="c.code" :value="c.code" class="bg-zinc-900">
                {{ c.label }}
              </option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </label>

        <!-- Error Alert -->
        <div v-if="errorMsg" class="rounded-xl bg-red-500/10 p-4 border border-red-500/20 flex items-start gap-3 animate-fade-in-up" style="animation-duration: 0.3s;">
          <svg class="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <p class="text-sm font-medium text-red-300 leading-relaxed">{{ errorMsg }}</p>
        </div>

        <!-- Submit Button -->
        <button
          :disabled="loading"
          @click="handleCreate"
          class="group relative mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0"
        >
          <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-emerald-600">
            <svg class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
          <span :class="{ 'opacity-0': loading }">{{ $t('create.submit') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
