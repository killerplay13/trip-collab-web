<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { joinTrip } from "../api/trips";
import { useSessionStore } from "../stores/session";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

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
const loading = ref(false);
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
  errorMsg.value = "";

  const trimmedNickname = nickname.value.trim();
  if (!inviteToken.value) {
    errorMsg.value = "Missing invite token";
    return;
  }
  if (!trimmedNickname) {
    errorMsg.value = "Nickname is required";
    return;
  }

  loading.value = true;
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

    await router.replace(redirectTarget.value);
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message ?? e?.message ?? "Join trip failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-dvh bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-md px-4 py-6">
      <h1 class="text-xl font-semibold">Join Trip</h1>
      <p class="mt-1 text-sm text-zinc-400">
        {{ shouldAutoRedirect ? "Existing access found. Redirecting..." : "Enter a nickname to access this trip." }}
      </p>

      <div v-if="shouldAutoRedirect" class="mt-6 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
        <div class="text-sm text-zinc-400">Trip ID</div>
        <div class="mt-1 break-all text-sm text-zinc-200">{{ tripId }}</div>
      </div>

      <template v-else>
        <div class="mt-6 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
          <div class="text-sm text-zinc-400">Trip ID</div>
          <div class="mt-1 break-all text-sm text-zinc-200">{{ tripId }}</div>
        </div>

        <div class="mt-4 space-y-4">
          <label class="block">
            <div class="text-sm text-zinc-300">Nickname</div>
            <input
              v-model="nickname"
              maxlength="50"
              placeholder="Your name"
              class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
              @keyup.enter="handleJoin"
            />
          </label>

          <button
            :disabled="loading || !inviteToken"
            class="w-full rounded-xl bg-white px-4 py-2 font-medium text-zinc-900 disabled:opacity-60"
            @click="handleJoin"
          >
            {{ loading ? "Joining..." : "Join & Enter" }}
          </button>

          <p v-if="!inviteToken" class="text-sm text-amber-300">Invite token is missing from this link.</p>
          <p v-if="errorMsg" class="text-sm text-red-300">{{ errorMsg }}</p>
        </div>
      </template>
    </div>
  </div>
</template>
