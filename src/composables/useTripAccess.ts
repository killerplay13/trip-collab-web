import { computed } from "vue";
import { useRoute } from "vue-router";
import { useSessionStore } from "../stores/session";

export function useTripAccess() {
  const route = useRoute();
  const session = useSessionStore();

  const tripId = computed(() => String(route.params.tripId || ""));
  const tripAccess = computed(() => {
    if (!tripId.value) return null;
    return session.getTripAccess(tripId.value);
  });
  const role = computed(() => tripAccess.value?.role ?? null);
  const isOwner = computed(() => role.value === "owner");
  const isMember = computed(() => Boolean(tripAccess.value?.memberToken));
  const canEditData = computed(() => isMember.value);
  const canDeleteData = computed(() => isOwner.value);
  const canReorderData = computed(() => isOwner.value);
  const canManageSettlement = computed(() => isOwner.value);

  return {
    tripId,
    tripAccess,
    role,
    isOwner,
    isMember,
    canEditData,
    canDeleteData,
    canReorderData,
    canManageSettlement,
  };
}
