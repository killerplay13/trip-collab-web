<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTripAccess } from "../composables/useTripAccess";
import BottomSheet from "../components/BottomSheet.vue";
import { getSettlements, createExpense, explainAiSettlement } from "../api/expenses";
import type { AiSettlementExplainResponse, ExpenseSettlement } from "../api/expenses";
import { formatMoney } from "../utils/formatters";

const route = useRoute();
const { t } = useI18n();
const tripId = computed(() => String(route.params.tripId || ""));
const { isOwner, role } = useTripAccess();

const loading = ref(false);
const errorMsg = ref("");
const settlements = ref<ExpenseSettlement[]>([]);
const sheetOpen = ref(false);
const settling = ref(false);
const aiExplain = ref<AiSettlementExplainResponse | null>(null);
const aiExplainLoading = ref(false);
const aiExplainError = ref("");

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}


async function loadSettlements() {
  if (!tripId.value) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    const list = await getSettlements(tripId.value);
    settlements.value = Array.isArray(list) ? list : [];
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message ?? e?.message ?? "Failed to load settlements";
  } finally {
    loading.value = false;
  }
}

async function openReview() {
  sheetOpen.value = true;
  await loadSettlements();
}

function closeReview() {
  sheetOpen.value = false;
}

async function handleSettle(item: ExpenseSettlement) {
  if (!tripId.value || settling.value) return;
  settling.value = true;
  errorMsg.value = "";
  try {
    await createExpense(tripId.value, {
      title: t("settlement.settleUpAction"),
      amount: item.amount,
      expenseDate: toYmd(new Date()),
      paidByMemberId: item.fromMemberId,
      participantMemberIds: [item.toMemberId]
    });
    await loadSettlements();
  } catch (e: any) {
    errorMsg.value = e?.response?.data?.message ?? e?.message ?? "Failed to settle up";
  } finally {
    settling.value = false;
  }
}

async function handleExplainAi() {
  if (!tripId.value || aiExplainLoading.value) return;

  aiExplainLoading.value = true;
  aiExplainError.value = "";
  aiExplain.value = null;

  try {
    aiExplain.value = await explainAiSettlement(tripId.value);
  } catch (e: any) {
    const status = e?.response?.status;

    if (status === 503) {
      aiExplainError.value = t("settlement.aiExplainDisabled");
    } else if (status === 504) {
      aiExplainError.value = t("settlement.aiExplainTimeout");
    } else if (status === 502) {
      aiExplainError.value = t("settlement.aiExplainUnavailable");
    } else if (status === 403) {
      aiExplainError.value = t("settlement.aiExplainForbidden");
    } else {
      aiExplainError.value =
        e?.response?.data?.message ??
        e?.message ??
        t("settlement.aiExplainError");
    }
  } finally {
    aiExplainLoading.value = false;
  }
}
</script>

