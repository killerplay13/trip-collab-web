<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

import type { ExpenseItem } from "../api/expenses";
import { getWalletSummary } from "../api/wallet";
import type { WalletSummaryResponse } from "../api/wallet";
import { formatAmount, parseAmountExpression } from "../utils/formatters";

const AUTO_FX_SOURCE = "ExchangeRate-API";

const props = defineProps<{
  expenseDate: string;
  members?: Array<{
    memberId: string;
    name: string;
  }>;
  submitting?: boolean;
  baseCurrency?: string;
  initialExpense?: ExpenseItem;
  prefillTitle?: string;
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
    fxSource?: string;
    category?: string;
    paymentSource?: string;
    splitMethod?: string;
    customSplits?: Array<{ memberId: string, amount: number }>;
  }): void;
  (e: "cancel"): void;
  (e: "delete"): void;
}>();

const route = useRoute();
const tripId = computed(() => String(route.params.tripId || ""));
const isEditing = computed(() => !!props.initialExpense);

const title = ref(props.initialExpense?.title || props.prefillTitle || "");
const amount = ref(props.initialExpense?.originalAmount ? String(props.initialExpense.originalAmount) : (props.initialExpense?.amount ? String(props.initialExpense.amount) : ""));
const expenseDate = ref(props.initialExpense?.expenseDate || props.expenseDate);
const paidByMemberId = ref(props.initialExpense?.paidByMemberId || "");
const participantMemberIds = ref<string[]>(props.initialExpense?.participantMemberIds || []);
const selectedCurrency = ref(props.initialExpense?.originalCurrency || props.baseCurrency || "TWD");
const fxRate = ref(props.initialExpense?.fxRate ? String(props.initialExpense.fxRate) : "");
const fxSource = ref(props.initialExpense?.fxSource || "");
const category = ref(props.initialExpense?.category || "OTHER");
const paymentSource = ref(props.initialExpense?.paymentSource || "PERSONAL");
const splitMethod = ref(props.initialExpense?.splitMethod || "EQUAL");

// memberId -> amount in selectedCurrency
const customAmounts = ref<Record<string, string>>({});

const availableCurrencies = [
  { code: "TWD", label: "TWD - 台幣" },
  { code: "USD", label: "USD - 美金" },
  { code: "JPY", label: "JPY - 日幣" },
  { code: "EUR", label: "EUR - 歐元" },
  { code: "KRW", label: "KRW - 韓元" },
];
const categoryOptions = [
  { value: "FOOD", icon: "🍴" },
  { value: "CLOTHING", icon: "👕" },
  { value: "LODGING", icon: "🏨" },
  { value: "TRANSPORT", icon: "🚗" },
  { value: "ENTERTAINMENT", icon: "🎡" },
  { value: "OTHER", icon: "⋯" },
];
const memberOptions = computed(() => props.members ?? []);
const fetchingFxRate = ref(false);
const walletSummary = ref<WalletSummaryResponse | null>(null);
const walletLoading = ref(false);
const walletError = ref("");

const parsedAmount = computed(() => {
  const value = parseAmountExpression(amount.value);
  return Number.isFinite(value) ? value : 0;
});

const selectedWalletBalance = computed(() => {
  const currency = selectedCurrency.value;
  const balance = walletSummary.value?.balances.find((item) => item.currency === currency);
  return Number(balance?.balance ?? 0);
});

const isSharedWalletBalanceExceeded = computed(() => {
  return paymentSource.value === "SHARED_WALLET" && parsedAmount.value > selectedWalletBalance.value;
});

const walletBalanceHintClass = computed(() => {
  if (walletError.value) return "text-red-400";
  if (isSharedWalletBalanceExceeded.value) return "text-red-400";
  return "text-zinc-400";
});


async function loadWalletSummary() {
  if (!tripId.value || walletLoading.value) return;
  walletLoading.value = true;
  walletError.value = "";
  try {
    walletSummary.value = await getWalletSummary(tripId.value);
  } catch (e: any) {
    walletError.value = e?.response?.data?.message ?? e?.message ?? "Failed to load wallet balance";
  } finally {
    walletLoading.value = false;
  }
}

async function fetchFxRate(from: string, to: string) {
  if (from === to) return "1";
  fetchingFxRate.value = true;
  fxSource.value = "";
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const data = await res.json();
    if (data && data.rates && data.rates[to]) {
      fxSource.value = AUTO_FX_SOURCE;
      return String(data.rates[to]);
    }
  } catch (e) {
    console.error("Failed to fetch fx rate:", e);
  } finally {
    fetchingFxRate.value = false;
  }
  return "";
}

