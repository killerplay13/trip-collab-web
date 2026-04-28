<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { ExpenseItem } from "../api/expenses";

const props = defineProps<{
  expenseDate: string;
  members?: Array<{
    memberId: string;
    name: string;
  }>;
  submitting?: boolean;
  baseCurrency?: string;
  initialExpense?: ExpenseItem;
}>();

const emit = defineEmits<{
  (e: "submit", payload: {
    title: string;
    amount?: number;
    expenseDate: string;
    paidByMemberId: string;
    participantMemberIds: string[];
    originalAmount?: number;
    originalCurrency?: string;
    fxRate?: number;
  }): void;
  (e: "cancel"): void;
  (e: "delete"): void;
}>();

const isEditing = computed(() => !!props.initialExpense);

const title = ref(props.initialExpense?.title || "");
const amount = ref(props.initialExpense?.originalAmount ? String(props.initialExpense.originalAmount) : (props.initialExpense?.amount ? String(props.initialExpense.amount) : ""));
const expenseDate = ref(props.initialExpense?.expenseDate || props.expenseDate);
const paidByMemberId = ref(props.initialExpense?.paidByMemberId || "");
const participantMemberIds = ref<string[]>(props.initialExpense?.participantMemberIds || []);
const selectedCurrency = ref(props.initialExpense?.originalCurrency || props.baseCurrency || "TWD");
const fxRate = ref(props.initialExpense?.fxRate ? String(props.initialExpense.fxRate) : "");

const availableCurrencies = [
  { code: "TWD", label: "TWD - 台幣" },
  { code: "USD", label: "USD - 美金" },
  { code: "JPY", label: "JPY - 日幣" },
  { code: "EUR", label: "EUR - 歐元" },
  { code: "KRW", label: "KRW - 韓元" },
];
const memberOptions = computed(() => props.members ?? []);
const fetchingFxRate = ref(false);

async function fetchFxRate(from: string, to: string) {
  if (from === to) return "1";
  fetchingFxRate.value = true;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const data = await res.json();
    if (data && data.rates && data.rates[to]) {
      return String(data.rates[to]);
    }
  } catch (e) {
    console.error("Failed to fetch fx rate:", e);
  } finally {
    fetchingFxRate.value = false;
  }
  return "";
}

watch(
  [selectedCurrency, () => props.baseCurrency],
  async ([from, to], [oldFrom, oldTo]) => {
    const targetBase = to || "TWD";
    if (from !== targetBase) {
      if (!fxRate.value || from !== oldFrom || targetBase !== oldTo) {
        fxRate.value = await fetchFxRate(from, targetBase);
      }
    } else {
      fxRate.value = "";
    }
  },
  { immediate: true }
);

