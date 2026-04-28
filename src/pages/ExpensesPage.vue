<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { Plus } from "@element-plus/icons-vue";
import BottomSheet from "../components/BottomSheet.vue";
import ExpenseCreateForm from "../components/ExpenseCreateForm.vue";
import { createExpense, updateExpense, deleteExpense, getExpensesAll, getExpenseSummary, getSettlements } from "../api/expenses";
import type { ExpenseGroup, ExpenseMember, ExpenseSettlement, ExpenseSummary, ExpenseItem } from "../api/expenses";
import { getTripMembers } from "../api/tripMembers";
import type { TripMember } from "../api/tripMembers";
import { useTripAccess } from "../composables/useTripAccess";
import { useI18n } from "vue-i18n";

const route = useRoute();
const { isOwner, isMember } = useTripAccess();
const tripId = computed(() => String(route.params.tripId || ""));
const { t } = useI18n();

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatMoney(value: unknown, currency = "TWD") {
  const amount = toNumber(value);
  if (amount === null) return "";
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
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

async function load() {
  if (!tripId.value) return;
  loading.value = true;
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
    groups.value = [];
    summary.value = null;
    settlementItems.value = [];
    tripMembers.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  createError.value = "";
  editingExpense.value = undefined;
  defaultExpenseDate.value = groups.value[0]?.expenseDate || toYmd(new Date());
  sheetOpen.value = true;
}

function openEdit(item: ExpenseItem) {
  createError.value = "";
  editingExpense.value = item;
  sheetOpen.value = true;
}

function closeCreate() {
  sheetOpen.value = false;
  createError.value = "";
  setTimeout(() => {
    editingExpense.value = undefined;
  }, 300);
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
}) {
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
    await load();
  } catch (e: any) {
    createError.value =
      e?.response?.data?.message ?? e?.message ?? t('expenses.createFailed');
  } finally {
    creating.value = false;
  }
}

async function handleDelete() {
  if (!tripId.value || !editingExpense.value) return;
  if (!confirm("Are you sure you want to delete this expense?")) return;
  
  creating.value = true;
  createError.value = "";
  try {
    await deleteExpense(tripId.value, editingExpense.value.id);
    sheetOpen.value = false;
    await load();
  } catch (e: any) {
    createError.value =
      e?.response?.data?.message ?? e?.message ?? "Failed to delete expense";
  } finally {
    creating.value = false;
  }
}

onMounted(async () => {
  await load();
});
</script>

<template>
  <div class="pb-24">
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
          @click="load"
        >
          {{ $t('expenses.retryLoading') }}
        </button>
      </div>

      <div
        v-else-if="groups.length === 0"
        class="animate-fade-in-up"
      >
        <div class="flex flex-col items-center text-center p-8 glass-card border-dashed border-2 border-zinc-800 bg-transparent shadow-none">
          <div class="mb-5 w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center ring-4 ring-zinc-950 shadow-inner">
            <svg class="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          </div>
          <div class="text-lg font-bold text-zinc-200">
            {{ $t('expenses.noExpenses') }}
          </div>
          <div class="mt-2 text-sm text-zinc-500 leading-relaxed max-w-[250px]">
            {{ $t('expenses.noExpensesDesc') }}
          </div>
        </div>
      </div>

      <div v-else class="space-y-6">
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
                  <div class="truncate text-base font-semibold text-zinc-100">
                    {{ item.title || $t('expenses.untitled') }}
                  </div>
                  <div class="mt-1.5 flex items-center gap-2">
                    <span class="inline-flex text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700/50">
                      {{ item.paymentSource || "PERSONAL" }}
                    </span>
                    <span class="inline-flex text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                      {{ item.splitMethod || "EQUAL" }}
                    </span>
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
        @click="openCreate"
      >
        <el-icon size="24"><Plus /></el-icon>
      </button>
    </div>

    <BottomSheet
      :open="sheetOpen"
      :title="editingExpense ? 'Edit Expense' : $t('expenses.addExpense')"
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
        @cancel="closeCreate"
        @delete="handleDelete"
        @submit="handleCreate"
      />
    </BottomSheet>
  </div>
</template>
