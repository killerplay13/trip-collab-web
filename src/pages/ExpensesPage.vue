<script setup lang="ts">
import { computed, onMounted, ref, watch, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus } from "@element-plus/icons-vue";
import BottomSheet from "../components/BottomSheet.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import ExpenseCreateForm from "../components/ExpenseCreateForm.vue";
import EmptyState from "../components/common/EmptyState.vue";
import { createExpense, updateExpense, deleteExpense, getExpensesAll, getExpenseSummary, getSettlements, getExpenseDetail, getAiExpenseInsight } from "../api/expenses";
import type { ExpenseGroup, ExpenseMember, ExpenseSettlement, ExpenseSummary, ExpenseItem, AiExpenseInsightResponse } from "../api/expenses";
import { getTripMembers } from "../api/tripMembers";
import type { TripMember } from "../api/tripMembers";
import { useTripAccess } from "../composables/useTripAccess";
import { usePullToRefresh } from "../composables/usePullToRefresh";
import { useI18n } from "vue-i18n";
import { useToast } from "../composables/useToast";
import { formatMoney } from "../utils/formatters";

const route = useRoute();
const router = useRouter();
const { isOwner, isMember } = useTripAccess();
const tripId = computed(() => String(route.params.tripId || ""));
const { t, locale } = useI18n();
const toast = useToast();

const loading = ref(false);
const creating = ref(false);
const errorMsg = ref("");
const createError = ref("");
const groups = ref<ExpenseGroup[]>([]);
const summary = ref<ExpenseSummary | null>(null);
const settlementItems = ref<ExpenseSettlement[]>([]);
const tripMembers = ref<TripMember[]>([]);
const sheetOpen = ref(false);
const defaultExpenseDate = ref(toYmd(new Date()));
const editingExpense = ref<ExpenseItem | undefined>(undefined);
const prefillExpenseTitle = ref("");
const aiInsight = ref<AiExpenseInsightResponse | null>(null);
const aiInsightLoading = ref(false);
const aiInsightError = ref("");
const isAiInsightExpanded = ref(false);

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}



function formatPaymentSource(source: string | null | undefined) {
  if (!source) return t("expenses.personal");
  return source === "SHARED_WALLET" ? t("expenses.sharedWalletShort") : t("expenses.personal");
}

function formatSplitMethod(method: string | null | undefined) {
  if (method === "CUSTOM_AMOUNT") return t("expenses.splitCustom");
  return t("expenses.splitEqual");
}

function hasFxInfo(item: ExpenseItem) {
  return Boolean(item.originalCurrency && item.fxRate && item.originalCurrency !== item.currency);
}

function formatFxInfo(item: ExpenseItem) {
  const source = item.fxSource?.trim() || t("expenses.fxSourceManual");
  return t("expenses.fxInfo", {
    from: item.originalCurrency,
    rate: item.fxRate,
    to: item.currency || summary.value?.currency || "TWD",
    source,
  });
}

function getCategoryIcon(category: string | null | undefined) {
  switch (normalizeCategory(category)) {
    case "FOOD":
      return "🍴";
    case "CLOTHING":
      return "👕";
    case "LODGING":
      return "🏨";
    case "TRANSPORT":
      return "🚗";
    case "ENTERTAINMENT":
      return "🎡";
    default:
      return "⋯";
  }
}

function formatCategory(category: string | null | undefined) {
  return t(`expenses.categories.${normalizeCategory(category)}`);
}

function normalizeCategory(category: string | null | undefined) {
  const normalized = category?.trim().toUpperCase();
  switch (normalized) {
    case "FOOD":
    case "CLOTHING":
    case "LODGING":
    case "TRANSPORT":
    case "ENTERTAINMENT":
    case "OTHER":
      return normalized;
    default:
      return "OTHER";
  }
}

