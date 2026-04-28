<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import BottomSheet from "../components/BottomSheet.vue";
import { getTripMembers, updateTripMember, type TripMember } from "../api/tripMembers";
import { getTrip, updateTrip } from "../api/trips";
import { useTripAccess } from "../composables/useTripAccess";
import { useSessionStore } from "../stores/session";

const route = useRoute();
const session = useSessionStore();
const { isOwner } = useTripAccess();
const { t, locale } = useI18n();

const tripId = computed(() => String(route.params.tripId || ""));
const tripTitle = ref("");
const tripLoading = ref(false);
const tripErrorMsg = ref("");
const members = ref<TripMember[]>([]);
const membersLoading = ref(false);
const membersErrorMsg = ref("");
const copyFeedback = ref("");
const copyErrorMsg = ref("");
const settingsOpen = ref(false);

const editTripTitle = ref("");
const editNickname = ref("");
const savingTrip = ref(false);
const savingNickname = ref(false);
const settingsErrorMsg = ref("");

function openSettings() {
  editTripTitle.value = tripTitle.value;
  const access = session.getTripAccess(tripId.value);
  const me = members.value.find(m => m.nickname === access?.nickname);
  editNickname.value = me?.nickname || "";
  settingsErrorMsg.value = "";
  settingsOpen.value = true;
}

async function handleSaveNickname() {
  const access = session.getTripAccess(tripId.value);
  const me = members.value.find(m => m.nickname === access?.nickname);
  if (!tripId.value || !me?.id) return;
  savingNickname.value = true;
  settingsErrorMsg.value = "";
  try {
    await updateTripMember(tripId.value, me.id, { nickname: editNickname.value });
    // Update local session
    if (access) {
      session.setTripAccess(tripId.value, { ...access, nickname: editNickname.value });
    }
    await loadMembers();
  } catch (e: any) {
    settingsErrorMsg.value = e?.response?.data?.message ?? e?.message ?? "Failed to update nickname";
  } finally {
    savingNickname.value = false;
  }
}

async function handleSaveTrip() {
  if (!tripId.value) return;
  savingTrip.value = true;
  settingsErrorMsg.value = "";
  try {
    const trip = await updateTrip(tripId.value, { title: editTripTitle.value });
    tripTitle.value = trip.title;
  } catch (e: any) {
    settingsErrorMsg.value = e?.response?.data?.message ?? e?.message ?? "Failed to update trip";
  } finally {
    savingTrip.value = false;
  }
}

function setLanguage(lang: string) {
  locale.value = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem('trip_collab_locale', lang);
  }
}

function getCurrentTripToken() {
  if (!tripId.value) return "";
  return session.getTripToken(tripId.value) ?? "";
}

const canCopyInviteLink = computed(() => {
  return isOwner.value && Boolean(getCurrentTripToken());
});

const inviteLink = computed(() => {
  const tripToken = getCurrentTripToken();
  if (!tripId.value || !tripToken || typeof window === "undefined") return "";
  return `${window.location.origin}/t/${tripId.value}/join?token=${encodeURIComponent(tripToken)}`;
});

async function loadTrip() {
  if (!tripId.value) return;
  tripLoading.value = true;
  tripErrorMsg.value = "";
  try {
    const trip = await getTrip(tripId.value);
    tripTitle.value = trip.title;
  } catch (e: any) {
    tripTitle.value = "";
    tripErrorMsg.value = e?.response?.data?.message ?? e?.message ?? t('home.loadTripFailed');
  } finally {
    tripLoading.value = false;
  }
}

async function loadMembers() {
  if (!tripId.value) return;
  membersLoading.value = true;
  membersErrorMsg.value = "";
  try {
    const nextMembers = await getTripMembers(tripId.value);
    members.value = Array.isArray(nextMembers) ? nextMembers : [];
  } catch (e: any) {
    members.value = [];
    membersErrorMsg.value = e?.response?.data?.message ?? e?.message ?? t('home.loadMembersFailed');
  } finally {
    membersLoading.value = false;
  }
}