function onFxRateInput() {
  fxSource.value = "";
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
      fxSource.value = "";
    }
  },
  { immediate: true }
);

watch(
  [paymentSource, tripId],
  ([source]) => {
    if (source === "SHARED_WALLET") {
      void loadWalletSummary();
    }
  },
  { immediate: true },
);

watch(
  [() => props.initialExpense, () => props.prefillTitle],
  ([expense, prefillTitle]) => {
    if (expense) {
      title.value = expense.title;
      amount.value = expense.originalAmount ? String(expense.originalAmount) : String(expense.amount);
      expenseDate.value = expense.expenseDate;
      paidByMemberId.value = expense.paidByMemberId || "";
      participantMemberIds.value = expense.participantMemberIds || [];
      selectedCurrency.value = expense.originalCurrency || props.baseCurrency || "TWD";
      fxRate.value = expense.fxRate ? String(expense.fxRate) : "";
      fxSource.value = expense.fxSource || "";
      category.value = expense.category || "OTHER";
      paymentSource.value = expense.paymentSource || "PERSONAL";
      splitMethod.value = expense.splitMethod || "EQUAL";

      const nextCustom = {} as Record<string, string>;
      if (expense.splitMethod === "CUSTOM_AMOUNT" && expense.customSplits) {
        // If it's foreign currency, the stored customSplits are in base currency.
        // We'd ideally need to convert them back, but for simplicity, if it's foreign we just show the base currency amounts?
        // Wait, fxRate converts original -> base.
        const rate = expense.fxRate || 1;
        for (const s of expense.customSplits) {
          nextCustom[s.memberId] = expense.originalCurrency && expense.fxRate
            ? String(Number((s.amount / rate).toFixed(2)))
            : String(s.amount);
        }
      }
      customAmounts.value = nextCustom;
    } else {
      title.value = prefillTitle?.trim() || "";
      amount.value = "";
      expenseDate.value = props.expenseDate;
      paidByMemberId.value = "";
      participantMemberIds.value = [];
      selectedCurrency.value = props.baseCurrency || "TWD";
      fxRate.value = "";
      fxSource.value = "";
      category.value = "OTHER";
      paymentSource.value = "PERSONAL";
      splitMethod.value = "EQUAL";
      customAmounts.value = {};
    }
  }
);
const isAmountValid = computed(() => {
  const value = parseAmountExpression(amount.value);
  return Number.isFinite(value) && value > 0;
});
const isFxRateValid = computed(() => {
  if (selectedCurrency.value === (props.baseCurrency || "TWD")) return true;
  const parsedRate = Number(fxRate.value);
  return Number.isFinite(parsedRate) && parsedRate > 0;
});
const customAmountsSum = computed(() => {
  if (splitMethod.value !== "CUSTOM_AMOUNT") return 0;
  return Object.values(customAmounts.value).reduce((acc, val) => acc + (Number(val) || 0), 0);
});
const isCustomSplitValid = computed(() => {
  if (splitMethod.value !== "CUSTOM_AMOUNT") return true;
  return Math.abs(customAmountsSum.value - parsedAmount.value) < 0.01;
});
const isFormValid = computed(() => {
  return (
    Boolean(title.value.trim()) &&
    isAmountValid.value &&
    isFxRateValid.value &&
    Boolean(expenseDate.value.trim()) &&
    (paymentSource.value === 'SHARED_WALLET' || Boolean(paidByMemberId.value.trim())) &&
    (splitMethod.value === 'CUSTOM_AMOUNT' ? isCustomSplitValid.value : participantMemberIds.value.length > 0)
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

function selectAllParticipants() {
  participantMemberIds.value = memberOptions.value.map((member) => member.memberId);
}

function clearParticipants() {
  participantMemberIds.value = [];
}

function onAmountBlur() {
  if (!amount.value) return;
  const value = parseAmountExpression(amount.value);
  if (Number.isFinite(value) && value > 0) {
    amount.value = String(Number(value.toFixed(2)));
  }
}

function submit() {
  if (!title.value.trim()) return;
  if (!isAmountValid.value) return;

  const finalAmount = parsedAmount.value;
  if (!expenseDate.value.trim()) return;
  if (paymentSource.value === "PERSONAL" && !paidByMemberId.value.trim()) return;

  if (splitMethod.value === 'EQUAL' && participantMemberIds.value.length === 0) return;

  const isForeign = selectedCurrency.value !== (props.baseCurrency || "TWD");
  const finalFxRate = isForeign ? Number(fxRate.value) : 1;
  const finalParsedAmount = isForeign ? Number((finalAmount * finalFxRate).toFixed(2)) : finalAmount;
  const isSharedWallet = paymentSource.value === "SHARED_WALLET";

  let finalCustomSplits: Array<{memberId: string, amount: number}> | undefined = undefined;
  if (splitMethod.value === "CUSTOM_AMOUNT") {
    let currentSum = 0;
    finalCustomSplits = Object.entries(customAmounts.value)
      .map(([memberId, amtStr]) => {
        const share = Number(amtStr) || 0;
        if (share <= 0) return null;
        const converted = isForeign ? Number((share * finalFxRate).toFixed(2)) : share;
        currentSum += converted;
        return { memberId, amount: converted };
      })
      .filter((s): s is {memberId: string, amount: number} => s !== null);

    // Adjust last item for rounding differences
    if (finalCustomSplits.length > 0) {
      const diff = finalParsedAmount - currentSum;
      if (Math.abs(diff) > 0.001) {
        const lastItem = finalCustomSplits[finalCustomSplits.length - 1];
        if (lastItem) {
          lastItem.amount = Number((lastItem.amount + diff).toFixed(2));
        }
      }
    }
  }

  emit("submit", {
    title: title.value.trim(),
    amount: isForeign || isSharedWallet ? undefined : finalAmount,
    originalAmount: isForeign || isSharedWallet ? finalAmount : undefined,
    originalCurrency: isForeign || isSharedWallet ? selectedCurrency.value : undefined,
    fxRate: isForeign || isSharedWallet ? finalFxRate : undefined,
    fxSource: (isForeign || isSharedWallet) && fxSource.value ? fxSource.value : undefined,
    expenseDate: expenseDate.value,
    paidByMemberId: isSharedWallet ? '' : paidByMemberId.value,
    participantMemberIds: splitMethod.value === 'EQUAL' ? [...participantMemberIds.value] : [],
    category: category.value,
    paymentSource: paymentSource.value,
    splitMethod: splitMethod.value,
    customSplits: finalCustomSplits,
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

    <div>
      <div class="text-sm text-zinc-300">{{ $t('expenses.category') }}</div>
      <div class="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          v-for="option in categoryOptions"
          :key="option.value"
          type="button"
          class="flex min-h-[3rem] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium ring-1 transition-all active:scale-95 sm:gap-2 sm:text-sm flex-col sm:flex-row text-center break-words"
          :class="category === option.value
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
            : 'bg-zinc-900 text-zinc-300 ring-zinc-800 hover:bg-zinc-800'"
          :disabled="submitting"
          @click="category = option.value"
        >
          <span aria-hidden="true" class="text-base">{{ option.icon }}</span>
          <span class="break-words whitespace-normal leading-tight">{{ $t(`expenses.categories.${option.value}`) }}</span>
        </button>
      </div>
    </div>

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
          type="text"
          inputmode="decimal"
          placeholder="e.g. 100 or 100+50"
          class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          :class="{'ring-red-500/50 focus:ring-red-500': amount && !isAmountValid}"
          :disabled="submitting"
          @blur="onAmountBlur"
        />
        <p v-if="!amount" class="mt-1 text-xs text-zinc-500">{{ $t('expenses.required') }}</p>
        <p v-else-if="!isAmountValid" class="mt-1 text-xs text-red-400">Invalid amount or expression</p>
      </label>
    </div>

    <label v-if="selectedCurrency !== (baseCurrency || 'TWD')" class="block">
      <div class="text-sm text-zinc-300">{{ $t('expenses.exchangeRateTo', { currency: baseCurrency || 'TWD' }) }}</div>
      <div class="relative mt-1">
        <input
          v-model="fxRate"
          type="number"
          min="0"
          step="0.0001"
          placeholder="e.g. 0.22"
          class="w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-amber-500/50 focus:ring-2 transition-all"
          :disabled="submitting || fetchingFxRate"
          @input="onFxRateInput"
        />
        <div v-if="fetchingFxRate" class="absolute right-3 top-2.5 text-xs text-amber-500 animate-pulse">{{ $t('expenses.fetching') }}</div>
      </div>
      <p v-if="!(Number(fxRate) > 0)" class="mt-1 text-xs text-amber-500/80">{{ $t('expenses.exchangeRateRequired') }}</p>
      <p v-else-if="fxSource" class="mt-1 text-xs text-zinc-500">
        {{ $t('expenses.fxSourceLabel', { source: fxSource }) }}
      </p>
      <p v-else-if="parsedAmount > 0" class="mt-1 text-xs text-zinc-400">
        ≈ {{ formatAmount(parsedAmount * Number(fxRate)) }} {{ baseCurrency || 'TWD' }}
      </p>
      <p v-if="Number(fxRate) > 0 && fxSource && parsedAmount > 0" class="mt-1 text-xs text-zinc-400">
        ≈ {{ formatAmount(parsedAmount * Number(fxRate)) }} {{ baseCurrency || 'TWD' }}
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

    <div class="grid grid-cols-2 gap-4">
      <label class="block">
        <div class="text-sm text-zinc-300">{{ $t('expenses.paymentSource') }}</div>
        <select
          v-model="paymentSource"
          class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          :disabled="submitting"
        >
          <option value="PERSONAL">{{ $t('expenses.personal') }}</option>
          <option value="SHARED_WALLET">{{ $t('expenses.sharedWallet') }}</option>
        </select>
        <p
          v-if="paymentSource === 'SHARED_WALLET'"
          class="mt-1 text-xs transition-colors"
          :class="walletBalanceHintClass"
        >
          <span v-if="walletLoading">{{ $t('expenses.walletBalanceLoading') }}</span>
          <span v-else-if="walletError">{{ $t('expenses.walletBalanceLoadFailed') }}</span>
          <span v-else>
            {{ $t('expenses.walletBalanceHint', {
              currency: selectedCurrency,
              amount: formatAmount(selectedWalletBalance),
            }) }}
          </span>
        </p>
      </label>

      <label v-if="paymentSource === 'PERSONAL'" class="block">
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
    </div>

    <label class="block">
      <div class="text-sm text-zinc-300">Split Method</div>
      <select
        v-model="splitMethod"
        class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        :disabled="submitting"
      >
        <option value="EQUAL">Equal Split (平分)</option>
        <option value="CUSTOM_AMOUNT">Custom Amount (自訂金額)</option>
      </select>
    </label>

    <div v-if="splitMethod === 'EQUAL'" class="block">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-zinc-300">{{ $t('expenses.participants') }}</div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="text-xs font-medium text-zinc-400 transition-colors hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-zinc-400"
            :disabled="submitting || memberOptions.length === 0"
            @click="selectAllParticipants"
          >
            {{ $t('expenses.selectAll') }}
          </button>
          <span class="h-3 w-px bg-zinc-700"></span>
          <button
            type="button"
            class="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-zinc-400"
            :disabled="submitting || participantMemberIds.length === 0"
            @click="clearParticipants"
          >
            {{ $t('expenses.clearSelection') }}
          </button>
        </div>
      </div>
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

    <div v-if="splitMethod === 'CUSTOM_AMOUNT'" class="block">
      <div class="flex justify-between items-end mb-1">
        <div class="text-sm text-zinc-300">Custom Splits</div>
        <div class="text-xs font-mono" :class="isCustomSplitValid ? 'text-emerald-400' : 'text-amber-500'">
          Sum: {{ formatAmount(customAmountsSum) }} / {{ formatAmount(parsedAmount) }}
        </div>
      </div>
      <div class="space-y-2 rounded-xl bg-zinc-900 px-3 py-3 ring-1 ring-zinc-800">
        <div
          v-for="member in memberOptions"
          :key="member.memberId"
          class="flex items-center gap-3 text-sm text-zinc-200"
        >
          <span class="w-1/3 min-w-[5rem] break-words whitespace-normal">{{ member.name }}</span>
          <input
            v-model="customAmounts[member.memberId]"
            type="number"
            min="0"
            step="0.01"
            class="flex-1 rounded-lg bg-zinc-950 px-2 py-1 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
            :disabled="submitting"
          />
        </div>
      </div>
      <p v-if="!isCustomSplitValid" class="mt-1 text-xs text-amber-500">The sum of custom splits must exactly match the total amount.</p>
    </div>

    <div class="flex gap-2 pt-1">
      <button
        v-if="isEditing"
        class="flex-1 rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20 transition-all hover:bg-red-500/20"
        :disabled="submitting"
        @click="$emit('delete')"
      >
        {{ $t('expenses.delete') }}
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
        {{ submitting ? $t('expenses.saving') : (isEditing ? $t('expenses.update') : $t('expenses.save')) }}
      </button>
    </div>
  </div>
</template>