const summaryRows = computed(() => {
  const current = summary.value;
  if (!current) return [];

  const currency = current.currency ?? "TWD";
  return [
    {
      label: t('expenses.total'),
      value: formatMoney(current.totalAmount ?? current.total ?? current.totalExpenses, currency),
    },
    {
      label: t('expenses.balance'),
      value: formatMoney(current.totalBalance ?? current.balance ?? current.netBalance, currency),
    },
    {
      label: t('expenses.paid'),
      value: formatMoney(current.totalPaid ?? current.paid, currency),
    },
    {
      label: t('expenses.unsettled'),
      value: formatMoney(current.unsettledAmount, currency),
    },
  ].filter((row) => Boolean(row.value));
});

const settlements = computed<ExpenseSettlement[]>(() => {
  return settlementItems.value;
});

const fallbackMembers = computed<ExpenseMember[]>(() => {
  const summaryMembers = Array.isArray(summary.value?.members) ? summary.value.members : [];
  if (summaryMembers.length > 0) return summaryMembers;

  const memberMap = new Map<string, ExpenseMember>();
  for (const item of settlements.value) {
    if (item.fromMemberId && !memberMap.has(item.fromMemberId)) {
      memberMap.set(item.fromMemberId, {
        memberId: item.fromMemberId,
        name: item.from?.trim() || item.fromMemberId,
      });
    }
    if (item.toMemberId && !memberMap.has(item.toMemberId)) {
      memberMap.set(item.toMemberId, {
        memberId: item.toMemberId,
        name: item.to?.trim() || item.toMemberId,
      });
    }
  }

  for (const group of groups.value) {
    for (const item of group.items) {
      if (item.paidByMemberId && !memberMap.has(item.paidByMemberId)) {
        memberMap.set(item.paidByMemberId, {
          memberId: item.paidByMemberId,
          name: item.paidByMemberId,
        });
      }
      for (const participantMemberId of item.participantMemberIds ?? []) {
        if (!participantMemberId || memberMap.has(participantMemberId)) continue;
        memberMap.set(participantMemberId, {
          memberId: participantMemberId,
          name: participantMemberId,
        });
      }
    }
  }

  return Array.from(memberMap.values());
});

const members = computed<ExpenseMember[]>(() => {
  if (tripMembers.value.length > 0) {
    return tripMembers.value.map((member) => ({
      memberId: member.id,
      name: member.nickname || member.id,
    }));
  }

  return fallbackMembers.value;
});

async function load(options: { silent?: boolean } = {}) {
  if (!tripId.value) return;
  const silent = options.silent === true;
  if (!silent) loading.value = true;
  errorMsg.value = "";
  try {
    const [expenseGroups, expenseSummary, nextSettlements, nextMembers] = await Promise.all([
      getExpensesAll(tripId.value),
      getExpenseSummary(tripId.value),
      getSettlements(tripId.value),
      getTripMembers(tripId.value),
    ]);
    groups.value = Array.isArray(expenseGroups) ? expenseGroups : [];
    summary.value = expenseSummary;
    settlementItems.value = Array.isArray(nextSettlements) ? nextSettlements : [];
    tripMembers.value = Array.isArray(nextMembers) ? nextMembers : [];
  } catch (e: any) {
    errorMsg.value =
      e?.response?.data?.message ?? e?.message ?? t('expenses.loadFailed');
    if (!silent) {
      groups.value = [];
      summary.value = null;
      settlementItems.value = [];
      tripMembers.value = [];
    }
  } finally {
    if (!silent) loading.value = false;
  }
}

const pullToRefresh = usePullToRefresh(() => load({ silent: true }));

function openCreate(prefillTitle = "") {
  createError.value = "";
  editingExpense.value = undefined;
  prefillExpenseTitle.value = prefillTitle.trim();
  defaultExpenseDate.value = groups.value[0]?.expenseDate || toYmd(new Date());
  sheetOpen.value = true;
}