watch(
  () => props.initialExpense,
  (expense) => {
    if (expense) {
      title.value = expense.title;
      amount.value = expense.originalAmount ? String(expense.originalAmount) : String(expense.amount);
      expenseDate.value = expense.expenseDate;
      paidByMemberId.value = expense.paidByMemberId || "";
      participantMemberIds.value = expense.participantMemberIds || [];
      selectedCurrency.value = expense.originalCurrency || props.baseCurrency || "TWD";
      fxRate.value = expense.fxRate ? String(expense.fxRate) : "";
    } else {
      title.value = "";
      amount.value = "";
      expenseDate.value = props.expenseDate;
      paidByMemberId.value = "";
      participantMemberIds.value = [];
      selectedCurrency.value = props.baseCurrency || "TWD";
      fxRate.value = "";
    }
  }
);
const isAmountValid = computed(() => {
  const parsedAmount = Number(amount.value);
  return Number.isFinite(parsedAmount) && parsedAmount > 0;
});
const isFxRateValid = computed(() => {
  if (selectedCurrency.value === (props.baseCurrency || "TWD")) return true;
  const parsedRate = Number(fxRate.value);
  return Number.isFinite(parsedRate) && parsedRate > 0;
});
const isFormValid = computed(() => {
  return (
    Boolean(title.value.trim()) &&
    isAmountValid.value &&
    isFxRateValid.value &&
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

  const isForeign = selectedCurrency.value !== (props.baseCurrency || "TWD");

  emit("submit", {
    title: title.value.trim(),
    amount: isForeign ? undefined : parsedAmount,
    originalAmount: isForeign ? parsedAmount : undefined,
    originalCurrency: isForeign ? selectedCurrency.value : undefined,
    fxRate: isForeign ? Number(fxRate.value) : undefined,
    expenseDate: expenseDate.value,
    paidByMemberId: paidByMemberId.value,
    participantMemberIds: nextParticipantMemberIds,
  });
}
</script>

<template>
  <div class="space-y-4">
    <label class="block">
      <div class="text-sm text-zinc-300">{{ $t('expenses.titleRequired') }}</div>
      <input
        v-model="title"
        :placeholder="$t('expenses.titlePlaceholder')"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
        @keyup.enter="submit"
      />
      <p v-if="!title.trim()" class="mt-1 text-xs text-zinc-500">{{ $t('expenses.required') }}</p>
    </label>

    <div class="grid grid-cols-2 gap-4">
      <label class="block">
        <div class="text-sm text-zinc-300">Currency</div>
        <select
          v-model="selectedCurrency"
          class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          :disabled="submitting"
        >
          <option v-for="c in availableCurrencies" :key="c.code" :value="c.code">
            {{ c.code }} {{ c.code === (baseCurrency || 'TWD') ? '(Base)' : '' }}
          </option>
        </select>
      </label>

      <label class="block">
        <div class="text-sm text-zinc-300">{{ $t('expenses.amountRequired') }}</div>
        <input
          v-model="amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          :disabled="submitting"
        />
        <p v-if="!(Number(amount) > 0)" class="mt-1 text-xs text-zinc-500">{{ $t('expenses.required') }}</p>
      </label>
    </div>

    <label v-if="selectedCurrency !== (baseCurrency || 'TWD')" class="block">
      <div class="text-sm text-zinc-300">Exchange Rate (To {{ baseCurrency || 'TWD' }})</div>
      <div class="relative mt-1">
        <input
          v-model="fxRate"
          type="number"
          min="0"
          step="0.0001"
          placeholder="e.g. 0.22"
          class="w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-amber-500/50 focus:ring-2 transition-all"
          :disabled="submitting || fetchingFxRate"
        />
        <div v-if="fetchingFxRate" class="absolute right-3 top-2.5 text-xs text-amber-500 animate-pulse">Fetching...</div>
      </div>
      <p v-if="!(Number(fxRate) > 0)" class="mt-1 text-xs text-amber-500/80">Exchange rate is required for foreign currency</p>
      <p v-else-if="Number(amount) > 0" class="mt-1 text-xs text-zinc-400">
        ≈ {{ (Number(amount) * Number(fxRate)).toFixed(2) }} {{ baseCurrency || 'TWD' }}
      </p>
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">{{ $t('expenses.dateRequired') }}</div>
      <input
        v-model="expenseDate"
        type="date"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      />
    </label>

    <label class="block">
      <div class="text-sm text-zinc-300">{{ $t('expenses.paidByRequired') }}</div>
      <select
        v-model="paidByMemberId"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting || memberOptions.length === 0"
      >
        <option value="" disabled>{{ $t('expenses.selectMember') }}</option>
        <option
          v-for="member in memberOptions"
          :key="member.memberId"
          :value="member.memberId"
        >
          {{ member.name }}
        </option>
      </select>
      <p v-if="!paidByMemberId.trim()" class="mt-1 text-xs text-zinc-500">{{ $t('expenses.required') }}</p>
    </label>

    <div class="block">
      <div class="text-sm text-zinc-300">{{ $t('expenses.participants') }}</div>
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
          {{ $t('expenses.noMembersAvailable') }}
        </p>
      </div>
      <p v-if="participantMemberIds.length === 0" class="mt-1 text-xs text-zinc-500">{{ $t('expenses.selectAtLeastOne') }}</p>
    </div>

    <div class="flex gap-2 pt-1">
      <button
        v-if="isEditing"
        class="flex-1 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20 transition-all hover:bg-red-500/20"
        :disabled="submitting"
        @click="$emit('delete')"
      >
        {{ $t('expenses.delete') || 'Delete' }}
      </button>
      <button
        v-else
        class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium ring-1 ring-zinc-800"
        :disabled="submitting"
        @click="$emit('cancel')"
      >
        {{ $t('expenses.cancel') }}
      </button>
      <button
        class="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-60"
        :disabled="submitting || !isFormValid"
        @click="submit"
      >
        {{ submitting ? $t('expenses.saving') : (isEditing ? 'Update' : $t('expenses.save')) }}
      </button>
    </div>
  </div>
</template>