<template>
  <div class="pb-24 animate-fade-in-up">
    <div class="flex flex-col items-center pt-6 pb-8 text-center">
      <div class="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4 ring-1 ring-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
        <svg class="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
      </div>
      <h1 class="text-3xl font-bold tracking-tight text-gradient">{{ $t('settlement.title') }}</h1>
      <p class="mt-2 text-xs font-mono text-zinc-500 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800">ID: {{ tripId }}</p>
    </div>

    <div class="glass-card p-6 mb-5" style="animation-delay: 50ms;">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
        </div>
        <div>
          <div class="text-xs font-semibold tracking-wider text-zinc-500 uppercase">{{ $t('settlement.accessLevel') }}</div>
          <div class="mt-1 text-lg font-bold" :class="role === 'owner' ? 'text-indigo-400' : 'text-zinc-200'">
            {{ role === 'owner' ? $t('settlement.owner') : $t('settlement.member') }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isOwner"
      class="glass-card p-6 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.05)]"
      style="animation-delay: 100ms;"
    >
      <div class="flex items-center gap-2 mb-2">
        <div class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
        <div class="text-sm font-semibold tracking-wider text-indigo-400 uppercase">{{ $t('settlement.ownerControls') }}</div>
      </div>
      <div class="text-sm text-zinc-400 leading-relaxed">
        {{ $t('settlement.ownerDesc') }}
      </div>
      <button 
        class="mt-4 w-full py-3 rounded-xl bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20 transition-all hover:bg-indigo-500/20 active:scale-95"
        @click="openReview"
      >
        {{ $t('settlement.reviewBtn') }}
      </button>
    </div>

    <div
      v-else
      class="glass-card p-6"
      style="animation-delay: 100ms;"
    >
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        <div class="text-sm font-semibold tracking-wider text-zinc-400 uppercase">{{ $t('settlement.memberView') }}</div>
      </div>
      <div class="text-sm text-zinc-400 leading-relaxed">
        {{ $t('settlement.memberDesc') }}
      </div>
    </div>

    <!-- Review Settlements Bottom Sheet -->
    <BottomSheet
      :open="sheetOpen"
      :title="$t('settlement.reviewBtn')"
      @close="closeReview"
    >
      <div v-if="errorMsg" class="mb-4 rounded-xl bg-red-400/10 p-3 ring-1 ring-red-400/20">
        <p class="text-sm font-medium text-red-400">{{ errorMsg }}</p>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 2" :key="i" class="glass-card h-20 animate-pulse"></div>
      </div>
      
      <div v-else-if="settlements.length === 0" class="glass-card p-6 text-center border-dashed border-2 bg-transparent shadow-none">
        <p class="text-sm font-medium text-zinc-500">{{ $t('expenses.allSquaredUp') }}</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="(item, idx) in settlements"
          :key="`${item.fromMemberId}-${item.toMemberId}-${idx}`"
          class="glass-card p-4 flex flex-col gap-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                {{ (item.from || item.fromMemberId || "-").charAt(0).toUpperCase() }}
              </div>
              <div class="text-zinc-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
              </div>
              <div class="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-400">
                {{ (item.to || item.toMemberId || "-").charAt(0).toUpperCase() }}
              </div>
            </div>
            <div class="text-lg font-bold text-emerald-400 font-mono break-words whitespace-normal">
              {{ formatMoney(item.amount, item.currency || "TWD") }}
            </div>
          </div>
          <button
            class="w-full py-2 rounded-xl bg-indigo-500/20 text-indigo-300 font-semibold text-sm transition-all hover:bg-indigo-500/30 active:scale-95 disabled:opacity-50"
            :disabled="settling"
            @click="handleSettle(item)"
          >
            {{ settling ? $t('settlement.settling') : $t('settlement.settleBtn') }}
          </button>
        </div>
      </div>

      <section class="mt-5 border-t border-zinc-800 pt-5">
        <div class="mb-3">
          <p class="text-sm font-semibold text-zinc-100">
            {{ t("settlement.aiExplainTitle") }}
          </p>
          <p class="mt-1 text-xs leading-relaxed text-zinc-500">
            {{ t("settlement.aiExplainNotice") }}
          </p>
        </div>

        <button
          type="button"
          class="w-full rounded-xl bg-indigo-500/15 px-4 py-3 text-sm font-semibold text-indigo-200 ring-1 ring-indigo-500/25 transition-all hover:bg-indigo-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="aiExplainLoading"
          @click="handleExplainAi"
        >
          {{ aiExplainLoading ? t("settlement.aiExplaining") : t("settlement.aiExplainButton") }}
        </button>

        <div v-if="aiExplainLoading" class="mt-3 glass-card h-16 animate-pulse"></div>

        <div v-if="aiExplainError" class="mt-3 rounded-xl bg-red-400/10 p-3 ring-1 ring-red-400/20">
          <p class="text-sm font-medium text-red-400">{{ aiExplainError }}</p>
          <button
            type="button"
            class="mt-2 text-xs font-semibold text-red-300 disabled:opacity-50"
            :disabled="aiExplainLoading"
            @click="handleExplainAi"
          >
            {{ t("settlement.aiExplainRetry") }}
          </button>
        </div>

        <div v-if="aiExplain" class="mt-3 rounded-2xl bg-indigo-500/5 p-4 ring-1 ring-indigo-500/20">
          <div v-if="aiExplain.summary">
            <p class="text-xs font-semibold uppercase tracking-wide text-indigo-300">
              {{ t("settlement.aiExplainSummaryTitle") }}
            </p>
            <p class="mt-2 text-sm leading-relaxed text-zinc-200">
              {{ aiExplain.summary }}
            </p>
          </div>

          <div v-if="aiExplain.steps.length" class="mt-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-indigo-300">
              {{ t("settlement.aiExplainStepsTitle") }}
            </p>
            <ol class="mt-2 space-y-2">
              <li
                v-for="(step, idx) in aiExplain.steps"
                :key="`${idx}-${step}`"
                class="flex gap-3 text-sm leading-relaxed text-zinc-200"
              >
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-bold text-indigo-200 ring-1 ring-indigo-500/25">
                  {{ idx + 1 }}
                </span>
                <span class="min-w-0 break-words">{{ step }}</span>
              </li>
            </ol>
          </div>

          <div v-if="aiExplain.tips.length" class="mt-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-indigo-300">
              {{ t("settlement.aiExplainTipsTitle") }}
            </p>
            <ul class="mt-2 space-y-2">
              <li
                v-for="(tip, idx) in aiExplain.tips"
                :key="`${idx}-${tip}`"
                class="flex gap-3 text-sm leading-relaxed text-zinc-300"
              >
                <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300"></span>
                <span class="min-w-0 break-words">{{ tip }}</span>
              </li>
            </ul>
          </div>

          <p
            v-if="!aiExplain.summary && !aiExplain.steps.length && !aiExplain.tips.length"
            class="text-sm leading-relaxed text-zinc-400"
          >
            {{ t("settlement.aiExplainEmpty") }}
          </p>
        </div>
      </section>
    </BottomSheet>
  </div>
</template>