async function openEdit(item: ExpenseItem) {
  if (!tripId.value) return;
  createError.value = "";
  prefillExpenseTitle.value = "";
  try {
    const detail = await getExpenseDetail(tripId.value, item.id);
    const splitMemberIds = detail.splits.map(s => s.memberId);
    editingExpense.value = {
      ...detail.expense,
      participantMemberIds: splitMemberIds,
      customSplits: detail.splits.map(s => ({ memberId: s.memberId, amount: s.shareAmount })),
    };
    sheetOpen.value = true;
  } catch (e: any) {
    createError.value = e?.message || "Failed to load expense details";
  }
}

function closeCreate() {
  sheetOpen.value = false;
  createError.value = "";
  prefillExpenseTitle.value = "";
  setTimeout(() => {
    editingExpense.value = undefined;
  }, 300);
}

function queryStringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0].trim() : "";
  return "";
}

async function consumePrefillTitleQuery() {
  const title = queryStringValue(route.query.prefillTitle);
  if (!title || !(isOwner.value || isMember.value)) return;

  openCreate(title);

  const nextQuery = { ...route.query };
  delete nextQuery.prefillTitle;
  await router.replace({
    path: route.path,
    query: nextQuery,
  });
}

async function handleCreate(payload: {
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
}) {
  if (creating.value) return;
  if (!tripId.value) return;
  creating.value = true;
  createError.value = "";
  try {
    if (editingExpense.value) {
      await updateExpense(tripId.value, editingExpense.value.id, payload);
    } else {
      await createExpense(tripId.value, payload);
    }
    sheetOpen.value = false;
    prefillExpenseTitle.value = "";
    toast.success(editingExpense.value ? t("expenses.toast.updated") : t("expenses.toast.created"));
    await load();
  } catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.message ?? t('expenses.createFailed');
    createError.value = msg;
    toast.error(msg);
  } finally {
    creating.value = false;
  }
}

async function handleDelete() {
  if (creating.value) return;
  if (!tripId.value || !editingExpense.value) return;
  
  confirmDialog.title = t('expenses.deleteExpense');
  confirmDialog.message = t('expenses.deleteConfirm', { title: editingExpense.value.title || t('expenses.untitled') });
  confirmDialog.confirmText = t('expenses.delete');
  confirmDialog.danger = true;
  confirmDialog.open = true;
  
  confirmDialog.onConfirm = async () => {
    if (confirmDialog.loading) return;
    confirmDialog.loading = true;
    creating.value = true;
    createError.value = "";
    try {
      await deleteExpense(tripId.value, editingExpense.value!.id);
      sheetOpen.value = false;
      confirmDialog.open = false;
      toast.success(t("expenses.toast.deleted"));
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete expense";
      createError.value = msg;
      toast.error(msg);
    } finally {
      confirmDialog.loading = false;
      creating.value = false;
    }
  };
}

async function handleExpenseInsight() {
  if (!tripId.value || aiInsightLoading.value) return;

  aiInsightLoading.value = true;
  aiInsightError.value = "";
  aiInsight.value = null;

  try {
    aiInsight.value = await getAiExpenseInsight(tripId.value, {
      language: locale.value,
    });
    isAiInsightExpanded.value = false;
  } catch (e: any) {
    aiInsightError.value =
      e?.response?.data?.message ?? e?.message ?? t("expenses.aiInsight.error");
  } finally {
    aiInsightLoading.value = false;
  }
}

watch([tripId, locale], () => {
  aiInsight.value = null;
  aiInsightError.value = "";
  isAiInsightExpanded.value = false;
});

onMounted(async () => {
  await load();
  await consumePrefillTitleQuery();
});

watch(
  () => route.query.prefillTitle,
  () => {
    void consumePrefillTitleQuery();
  },
);
</script>

