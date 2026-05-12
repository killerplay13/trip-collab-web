<script setup lang="ts">
import { ref, onMounted, watch, reactive } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToast } from "../composables/useToast";
import {
  getWalletSummary,
  getWalletTransactions,
  createWalletDeposit,
  createWalletExchange,
  createWalletWithdrawal,
  createWalletAdjustment,
} from "../api/wallet";
import type { WalletSummaryResponse, WalletTransactionListResponse } from "../api/wallet";
import { Switch, Download, Upload, Setting } from "@element-plus/icons-vue";
import BottomSheet from "../components/BottomSheet.vue";
import AmountInput from "../components/AmountInput.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import EmptyState from "../components/common/EmptyState.vue";
import { usePullToRefresh } from "../composables/usePullToRefresh";
import { formatAmount, parseAmountExpression } from "../utils/formatters";

const route = useRoute();
const { t } = useI18n();
const toast = useToast();
const tripId = ref(String(route.params.tripId || ""));

const summary = ref<WalletSummaryResponse | null>(null);
const transactions = ref<WalletTransactionListResponse | null>(null);
const loading = ref(true);
const errorMsg = ref("");

const depositSheetOpen = ref(false);
const depositAmount = ref("");
const depositCurrency = ref("TWD");
const depositFxRate = ref("1");
const depositNote = ref("");
const depositing = ref(false);

const exchangeSheetOpen = ref(false);
const exFromCurrency = ref("TWD");
const exFromAmount = ref("");
const exFromRate = ref("1");
const exToCurrency = ref("JPY");
const exToAmount = ref("");
const exToRate = ref("0.22");
const exchanging = ref(false);

const withdrawalSheetOpen = ref(false);
const withdrawalAmount = ref("");
const withdrawalCurrency = ref("TWD");
const withdrawalFxRate = ref("1");
const withdrawalNote = ref("");
const withdrawing = ref(false);

const adjustmentSheetOpen = ref(false);
const adjustmentDirection = ref<"IN" | "OUT">("IN");
const adjustmentAmount = ref("");
const adjustmentCurrency = ref("TWD");
const adjustmentFxRate = ref("1");
const adjustmentNote = ref("");
const adjusting = ref(false);

const confirmDialog = reactive({
  open: false,
  title: "",
  message: "",
  confirmText: t('settings.save'),
  cancelText: t('itinerary.cancel'),
  danger: false,
  loading: false,
  onConfirm: async () => {},
});

function getApiError(e: any, fallback: string) {
  return e?.response?.data?.message ?? e?.message ?? fallback;
}

async function load(options: { silent?: boolean } = {}) {
  if (!tripId.value) return;
  const silent = options.silent === true;
  if (!silent) loading.value = true;
  errorMsg.value = "";
  try {
    summary.value = await getWalletSummary(tripId.value);
    transactions.value = await getWalletTransactions(tripId.value);
  } catch (e: any) {
    console.error(e);
    errorMsg.value = getApiError(e, t("wallet.loadFailed"));
  } finally {
    if (!silent) loading.value = false;
  }
}

const pullToRefresh = usePullToRefresh(() => load({ silent: true }));

async function handleDeposit() {
  if (depositing.value) return;
  if (!tripId.value) return;
  
  confirmDialog.title = t('wallet.depositTitle');
  confirmDialog.message = t('wallet.depositConfirmDesc', { amount: formatAmount(depositAmount.value), currency: depositCurrency.value });
  confirmDialog.confirmText = t('wallet.confirmDeposit');
  confirmDialog.danger = false;
  confirmDialog.open = true;

  confirmDialog.onConfirm = async () => {
    if (confirmDialog.loading) return;
    confirmDialog.loading = true;
    errorMsg.value = "";
    depositing.value = true;
    try {
      await createWalletDeposit(tripId.value, {
        originalAmount: parseAmountExpression(depositAmount.value),
        originalCurrency: depositCurrency.value,
        fxRate: Number(depositFxRate.value),
        note: depositNote.value,
      });
      depositSheetOpen.value = false;
      depositAmount.value = "";
      depositNote.value = "";
      confirmDialog.open = false;
      toast.success(t("wallet.toast.depositSuccess"));
      await load();
    } catch (e: any) {
      console.error(e);
      const msg = getApiError(e, t("wallet.depositFailed"));
      errorMsg.value = msg;
      toast.error(msg);
    } finally {
      depositing.value = false;
      confirmDialog.loading = false;
    }
  };
}

