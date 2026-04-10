<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { getTripMembers, type TripMember } from "../api/tripMembers";
import { getTrip } from "../api/trips";
import { useTripAccess } from "../composables/useTripAccess";
import { useSessionStore } from "../stores/session";

const route = useRoute();
const session = useSessionStore();
const { isOwner } = useTripAccess();

const tripId = computed(() => String(route.params.tripId || ""));
const tripTitle = ref("");
const tripLoading = ref(false);
const tripErrorMsg = ref("");
const members = ref<TripMember[]>([]);
const membersLoading = ref(false);
const membersErrorMsg = ref("");
const copyFeedback = ref("");
const copyErrorMsg = ref("");

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
    tripErrorMsg.value = e?.response?.data?.message ?? e?.message ?? "Load trip failed";
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
    membersErrorMsg.value = e?.response?.data?.message ?? e?.message ?? "Load members failed";
  } finally {
    membersLoading.value = false;
  }
}

async function copyInviteLink() {
  copyFeedback.value = "";
  copyErrorMsg.value = "";

  const tripToken = getCurrentTripToken();
  if (!tripId.value || !tripToken) {
    copyErrorMsg.value = "Invite token is unavailable on this device.";
    return;
  }

  if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
    copyErrorMsg.value = "Clipboard is unavailable in this browser.";
    return;
  }

  try {
    const nextInviteLink = `${window.location.origin}/t/${tripId.value}/join?token=${encodeURIComponent(tripToken)}`;
    await navigator.clipboard.writeText(nextInviteLink);
    copyFeedback.value = "Invite link copied.";
  } catch (e: any) {
    copyErrorMsg.value = e?.message ?? "Copy invite link failed";
  }
}

onMounted(() => {
  void loadTrip();
  void loadMembers();
});
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold">Trip Home</h1>
    <p class="mt-2 text-sm text-zinc-400">tripId: {{ tripId }}</p>

    <div class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <div class="text-sm text-zinc-400">Title</div>
      <div v-if="tripLoading" class="mt-1 text-lg text-zinc-400">Loading...</div>
      <div v-else class="mt-1 text-lg">{{ tripTitle || "-" }}</div>
      <p v-if="tripErrorMsg" class="mt-3 text-sm text-red-300">{{ tripErrorMsg }}</p>
    </div>

    <div class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm text-zinc-400">Invite</div>
          <div class="mt-1 text-sm text-zinc-300">
            Owner can copy the existing join link from this device.
          </div>
        </div>
        <button
          v-if="canCopyInviteLink"
          class="rounded-xl bg-white px-3 py-2 text-sm font-medium text-zinc-900"
          @click="copyInviteLink"
        >
          Copy Invite Link
        </button>
      </div>

      <p v-if="canCopyInviteLink && inviteLink" class="mt-3 break-all text-xs text-zinc-500">
        {{ inviteLink }}
      </p>
      <p v-else class="mt-3 text-sm text-zinc-500">
        Invite link is available only when this device has the trip token and owner access.
      </p>

      <p v-if="copyFeedback" class="mt-3 text-sm text-emerald-300">{{ copyFeedback }}</p>
      <p v-if="copyErrorMsg" class="mt-3 text-sm text-red-300">{{ copyErrorMsg }}</p>
    </div>

    <div class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <div class="text-sm text-zinc-400">Members</div>

      <div v-if="membersLoading" class="mt-3 text-sm text-zinc-300">Loading members...</div>

      <div v-else-if="members.length" class="mt-3 space-y-2">
        <div
          v-for="member in members"
          :key="member.id"
          class="flex items-center justify-between gap-3 rounded-xl bg-zinc-950 px-3 py-3 ring-1 ring-zinc-800"
        >
          <span class="text-sm text-zinc-100">{{ member.nickname }}</span>
          <span
            v-if="member.role === 'owner'"
            class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-300"
          >
            Owner
          </span>
        </div>
      </div>

      <p v-else-if="!membersErrorMsg" class="mt-3 text-sm text-zinc-500">No members found.</p>

      <div v-if="membersErrorMsg" class="mt-3">
        <p class="text-sm text-red-300">{{ membersErrorMsg }}</p>
        <button
          class="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-medium text-zinc-900"
          @click="loadMembers"
        >
          Retry Members
        </button>
      </div>
    </div>

    <div class="mt-4 grid gap-3">
      <a
        class="block rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800"
        :href="`/t/${tripId}/notes`"
      >
        <div class="text-sm text-zinc-400">Notes</div>
        <div class="mt-1">Trip guidelines & reminders</div>
      </a>
    </div>
  </div>
</template>