async function copyInviteLink() {
  copyFeedback.value = "";
  copyErrorMsg.value = "";

  const tripToken = getCurrentTripToken();
  if (!tripId.value || !tripToken) {
    copyErrorMsg.value = t('home.tokenUnavailable');
    return;
  }

  if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
    copyErrorMsg.value = t('home.clipboardUnavailable');
    return;
  }

  try {
    const nextInviteLink = `${window.location.origin}/t/${tripId.value}/join?token=${encodeURIComponent(tripToken)}`;
    await navigator.clipboard.writeText(nextInviteLink);
    copyFeedback.value = t('home.inviteCopied');
  } catch (e: any) {
    copyErrorMsg.value = e?.message ?? t('home.copyFailed');
  }
}

onMounted(() => {
  void loadTrip();
  void loadMembers();
});
</script>

<template>
  <div class="pb-6">
    <div class="flex flex-col items-center pt-6 pb-8 text-center animate-fade-in-up relative">
      <button 
        class="absolute top-6 right-4 w-10 h-10 rounded-full bg-zinc-900/50 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors border border-zinc-800 shadow-md"
        @click="openSettings"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
      </button>
      <h1 class="text-3xl font-bold tracking-tight text-gradient">{{ $t('home.dashboard') }}</h1>
      <p class="mt-2 text-xs font-mono text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800">ID: {{ tripId }}</p>
    </div>

    <!-- Title Card -->
    <div class="glass-card p-5 mb-5 animate-fade-in-up" style="animation-delay: 50ms;">
      <div class="text-xs font-semibold tracking-wider text-emerald-400 uppercase mb-2 flex items-center gap-2">
        <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
        {{ $t('home.tripTitle') }}
      </div>
      <div v-if="tripLoading" class="mt-1 h-8 w-3/4 rounded bg-zinc-800 animate-pulse"></div>
      <div v-else class="text-2xl font-medium text-zinc-100">{{ tripTitle || $t('home.untitledTrip') }}</div>
      <p v-if="tripErrorMsg" class="mt-3 text-sm text-red-400 bg-red-400/10 p-2 rounded-lg border border-red-400/20">{{ tripErrorMsg }}</p>
    </div>

    <!-- Invite Card -->
    <div class="glass-card p-5 mb-5 animate-fade-in-up" style="animation-delay: 100ms;">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="text-xs font-semibold tracking-wider text-blue-400 uppercase mb-1">{{ $t('home.inviteMembers') }}</div>
          <div class="text-sm text-zinc-400 leading-relaxed">
            {{ $t('home.inviteDesc') }}
          </div>
        </div>
        <button
          v-if="canCopyInviteLink"
          class="shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95 hover:shadow-blue-500/40"
          @click="copyInviteLink"
        >
          <span>{{ $t('home.copyLink') }}</span>
        </button>
      </div>

      <div v-if="canCopyInviteLink && inviteLink" class="mt-4 p-3 rounded-xl bg-black/40 border border-zinc-800/50 font-mono text-[10px] text-zinc-500 break-all">
        {{ inviteLink }}
      </div>
      <p v-else-if="!canCopyInviteLink" class="mt-4 text-xs text-zinc-500 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
        {{ $t('home.ownerOnlyCopy') }}
      </p>

      <div v-if="copyFeedback" class="mt-3 text-xs font-medium text-emerald-400 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        {{ copyFeedback }}
      </div>
      <p v-if="copyErrorMsg" class="mt-3 text-sm text-red-400 bg-red-400/10 p-2 rounded-lg border border-red-400/20">{{ copyErrorMsg }}</p>
    </div>

    <!-- Members Card -->
    <div class="glass-card p-5 mb-5 animate-fade-in-up" style="animation-delay: 150ms;">
      <div class="text-xs font-semibold tracking-wider text-purple-400 uppercase mb-4">{{ $t('home.tripMembers') }}</div>

      <div v-if="membersLoading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-12 rounded-xl bg-zinc-800/50 animate-pulse border border-zinc-800"></div>
      </div>

      <div v-else-if="members.length" class="space-y-2">
        <div
          v-for="member in members"
          :key="member.id"
          class="group flex items-center justify-between gap-3 rounded-xl bg-zinc-900/40 px-4 py-3 border border-zinc-800/50 transition-colors hover:bg-zinc-800/60 hover:border-zinc-700"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
              {{ member.nickname.charAt(0).toUpperCase() }}
            </div>
            <span class="text-sm font-medium text-zinc-200">{{ member.nickname }}</span>
          </div>
          <span
            v-if="member.role === 'owner'"
            class="rounded-full bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.1)]"
          >
            {{ $t('home.owner') }}
          </span>
        </div>
      </div>

      <div v-else-if="!membersErrorMsg" class="py-6 text-center text-sm text-zinc-500">
        {{ $t('home.noMembers') }}
      </div>

      <div v-if="membersErrorMsg" class="mt-3">
        <p class="text-sm text-red-400 bg-red-400/10 p-2 rounded-lg border border-red-400/20">{{ membersErrorMsg }}</p>
        <button
          class="mt-3 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 active:scale-95"
          @click="loadMembers"
        >
          {{ $t('home.retryLoading') }}
        </button>
      </div>
    </div>

    <!-- Notes Navigation -->
    <div class="grid gap-3 animate-fade-in-up" style="animation-delay: 200ms;">
      <a
        class="group glass-card flex items-center justify-between p-5 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-zinc-900/50 hover:border-zinc-600"
        :href="`/t/${tripId}/notes`"
      >
        <div>
          <div class="text-xs font-semibold tracking-wider text-amber-400 uppercase mb-1">{{ $t('home.notes') }}</div>
          <div class="text-sm font-medium text-zinc-300">{{ $t('home.notesDesc') }}</div>
        </div>
        <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 transition-transform group-hover:bg-amber-400/10 group-hover:text-amber-400 group-hover:translate-x-1">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
        </div>
      </a>
    </div>

    <!-- Settings Bottom Sheet -->
    <BottomSheet :open="settingsOpen" :title="$t('settings.title')" @close="settingsOpen = false">
      <div class="space-y-6 pb-4">
        
        <div v-if="settingsErrorMsg" class="rounded-xl bg-red-400/10 p-3 ring-1 ring-red-400/20">
          <p class="text-sm font-medium text-red-400">{{ settingsErrorMsg }}</p>
        </div>

        <!-- Language -->
        <div>
          <div class="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
            <svg class="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
            {{ $t('settings.language') }}
          </div>
          <div class="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            <button 
              class="flex-1 py-2.5 text-sm rounded-lg font-bold transition-all" 
              :class="locale === 'en' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'"
              @click="setLanguage('en')"
            >
              English
            </button>
            <button 
              class="flex-1 py-2.5 text-sm rounded-lg font-bold transition-all" 
              :class="locale === 'zh-TW' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'"
              @click="setLanguage('zh-TW')"
            >
              繁體中文
            </button>
          </div>
        </div>

        <!-- Profile -->
        <div>
          <div class="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
            <svg class="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            {{ $t('settings.profile') }}
          </div>
          <div class="glass-card p-4">
            <label class="block">
              <div class="text-xs text-zinc-500 mb-1 font-medium">{{ $t('settings.nickname') }}</div>
              <input type="text" v-model="editNickname" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
            <button 
              class="mt-3 w-full py-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors hover:bg-emerald-500/30 active:scale-95 disabled:opacity-50"
              :disabled="savingNickname || !editNickname.trim()"
              @click="handleSaveNickname"
            >
              {{ savingNickname ? '...' : $t('settings.save') }}
            </button>
          </div>
        </div>

        <!-- Trip Settings -->
        <div v-if="isOwner">
          <div class="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
            <svg class="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
            {{ $t('settings.tripInfo') }}
          </div>
          <div class="glass-card p-4">
            <label class="block">
              <div class="text-xs text-zinc-500 mb-1 font-medium">{{ $t('settings.tripName') }}</div>
              <input type="text" v-model="editTripTitle" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </label>
            <button 
              class="mt-3 w-full py-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors hover:bg-emerald-500/30 active:scale-95 disabled:opacity-50"
              :disabled="savingTrip || !editTripTitle.trim()"
              @click="handleSaveTrip"
            >
              {{ savingTrip ? '...' : $t('settings.save') }}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>