async function handleExchange() {
  if (exchanging.value) return;
  if (!tripId.value) return;
  
  confirmDialog.title = t('wallet.exchangeTitle');
  confirmDialog.message = t('wallet.exchangeConfirmDesc', {
    fromAmount: formatAmount(exFromAmount.value),
    fromCurrency: exFromCurrency.value,
    toAmount: formatAmount(exToAmount.value),
    toCurrency: exToCurrency.value
  });
  confirmDialog.confirmText = t('wallet.confirmExchange');
  confirmDialog.danger = false;
  confirmDialog.open = true;

  confirmDialog.onConfirm = async () => {
    if (confirmDialog.loading) return;
    confirmDialog.loading = true;
    errorMsg.value = "";
    exchanging.value = true;
    try {
      await createWalletExchange(tripId.value, {
        from: {
          currency: exFromCurrency.value,
          amount: parseAmountExpression(exFromAmount.value),
          fxRateToBase: Number(exFromRate.value),
        },
        to: {
          currency: exToCurrency.value,
          amount: parseAmountExpression(exToAmount.value),
          fxRateToBase: Number(exToRate.value),
        },
      });
      exchangeSheetOpen.value = false;
      exFromAmount.value = "";
      exToAmount.value = "";
      confirmDialog.open = false;
      toast.success(t("wallet.toast.exchangeSuccess"));
      await load();
    } catch (e: any) {
      console.error(e);
      const msg = getApiError(e, t("wallet.exchangeFailed"));
      errorMsg.value = msg;
      toast.error(msg);
    } finally {
      exchanging.value = false;
      confirmDialog.loading = false;
    }
  };
}

async function handleWithdrawal() {
  if (withdrawing.value) return;
  if (!tripId.value) return;
  
  confirmDialog.title = t('wallet.withdrawTitle');
  confirmDialog.message = t('wallet.withdrawConfirmDesc', { amount: formatAmount(withdrawalAmount.value), currency: withdrawalCurrency.value });
  confirmDialog.confirmText = t('wallet.confirmWithdraw');
  confirmDialog.danger = true;
  confirmDialog.open = true;

  confirmDialog.onConfirm = async () => {
    if (confirmDialog.loading) return;
    confirmDialog.loading = true;
    errorMsg.value = "";
    withdrawing.value = true;
    try {
      await createWalletWithdrawal(tripId.value, {
        originalAmount: parseAmountExpression(withdrawalAmount.value),
        originalCurrency: withdrawalCurrency.value,
        fxRate: Number(withdrawalFxRate.value),
        note: withdrawalNote.value,
      });
      withdrawalSheetOpen.value = false;
      withdrawalAmount.value = "";
      withdrawalNote.value = "";
      confirmDialog.open = false;
      toast.success(t("wallet.toast.withdrawalSuccess"));
      await load();
    } catch (e: any) {
      console.error(e);
      const msg = getApiError(e, t("wallet.withdrawalFailed"));
      errorMsg.value = msg;
      toast.error(msg);
    } finally {
      withdrawing.value = false;
      confirmDialog.loading = false;
    }
  };
}

