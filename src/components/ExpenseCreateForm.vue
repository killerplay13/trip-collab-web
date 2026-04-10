<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{
  expenseDate: string;
  members?: Array<{
    memberId: string;
    name: string;
  }>;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: "submit", payload: {
    title: string;
    amount: number;
    expenseDate: string;
    paidByMemberId: string;
    participantMemberIds: string[];
  }): void;
  (e: "cancel"): void;
}>();

const title = ref("");
const amount = ref("");
const expenseDate = ref(props.expenseDate);
const paidByMemberId = ref("");
const participantMemberIds = ref<string[]>([]);
const memberOptions = computed(() => props.members ?? []);
const isAmountValid = computed(() => {
  const parsedAmount = Number(amount.value);
  return Number.isFinite(parsedAmount) && parsedAmount > 0;
});
const isFormValid = computed(() => {
  return (
    Boolean(title.value.trim()) &&
    isAmountValid.value &&
    Boolean(expenseDate.value.trim()) &&
    Boolean(paidByMemberId.value.trim()) &&
    participantMemberIds.value.length > 0
  );
});

watch(
  () => props.expenseDate,
  (value) => {
    expenseDate.value = value;
  },
);

watch(
  memberOptions,
  (members) => {
    const ids = members.map((member) => member.memberId);
    if (!ids.includes(paidByMemberId.value)) {
      paidByMemberId.value = ids[0] ?? "";
    }
    participantMemberIds.value = participantMemberIds.value.filter((id) => ids.includes(id));
    if (participantMemberIds.value.length === 0) {
      participantMemberIds.value = [...ids];
    }
  },
  { immediate: true },
);

function toggleParticipant(memberId: string, checked: boolean) {
  if (checked) {
    participantMemberIds.value = Array.from(new Set([...participantMemberIds.value, memberId]));
    return;
  }
  participantMemberIds.value = participantMemberIds.value.filter((id) => id !== memberId);
}

function onParticipantChange(memberId: string, event: Event) {
  const checked = (event.target as HTMLInputElement | null)?.checked ?? false;
  toggleParticipant(memberId, checked);
}

function submit() {
  if (!title.value.trim()) return;
  if (!(Number(amount.value) > 0)) return;

  const parsedAmount = Number(amount.value);
  if (!isAmountValid.value) return;
  if (!expenseDate.value.trim()) return;
  if (!paidByMemberId.value.trim()) return;

  const nextParticipantMemberIds = Array.from(
    new Set([...participantMemberIds.value, paidByMemberId.value]),
  ).filter(Boolean);
  if (nextParticipantMemberIds.length === 0) return;

  emit("submit", {
    title: title.value.trim(),
    amount: parsedAmount,
    expenseDate: expenseDate.value,
    paidByMemberId: paidByMemberId.value,
    participantMemberIds: nextParticipantMemberIds,
  });
}
</script>

<template>
  <div class="space-y-4">
    <label class="block">
      <div class="text-sm text-zinc-300">Title *</div>
      <input
        v-model="title"
        placeholder="e.g., Dinner"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
        @keyup.enter="submit"
      />
      <p v-if="!title.trim()" class="mt-1 text-xs text-zinc-500">Required</p>
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">Amount *</div>
      <input
        v-model="amount"
        type="number"
        min="0"
        step="0.01"
        placeholder="0"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
      <p v-if="!(Number(amount) > 0)" class="mt-1 text-xs text-zinc-500">Required</p>
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">Date *</div>
      <input
        v-model="expenseDate"
        type="date"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">Paid by *</div>
      <select
        v-model="paidByMemberId"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting || memberOptions.length === 0"
      >
        <option value="" disabled>Select a member</option>
        <option
          v-for="member in memberOptions"
          :key="member.memberId"
          :value="member.memberId"
        >
          {{ member.name }}
        </option>
      </select>
      <p v-if="!paidByMemberId.trim()" class="mt-1 text-xs text-zinc-500">Required</p>
    </label>

    <div class="block">
      <div class="text-sm text-zinc-300">Participants *</div>
      <div class="mt-1 space-y-2 rounded-xl bg-zinc-900 px-3 py-3 ring-1 ring-zinc-800">
        <label
          v-for="member in memberOptions"
          :key="member.memberId"
          class="flex items-center gap-2 text-sm text-zinc-200"
        >
          <input
            :checked="participantMemberIds.includes(member.memberId)"
            type="checkbox"
            class="rounded border-zinc-700 bg-zinc-950"
            :disabled="submitting"
            @change="onParticipantChange(member.memberId, $event)"
          />
          <span>{{ member.name }}</span>
        </label>
        <p v-if="memberOptions.length === 0" class="text-xs text-zinc-500">
          No members available for this trip yet.
        </p>
      </div>
      <p v-if="participantMemberIds.length === 0" class="mt-1 text-xs text-zinc-500">Select at least one member</p>
    </div>

    <div class="flex gap-2 pt-1">
      <button
        class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium ring-1 ring-zinc-800"
        :disabled="submitting"
        @click="$emit('cancel')"
      >
        Cancel
      </button>
      <button
        class="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
        :disabled="submitting || !isFormValid"
        @click="submit"
      >
        {{ submitting ? "Saving..." : "Save" }}
      </button>
    </div>
  </div>
</template>
