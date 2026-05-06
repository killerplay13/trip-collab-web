<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { joinTrip } from "../api/trips";
import { useSessionStore } from "../stores/session";
import { useToast } from "../composables/useToast";

import { useI18n } from "vue-i18n";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const { t } = useI18n();
const toast = useToast();

const tripId = computed(() => String(route.params.tripId || ""));
const existingAccess = computed(() => {
  if (!tripId.value) return null;
  return session.getTripAccess(tripId.value);
});
const inviteToken = computed(() => {
  if (typeof route.query.token === "string" && route.query.token.trim()) {
    return route.query.token.trim();
  }
  return session.getTripToken(tripId.value) ?? "";
});
const nickname = ref("");
const isJoining = ref(false);
const errorMsg = ref("");

const defaultRedirect = computed(() => `/t/${tripId.value}/itinerary`);
const redirectTarget = computed(() => {
  const raw = typeof route.query.redirect === "string" ? route.query.redirect : "";
  if (raw.startsWith(`/t/${tripId.value}`) && !raw.startsWith(`/t/${tripId.value}/join`)) {
    return raw;
  }
  return defaultRedirect.value;
});
const shouldAutoRedirect = computed(() => Boolean(existingAccess.value?.memberToken));

if (shouldAutoRedirect.value) {
  void router.replace(redirectTarget.value);
}

async function handleJoin() {
  if (isJoining.value) return;
  errorMsg.value = "";

  const trimmedNickname = nickname.value.trim();
  if (!inviteToken.value) {
    errorMsg.value = t('join.errorMissingToken');
    return;
  }
  if (!trimmedNickname) {
    errorMsg.value = t('join.errorNicknameRequired');
    return;
  }

  isJoining.value = true;
  try {
    const access = await joinTrip(tripId.value, inviteToken.value, {
      nickname: trimmedNickname,
    });

    session.setTripAccess(access.tripId, {
      memberToken: access.memberToken,
      memberId: access.memberId ?? null,
      role: access.role ?? null,
      nickname: access.nickname ?? trimmedNickname,
      joinedAt: access.joinedAt ?? null,
      tripToken: inviteToken.value || null,
    });

    toast.success(t('common.toast.success'));
    await router.replace(redirectTarget.value);
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? t('join.errorJoinFailed');
    errorMsg.value = msg;
    toast.error(msg);
  } finally {
    isJoining.value = false;
  }
}
</script>

<template>
  <div class="min-h-dvh bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950 text-zinc-100 flex flex-col justify-center pb-12">
    <div class="mx-auto w-full max-w-md px-4 py-8">
      <!-- Header -->
      <div class="text-center mb-8 animate-fade-in-up">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4 ring-4 ring-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
        </div>
        <h1 class="text-3xl font-bold tracking-tight text-gradient-primary">{{ $t('join.title') }}</h1>
        <p class="mt-2 text-sm text-zinc-400 max-w-[250px] mx-auto leading-relaxed">
          {{ shouldAutoRedirect ? $t('join.existingAccess') : $t('join.enterNickname') }}
        </p>
      </div>

      <!-- Form Card -->
      <div class="glass-card p-6 sm:p-8 animate-fade-in-up" style="animation-delay: 100ms;">
        <div v-if="shouldAutoRedirect" class="flex flex-col items-center justify-center py-4">
          <svg class="w-8 h-8 animate-spin text-emerald-500 mb-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <div class="text-sm font-medium text-zinc-400">{{ $t('join.tripId') }}</div>
          <div class="mt-1 font-mono text-sm text-zinc-200">{{ tripId }}</div>
        </div>

        <template v-else>
          <div class="space-y-6">
            <!-- Trip ID Info -->
            <div class="rounded-xl bg-zinc-900/50 p-4 ring-1 ring-zinc-800/50 flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-800 shrink-0">
                <svg class="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium text-zinc-500 uppercase tracking-wider">{{ $t('join.tripId') }}</div>
                <div class="mt-0.5 truncate font-mono text-sm font-semibold text-zinc-200">{{ tripId }}</div>
              </div>
            </div>

            <!-- Nickname Input -->
            <label class="block group">
              <div class="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-1.5 transition-colors group-focus-within:text-emerald-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                {{ $t('join.nickname') }}
              </div>
              <input
                v-model="nickname"
                maxlength="50"
                :placeholder="$t('join.nicknamePlaceholder')"
                class="w-full rounded-xl bg-zinc-900/50 px-4 py-3 text-base outline-none ring-1 ring-zinc-800 transition-all hover:ring-zinc-700 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/50 placeholder:text-zinc-600"
                @keyup.enter="handleJoin"
              />
            </label>

            <!-- Error Alert -->
            <div v-if="errorMsg || !inviteToken" class="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20 flex items-start gap-3 animate-fade-in-up" style="animation-duration: 0.3s;">
              <svg class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <div class="text-sm font-medium text-amber-300 leading-relaxed">
                <p v-if="!inviteToken">{{ $t('join.missingToken') }}</p>
                <p v-if="errorMsg">{{ errorMsg }}</p>
              </div>
            </div>

            <!-- Submit Button -->
            <button
              :disabled="isJoining || !inviteToken"
              @click="handleJoin"
              class="group relative mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0"
            >
              <div v-if="isJoining" class="absolute inset-0 flex items-center justify-center bg-emerald-600">
                <svg class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </div>
              <span :class="{ 'opacity-0': isJoining }">{{ $t('join.submit') }}</span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