async function handleAdjustment() {
  if (adjusting.value) return;
  if (!tripId.value) return;
  
  confirmDialog.title = t('wallet.adjustTitle');
  confirmDialog.message = t('wallet.adjustConfirmDesc', { amount: formatAmount(adjustmentAmount.value), currency: adjustmentCurrency.value });
  confirmDialog.confirmText = t('wallet.confirmAdjust');
  confirmDialog.danger = adjustmentDirection.value === "OUT";
  confirmDialog.open = true;

  confirmDialog.onConfirm = async () => {
    if (confirmDialog.loading) return;
    confirmDialog.loading = true;
    errorMsg.value = "";
    adjusting.value = true;
    try {
      await createWalletAdjustment(tripId.value, {
        direction: adjustmentDirection.value,
        originalAmount: parseAmountExpression(adjustmentAmount.value),
        originalCurrency: adjustmentCurrency.value,
        fxRate: Number(adjustmentFxRate.value),
        note: adjustmentNote.value,
      });
      adjustmentSheetOpen.value = false;
      adjustmentAmount.value = "";
      adjustmentNote.value = "";
      confirmDialog.open = false;
      toast.success(t("wallet.toast.adjustmentSuccess"));
      await load();
    } catch (e: any) {
      console.error(e);
      const msg = getApiError(e, t("wallet.adjustmentFailed"));
      errorMsg.value = msg;
      toast.error(msg);
    } finally {
      adjusting.value = false;
      confirmDialog.loading = false;
    }
  };
}

watch(summary, (val) => {
  if (val?.baseCurrency) {
    if (!depositCurrency.value) depositCurrency.value = val.baseCurrency;
    if (!withdrawalCurrency.value) withdrawalCurrency.value = val.baseCurrency;
    if (!adjustmentCurrency.value) adjustmentCurrency.value = val.baseCurrency;
    if (!exFromCurrency.value) exFromCurrency.value = val.baseCurrency;
  }
}, { immediate: true });

onMounted(() => {
  load();
});

function formatDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString();
}
</script>