<template>
  <div
    class="pb-24"
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
    <div class="sticky top-0 z-20 -mx-4 px-4 pt-6 pb-4 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 flex flex-col items-center">
      <h1 class="text-2xl font-bold tracking-tight text-gradient">{{ $t('expenses.title') }}</h1>
      <p class="mt-0.5 text-xs font-mono text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800 mt-2">ID: {{ tripId }}</p>
    </div>

    <!-- Summary Section -->
    <div v-if="summaryRows.length" class="mt-6 animate-fade-in-up">
      <div class="text-xs font-semibold tracking-wider text-emerald-400 uppercase mb-3 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        {{ $t('expenses.overview') }}
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="(row, idx) in summaryRows"
          :key="row.label"
          class="glass-card p-4 transition-all hover:scale-[1.02] hover:shadow-lg"
          :style="{ animationDelay: `${idx * 50}ms` }"
        >
          <div class="text-xs font-medium text-zinc-400 uppercase tracking-wide">{{ row.label }}</div>
          <div class="mt-2 text-xl font-bold" :class="row.label === 'Unsettled' ? 'text-amber-400' : 'text-zinc-100'">
            {{ row.value }}
          </div>
        </div>
      </div>
    </div>

    <!-- AI Expense Insight -->
    <section class="mt-6 animate-fade-in-up" style="animation-delay: 100ms;">
      <div class="glass-card p-4 border border-amber-500/15">
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="text-xs font-semibold tracking-wider text-amber-300 uppercase">{{ $t('expenses.aiInsight.title') }}</div>
            <p v-if="!aiInsight && !aiInsightLoading && !aiInsightError" class="mt-1 text-xs text-zinc-500 truncate">
              {{ $t('expenses.aiInsight.description') }}
            </p>
            <div v-if="aiInsightLoading" class="mt-2 flex items-center gap-2">
              <div class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></div>
              <span class="text-xs text-amber-300/70 font-medium">{{ $t('expenses.aiInsight.generating') }}</span>
            </div>
          </div>
          <button
            v-if="!aiInsightLoading && !aiInsight"
            type="button"
            class="shrink-0 rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200 ring-1 ring-amber-500/20 transition-all hover:bg-amber-500/20 active:scale-95"
            @click="handleExpenseInsight"
          >
            {{ $t('expenses.aiInsight.button') }}
          </button>
        </div>

        <div v-if="aiInsightError" class="mt-3 flex items-center justify-between gap-3 rounded-xl bg-red-400/5 p-2.5 ring-1 ring-red-400/20">
          <p class="text-xs font-medium text-red-400/90 truncate">{{ aiInsightError }}</p>
          <button
            type="button"
            class="shrink-0 text-xs font-bold text-red-400 hover:text-red-300"
            @click="handleExpenseInsight"
          >
            {{ $t('expenses.aiInsight.retry') }}
          </button>
        </div>

        <div v-if="aiInsight" class="mt-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div v-if="aiInsight.fallback" class="inline-flex items-center gap-1.5 mb-2 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-300">
                <span class="w-1 h-1 rounded-full bg-amber-400"></span>
                {{ $t('expenses.aiInsight.fallback') }}
              </div>
              <p class="text-sm leading-relaxed text-zinc-200" :class="{ 'line-clamp-2': !isAiInsightExpanded }">
                {{ aiInsight.summary }}
              </p>
            </div>
            <button 
              type="button"
              class="shrink-0 text-xs font-bold text-amber-300/80 hover:text-amber-300 flex items-center gap-1 mt-1"
              @click="isAiInsightExpanded = !isAiInsightExpanded"
            >
              {{ isAiInsightExpanded ? $t('expenses.aiInsight.collapse') : $t('expenses.aiInsight.expand') }}
              <svg 
                class="w-3 h-3 transition-transform duration-200" 
                :class="{ 'rotate-180': isAiInsightExpanded }"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
          </div>

          <div v-if="isAiInsightExpanded" class="mt-4 space-y-4 pt-4 border-t border-zinc-800/50 animate-fade-in-up">
            <div v-if="aiInsight.highlights.length">
              <p class="text-[10px] font-bold uppercase tracking-wider text-amber-300/60">{{ $t('expenses.aiInsight.highlights') }}</p>
              <ul class="mt-2 space-y-2">
                <li
                  v-for="(item, idx) in aiInsight.highlights.slice(0, 2)"
                  :key="`highlight-${idx}`"
                  class="flex gap-2 text-sm leading-relaxed text-zinc-300"
                >
                  <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70"></span>
                  <span class="min-w-0 break-words">{{ item }}</span>
                </li>
              </ul>
            </div>

            <div v-if="aiInsight.warnings.length">
              <p class="text-[10px] font-bold uppercase tracking-wider text-amber-300/60">{{ $t('expenses.aiInsight.warnings') }}</p>
              <ul class="mt-2 space-y-2">
                <li
                  v-for="(item, idx) in aiInsight.warnings.slice(0, 2)"
                  :key="`warning-${idx}`"
                  class="flex gap-2 text-sm leading-relaxed text-zinc-300"
                >
                  <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70"></span>
                  <span class="min-w-0 break-words">{{ item }}</span>
                </li>
              </ul>
            </div>

            <div v-if="aiInsight.suggestions.length">
              <p class="text-[10px] font-bold uppercase tracking-wider text-amber-300/60">{{ $t('expenses.aiInsight.suggestions') }}</p>
              <ul class="mt-2 space-y-2">
                <li
                  v-for="(item, idx) in aiInsight.suggestions.slice(0, 2)"
                  :key="`suggestion-${idx}`"
                  class="flex gap-2 text-sm leading-relaxed text-zinc-300"
                >
                  <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/70"></span>
                  <span class="min-w-0 break-words">{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Expenses List -->
    <div class="mt-8">
      <div class="flex items-center justify-between mb-4 animate-fade-in-up" style="animation-delay: 150ms;">
        <div class="text-xs font-semibold tracking-wider text-blue-400 uppercase flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
          {{ $t('expenses.transactions') }}
        </div>
      </div>

      <div
        v-if="loading"
        class="space-y-4"
      >
        <div v-for="i in 2" :key="i" class="glass-card h-32 animate-pulse"></div>
      </div>

      <div
        v-else-if="errorMsg"
        class="glass-card p-6 text-center animate-fade-in-up"
      >
        <p class="text-sm font-medium text-red-400 mb-4">{{ errorMsg }}</p>
        <button
          class="rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-700 active:scale-95"
          @click="load()"
        >
          {{ $t('expenses.retryLoading') }}
        </button>
      </div>

      <div
        v-else-if="groups.length === 0"
        class="animate-fade-in-up"
      >
        <EmptyState
          icon="Money"
          :title="$t('expenses.empty.title')"
          :description="$t('expenses.empty.description')"
          :primary-action-text="(isOwner || isMember) ? $t('expenses.empty.action') : undefined"
          @primary-action="openCreate"
        />
      </div>

      <div
        v-else
        class="max-h-[min(52svh,32rem)] space-y-6 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        <section
          v-for="(group, gIdx) in groups"
          :key="group.expenseDate"
          class="animate-fade-in-up"
          :style="{ animationDelay: `${150 + gIdx * 50}ms` }"
        >
          <div class="flex items-center justify-between mb-3 px-1">
            <div class="text-sm font-bold text-zinc-300">
              {{ group.expenseDate || "Unknown date" }}
            </div>
            <div class="text-xs font-medium text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full">
              {{ group.items.length }} item{{ group.items.length === 1 ? "" : "s" }}
            </div>
          </div>

          <div class="glass-card overflow-hidden">
            <div
              v-for="(item, idx) in group.items"
              :key="item.id"
              class="px-4 py-4 transition-colors hover:bg-zinc-800/40 relative cursor-pointer"
              :class="{ 'border-t border-zinc-800/50': idx > 0 }"
              @click="(isOwner || isMember) && openEdit(item)"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <div class="break-words whitespace-normal text-base font-semibold text-zinc-100">
                    <span class="mr-1.5" aria-hidden="true">{{ getCategoryIcon(item.category) }}</span>
                    {{ item.title || $t('expenses.untitled') }}
                  </div>
                  <div class="mt-1.5 flex items-center gap-2">
                    <span class="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700/50">
                      <span aria-hidden="true">{{ getCategoryIcon(item.category) }}</span>
                      {{ formatCategory(item.category) }}
                    </span>
                    <span
                      class="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md border"
                      :class="item.paymentSource === 'SHARED_WALLET'
                        ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                        : 'text-zinc-400 bg-zinc-800 border-zinc-700/50'"
                    >
                      {{ formatPaymentSource(item.paymentSource) }}
                    </span>
                    <span
                      v-if="item.splitMethod === 'CUSTOM_AMOUNT'"
                      class="inline-flex text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20"
                    >
                      {{ formatSplitMethod(item.splitMethod) }}
                    </span>
                    <span
                      v-else
                      class="inline-flex text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20"
                    >
                      EQUAL
                    </span>
                  </div>
                  <div
                    v-if="hasFxInfo(item)"
                    class="mt-1.5 text-[11px] font-medium text-zinc-500"
                  >
                    {{ formatFxInfo(item) }}
                  </div>
                </div>
                <div class="text-lg font-bold text-zinc-100 shrink-0">
                  {{ formatMoney(item.amount, item.currency || "TWD") }}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Settlements Section -->
    <div class="mt-8 animate-fade-in-up" style="animation-delay: 300ms;">
      <div class="text-xs font-semibold tracking-wider text-purple-400 uppercase mb-3 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
        {{ $t('expenses.settlements') }}
      </div>
      
      <div v-if="settlements.length === 0" class="glass-card p-6 text-center border-dashed border-2 bg-transparent shadow-none">
        <p class="text-sm font-medium text-zinc-500">{{ $t('expenses.allSquaredUp') }}</p>
      </div>
      
      <div v-else class="space-y-3">
        <div
          v-for="(item, idx) in settlements"
          :key="`${item.fromMemberId}-${item.toMemberId}-${idx}`"
          class="glass-card p-4 flex items-center justify-between group transition-all hover:ring-1 hover:ring-purple-500/30"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
              {{ (item.from || item.fromMemberId || "-").charAt(0).toUpperCase() }}
            </div>
            <div class="text-zinc-500">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            </div>
            <div class="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
              {{ (item.to || item.toMemberId || "-").charAt(0).toUpperCase() }}
            </div>
          </div>
          <div class="text-base font-bold text-zinc-100">
            {{ formatMoney(item.amount, item.currency || summary?.currency || "TWD") }}
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Action Button -->
    <div
      v-if="isOwner || isMember"
      class="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 animate-fade-in-up"
      style="animation-delay: 400ms;"
    >
      <button
        class="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/30 transition-all hover:scale-110 active:scale-95"
        @click="openCreate()"
      >
        <el-icon size="24"><Plus /></el-icon>
      </button>
    </div>

    <BottomSheet
      :open="sheetOpen"
      :title="editingExpense ? $t('expenses.editExpense') : $t('expenses.addExpense')"
      @close="closeCreate"
    >
      <div
        v-if="createError"
        class="mb-4 rounded-xl bg-red-400/10 p-3 ring-1 ring-red-400/20"
      >
        <p class="text-sm font-medium text-red-400">{{ createError }}</p>
      </div>

      <ExpenseCreateForm
        :expense-date="defaultExpenseDate"
        :members="members"
        :submitting="creating"
        :base-currency="summary?.currency || 'TWD'"
        :initial-expense="editingExpense"
        :prefill-title="prefillExpenseTitle"
        @cancel="closeCreate"
        @delete="handleDelete"
        @submit="handleCreate"
      />
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
