<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { Plus } from "@element-plus/icons-vue";
import BottomSheet from "../components/BottomSheet.vue";
import ExpenseCreateForm from "../components/ExpenseCreateForm.vue";
import { createExpense, getExpensesAll, getExpenseSummary, getSettlements } from "../api/expenses";
import type { ExpenseGroup, ExpenseMember, ExpenseSettlement, ExpenseSummary } from "../api/expenses";
import { getTripMembers } from "../api/tripMembers";
import type { TripMember } from "../api/tripMembers";
import { useTripAccess } from "../composables/useTripAccess";

const route = useRoute();
const { isOwner, isMember } = useTripAccess();
const tripId = computed(() => String(route.params.tripId || ""));

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
      label: "Total",
      value: formatMoney(current.totalAmount ?? current.total ?? current.totalExpenses, currency),
    },
    {
      label: "Balance",
      value: formatMoney(current.totalBalance ?? current.balance ?? current.netBalance, currency),
    },
    {
      label: "Paid",
      value: formatMoney(current.totalPaid ?? current.paid, currency),
    },
    {
      label: "Unsettled",
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
      e?.response?.data?.message ?? e?.message ?? "Failed to load expenses";
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
  defaultExpenseDate.value = groups.value[0]?.expenseDate || toYmd(new Date());
  sheetOpen.value = true;
}

function closeCreate() {
  sheetOpen.value = false;
  createError.value = "";
}

async function handleCreate(payload: {
  title: string;
  amount: number;
  expenseDate: string;
  paidByMemberId: string;
  participantMemberIds: string[];
}) {
  if (!tripId.value) return;
  creating.value = true;
  createError.value = "";
  try {
    await createExpense(tripId.value, payload);
    sheetOpen.value = false;
    await load();
  } catch (e: any) {
    createError.value =
      e?.response?.data?.message ?? e?.message ?? "Create expense failed";
  } finally {
    creating.value = false;
  }
}

onMounted(async () => {
  await load();
});
</script>

<template>
  <div>
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Expenses</h1>
        <p class="mt-2 text-sm text-zinc-400">tripId: {{ tripId }}</p>
      </div>
    </div>

    <div v-if="summaryRows.length" class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <div class="text-sm text-zinc-400">Summary</div>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <div
          v-for="row in summaryRows"
          :key="row.label"
          class="rounded-xl bg-zinc-950 px-3 py-3 ring-1 ring-zinc-800"
        >
          <div class="text-xs text-zinc-500">{{ row.label }}</div>
          <div class="mt-1 text-sm font-medium text-zinc-100">{{ row.value }}</div>
        </div>
      </div>
    </div>

    <div class="mt-4">
      <div
        v-if="loading"
        class="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800"
      >
        <p class="text-sm text-zinc-300">Loading...</p>
      </div>

      <div
        v-else-if="errorMsg"
        class="rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800"
      >
        <p class="text-sm text-red-300">{{ errorMsg }}</p>
        <button
          class="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-medium text-zinc-900"
          @click="load"
        >
          Retry
        </button>
      </div>

      <div
        v-else-if="groups.length === 0"
        class="rounded-2xl bg-zinc-900/60 p-6 ring-1 ring-zinc-800/50"
      >
        <div class="text-base font-semibold text-zinc-100">No expenses yet</div>
        <div class="mt-1 text-sm text-zinc-400">
          Add the first expense to start tracking shared costs.
        </div>
      </div>

      <div v-else class="space-y-4">
        <section
          v-for="group in groups"
          :key="group.expenseDate"
          class="rounded-2xl bg-zinc-900/70 p-4 ring-1 ring-zinc-800/60"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm font-medium text-zinc-100">
              {{ group.expenseDate || "Unknown date" }}
            </div>
            <div class="text-xs text-zinc-500">
              {{ group.items.length }} item{{ group.items.length === 1 ? "" : "s" }}
            </div>
          </div>

          <div class="mt-3 space-y-3">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="rounded-xl bg-zinc-950 px-3 py-3 ring-1 ring-zinc-800"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-zinc-100">
                    {{ item.title || "Untitled expense" }}
                  </div>
                  <div class="mt-1 text-xs text-zinc-500">
                    {{ item.paymentSource || "PERSONAL" }} · {{ item.splitMethod || "EQUAL" }}
                  </div>
                </div>
                <div class="text-sm font-medium text-zinc-100">
                  {{ formatMoney(item.amount, item.currency || "TWD") }}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div class="mt-4 rounded-2xl bg-zinc-900 p-4 ring-1 ring-zinc-800">
      <div class="text-sm text-zinc-400">Settlements</div>
      <div v-if="settlements.length === 0" class="mt-2 text-sm text-zinc-300">
        No settlements needed
      </div>
      <div v-else class="mt-3 space-y-2">
        <div
          v-for="(item, idx) in settlements"
          :key="`${item.fromMemberId}-${item.toMemberId}-${idx}`"
          class="rounded-xl bg-zinc-950 px-3 py-3 text-sm ring-1 ring-zinc-800"
        >
          <div class="text-zinc-100">
            {{ item.from || item.fromMemberId || "-" }} -> {{ item.to || item.toMemberId || "-" }}
          </div>
          <div class="mt-1 text-zinc-400">
            {{ formatMoney(item.amount, item.currency || summary?.currency || "TWD") }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isOwner || isMember"
      class="fixed bottom-24 right-4 z-40"
      style="margin-bottom: env(safe-area-inset-bottom)"
    >
      <el-button
        size="default"
        type="primary"
        circle
        :icon="Plus"
        class="transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        @click="openCreate"
      />
    </div>

    <BottomSheet
      :open="sheetOpen"
      title="Add expense"
      @close="closeCreate"
    >
      <div
        v-if="createError"
        class="mb-3 rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800"
      >
        <p class="text-sm text-red-300">{{ createError }}</p>
      </div>

      <ExpenseCreateForm
        :expense-date="defaultExpenseDate"
        :members="members"
        :submitting="creating"
        @cancel="closeCreate"
        @submit="handleCreate"
      />
    </BottomSheet>
  </div>
</template>