<template>
  <div
    class="space-y-6"
    @touchstart="pullToRefresh.onTouchStart"
    @touchmove="pullToRefresh.onTouchMove"
    @touchend="pullToRefresh.onTouchEnd"
    @touchcancel="pullToRefresh.onTouchEnd"
  >
    <div
      class="pointer-events-none fixed left-1/2 top-0 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/90 text-emerald-300 opacity-0 shadow-lg ring-1 ring-zinc-700/70 backdrop-blur transition-opacity duration-150"
      :style="pullToRefresh.indicatorStyle.value"
    >
      <div class="h-3.5 w-3.5 rounded-full border-2 border-emerald-300/30 border-t-emerald-300 animate-spin"></div>
    </div>
    <header class="flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-white">{{ $t('wallet.title') }}</h1>
        <p class="text-sm font-medium text-zinc-400">{{ $t('wallet.subtitle') }}</p>
      </div>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        <button
          class="flex min-h-[2.5rem] py-2 items-center justify-center gap-2 break-words whitespace-normal rounded-xl bg-zinc-500/10 px-3 text-xs font-medium text-zinc-300 ring-1 ring-zinc-500/20 transition-all hover:bg-zinc-500/20 active:scale-95 sm:px-4 sm:text-sm"
          @click="adjustmentSheetOpen = true"
        >
          <el-icon><Setting /></el-icon>
          <span>{{ $t('wallet.adjust') }}</span>
        </button>
        <button
          class="flex min-h-[2.5rem] py-2 items-center justify-center gap-2 break-words whitespace-normal rounded-xl bg-red-500/10 px-3 text-xs font-medium text-red-400 ring-1 ring-red-500/20 transition-all hover:bg-red-500/20 active:scale-95 sm:px-4 sm:text-sm"
          @click="withdrawalSheetOpen = true"
        >
          <el-icon><Upload /></el-icon>
          <span>{{ $t('wallet.withdraw') }}</span>
        </button>
        <button
          class="flex min-h-[2.5rem] py-2 items-center justify-center gap-2 break-words whitespace-normal rounded-xl bg-amber-500/10 px-3 text-xs font-medium text-amber-500 ring-1 ring-amber-500/20 transition-all hover:bg-amber-500/20 active:scale-95 sm:px-4 sm:text-sm"
          @click="exchangeSheetOpen = true"
        >
          <el-icon><Switch /></el-icon>
          <span>{{ $t('wallet.exchange') }}</span>
        </button>
        <button
          class="flex min-h-[2.5rem] py-2 items-center justify-center gap-2 break-words whitespace-normal rounded-xl bg-emerald-500/10 px-3 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20 transition-all hover:bg-emerald-500/20 active:scale-95 sm:px-4 sm:text-sm"
          @click="depositSheetOpen = true"
        >
          <el-icon><Download /></el-icon>
          <span>{{ $t('wallet.deposit') }}</span>
        </button>
      </div>
    </header>

    <div v-if="errorMsg" class="rounded-2xl bg-red-500/10 p-3 text-sm font-medium text-red-300 ring-1 ring-red-500/20">
      {{ errorMsg }}
    </div>

    <div v-if="loading" class="text-center text-zinc-500 py-10">{{ $t('wallet.loading') }}</div>
    <div v-else>
      <div class="grid grid-cols-2 gap-4">
        <div v-for="bal in summary?.balances" :key="bal.currency" class="rounded-3xl bg-zinc-900 p-5 ring-1 ring-zinc-800">
          <p class="text-sm font-medium text-zinc-400">{{ $t('wallet.balanceLabel', { currency: bal.currency }) }}</p>
          <p class="mt-1 text-2xl font-bold text-white">{{ formatAmount(bal.balance) }}</p>
        </div>
      </div>

      <div class="mt-8">
        <div class="px-2 mb-4">
          <h2 class="text-xl font-bold text-white">{{ $t('wallet.transactions') }}</h2>
          <p class="text-sm text-zinc-400 mt-1">{{ $t('wallet.transactionsDesc') }}</p>
        </div>
        <div class="space-y-3">
          <div v-if="transactions?.items.length === 0">
            <EmptyState
              icon="Wallet"
              :title="$t('wallet.empty.title')"
              :description="$t('wallet.empty.description')"
              :primary-action-text="$t('wallet.empty.action')"
              @primary-action="depositSheetOpen = true"
            />
          </div>
          <div
            v-for="txn in transactions?.items"
            :key="txn.transactionId"
            class="flex items-center justify-between rounded-2xl bg-zinc-900/50 p-4 ring-1 ring-zinc-800/50 transition-all hover:bg-zinc-900 hover:ring-zinc-700/50"
          >
            <div class="flex items-center gap-4">
              <div 
                class="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                :class="{
                  'bg-emerald-500/10 text-emerald-400': txn.txnType === 'DEPOSIT',
                  'bg-red-500/10 text-red-400': txn.txnType === 'WITHDRAWAL' || txn.txnType === 'EXPENSE_PAID',
                  'bg-amber-500/10 text-amber-400': txn.txnType === 'EXCHANGE',
                  'bg-zinc-500/10 text-zinc-400': txn.txnType === 'ADJUSTMENT'
                }"
              >
                <el-icon v-if="txn.txnType === 'DEPOSIT'"><Download /></el-icon>
                <el-icon v-else-if="txn.txnType === 'WITHDRAWAL' || txn.txnType === 'EXPENSE_PAID'"><Upload /></el-icon>
                <el-icon v-else-if="txn.txnType === 'EXCHANGE'"><Switch /></el-icon>
                <el-icon v-else><Setting /></el-icon>
              </div>
              <div>
                <div class="font-bold text-zinc-100">{{ txn.txnType }}</div>
                <div class="text-xs text-zinc-500">{{ formatDate(txn.createdAt) }} • {{ txn.note || $t('wallet.noNote') }}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-bold text-lg" :class="txn.direction === 'IN' ? 'text-emerald-400' : 'text-red-400'">
                {{ txn.direction === 'IN' ? '+' : '-' }}{{ formatAmount(txn.originalAmount) }} {{ txn.originalCurrency }}
              </div>
              <div v-if="txn.originalCurrency !== summary?.baseCurrency" class="text-[10px] text-zinc-500 font-mono">
                ≈ {{ formatAmount(txn.computedBaseAmount) }} {{ summary?.baseCurrency }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Deposit Sheet -->
    <BottomSheet :open="depositSheetOpen" :title="$t('wallet.depositTitle')" @close="depositSheetOpen = false">
      <div class="space-y-4">
        <label class="block">
          <div class="text-sm text-zinc-300">{{ $t('wallet.amount') }}</div>
          <AmountInput v-model="depositAmount" :disabled="depositing" :placeholder="$t('wallet.amount')" />
        </label>
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <div class="text-sm text-zinc-300">{{ $t('wallet.currency') }}</div>
            <input v-model="depositCurrency" type="text" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-emerald-500/50" />
          </label>
          <label class="block">
            <div class="text-sm text-zinc-300">{{ $t('wallet.fxRateToBase') }}</div>
            <input v-model="depositFxRate" type="number" step="0.01" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-emerald-500/50" />
          </label>
        </div>
        <label class="block">
          <div class="text-sm text-zinc-300">{{ $t('wallet.note') }}</div>
          <input v-model="depositNote" type="text" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-emerald-500/50" />
        </label>
        <div class="flex gap-2 pt-2">
          <button class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 font-medium ring-1 ring-zinc-800" @click="depositSheetOpen = false">{{ $t('wallet.cancel') }}</button>
          <button class="flex-1 rounded-xl bg-emerald-500/20 text-emerald-400 px-4 py-2 font-medium ring-1 ring-emerald-500/30 disabled:opacity-50" :disabled="depositing" @click="handleDeposit">{{ depositing ? '...' : $t('wallet.confirmDeposit') }}</button>
        </div>
      </div>
    </BottomSheet>

    <!-- Withdrawal Sheet -->
    <BottomSheet :open="withdrawalSheetOpen" :title="$t('wallet.withdrawTitle')" @close="withdrawalSheetOpen = false">
      <div class="space-y-4">
        <label class="block">
          <div class="text-sm text-zinc-300">{{ $t('wallet.amount') }}</div>
          <AmountInput v-model="withdrawalAmount" :disabled="withdrawing" error-class="ring-red-500/50 focus:ring-red-500" :placeholder="$t('wallet.amount')" />
        </label>
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <div class="text-sm text-zinc-300">{{ $t('wallet.currency') }}</div>
            <input v-model="withdrawalCurrency" type="text" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-red-500/50" />
          </label>
          <label class="block">
            <div class="text-sm text-zinc-300">{{ $t('wallet.fxRateToBase') }}</div>
            <input v-model="withdrawalFxRate" type="number" step="0.01" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-red-500/50" />
          </label>
        </div>
        <label class="block">
          <div class="text-sm text-zinc-300">{{ $t('wallet.note') }}</div>
          <input v-model="withdrawalNote" type="text" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-red-500/50" />
        </label>
        <div class="flex gap-2 pt-2">
          <button class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 font-medium ring-1 ring-zinc-800" @click="withdrawalSheetOpen = false">{{ $t('wallet.cancel') }}</button>
          <button class="flex-1 rounded-xl bg-red-500/20 px-4 py-2 font-medium text-red-400 ring-1 ring-red-500/30 disabled:opacity-50" :disabled="withdrawing" @click="handleWithdrawal">{{ withdrawing ? '...' : $t('wallet.confirmWithdraw') }}</button>
        </div>
      </div>
    </BottomSheet>

    <!-- Adjustment Sheet -->
    <BottomSheet :open="adjustmentSheetOpen" :title="$t('wallet.adjustTitle')" @close="adjustmentSheetOpen = false">
      <div class="space-y-4">
        <label class="block">
          <div class="text-sm text-zinc-300">{{ $t('wallet.direction') }}</div>
          <select v-model="adjustmentDirection" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-500/50">
            <option value="IN">{{ $t('wallet.increase') }}</option>
            <option value="OUT">{{ $t('wallet.decrease') }}</option>
          </select>
        </label>
        <label class="block">
          <div class="text-sm text-zinc-300">{{ $t('wallet.amount') }}</div>
          <AmountInput v-model="adjustmentAmount" :disabled="adjusting" error-class="ring-zinc-500/50" :placeholder="$t('wallet.amount')" />
        </label>
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <div class="text-sm text-zinc-300">{{ $t('wallet.currency') }}</div>
            <input v-model="adjustmentCurrency" type="text" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-500/50" />
          </label>
          <label class="block">
            <div class="text-sm text-zinc-300">{{ $t('wallet.fxRateToBase') }}</div>
            <input v-model="adjustmentFxRate" type="number" step="0.01" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-500/50" />
          </label>
        </div>
        <label class="block">
          <div class="text-sm text-zinc-300">{{ $t('wallet.note') }}</div>
          <input v-model="adjustmentNote" type="text" class="mt-1 w-full rounded-xl bg-zinc-900 px-3 py-2 outline-none ring-1 ring-zinc-800 focus:ring-zinc-500/50" />
        </label>
        <div class="flex gap-2 pt-2">
          <button class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 font-medium ring-1 ring-zinc-800" @click="adjustmentSheetOpen = false">{{ $t('wallet.cancel') }}</button>
          <button class="flex-1 rounded-xl bg-zinc-500/20 px-4 py-2 font-medium text-zinc-200 ring-1 ring-zinc-500/30 disabled:opacity-50" :disabled="adjusting" @click="handleAdjustment">{{ adjusting ? '...' : $t('wallet.confirmAdjust') }}</button>
        </div>
      </div>
    </BottomSheet>

    <!-- Exchange Sheet -->
    <BottomSheet :open="exchangeSheetOpen" :title="$t('wallet.exchangeTitle')" @close="exchangeSheetOpen = false">
      <div class="space-y-4">
        <div class="rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
          <div class="text-sm font-medium text-zinc-400 mb-2">{{ $t('wallet.fromWithdraw') }}</div>
          <div class="grid grid-cols-2 gap-2">
            <AmountInput v-model="exFromAmount" :disabled="exchanging" default-class="w-full rounded-lg bg-zinc-950 px-3 py-2 outline-none ring-1 ring-zinc-800" :placeholder="$t('wallet.amount')" />
            <input v-model="exFromCurrency" type="text" :placeholder="$t('wallet.currency')" class="w-full rounded-lg bg-zinc-950 px-3 py-2 outline-none ring-1 ring-zinc-800" />
            <input v-model="exFromRate" type="number" step="0.01" :placeholder="$t('wallet.fxRateToBase')" class="col-span-2 w-full rounded-lg bg-zinc-950 px-3 py-2 outline-none ring-1 ring-zinc-800" />
          </div>
        </div>
        <div class="flex justify-center text-zinc-500">
          <el-icon class="text-xl"><Switch style="transform: rotate(90deg)" /></el-icon>
        </div>
        <div class="rounded-xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
          <div class="text-sm font-medium text-zinc-400 mb-2">{{ $t('wallet.toDeposit') }}</div>
          <div class="grid grid-cols-2 gap-2">
            <AmountInput v-model="exToAmount" :disabled="exchanging" default-class="w-full rounded-lg bg-zinc-950 px-3 py-2 outline-none ring-1 ring-zinc-800" :placeholder="$t('wallet.amount')" />
            <input v-model="exToCurrency" type="text" :placeholder="$t('wallet.currency')" class="w-full rounded-lg bg-zinc-950 px-3 py-2 outline-none ring-1 ring-zinc-800" />
            <input v-model="exToRate" type="number" step="0.01" :placeholder="$t('wallet.fxRateToBase')" class="col-span-2 w-full rounded-lg bg-zinc-950 px-3 py-2 outline-none ring-1 ring-zinc-800" />
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <button class="flex-1 rounded-xl bg-zinc-900 px-4 py-2 font-medium ring-1 ring-zinc-800" @click="exchangeSheetOpen = false">{{ $t('wallet.cancel') }}</button>
          <button class="flex-1 rounded-xl bg-amber-500/20 text-amber-500 px-4 py-2 font-medium ring-1 ring-amber-500/30 disabled:opacity-50" :disabled="exchanging" @click="handleExchange">{{ exchanging ? '...' : $t('wallet.confirmExchange') }}</button>
        </div>
      </div>
    </BottomSheet>

    <ConfirmDialog
      v-model="confirmDialog.open"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-text="confirmDialog.confirmText"
      :cancel-text="confirmDialog.cancelText"
      :danger="confirmDialog.danger"
      :loading="confirmDialog.loading"
      @confirm="confirmDialog.onConfirm"
    />
  </div>
</template>
