import { api } from "./client";

export type ExpenseItem = {
  id: string;
  title: string;
  amount: number;
  expenseDate: string;
  paidByMemberId?: string | null;
  participantMemberIds?: string[];
  currency?: string | null;
  paymentSource?: string | null;
  splitMethod?: string | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  fxRate?: number | null;
};

export type ExpenseGroup = {
  expenseDate: string;
  items: ExpenseItem[];
};

export type ExpenseSummary = {
  currency?: string | null;
  totalAmount?: number | null;
  totalBalance?: number | null;
  totalPaid?: number | null;
  unsettledAmount?: number | null;
  settlements?: ExpenseSettlement[];
  members?: ExpenseMember[];
  [key: string]: unknown;
};

export type CreateExpensePayload = {
  title: string;
  amount?: number;
  expenseDate: string;
  paidByMemberId: string;
  participantMemberIds: string[];
  originalAmount?: number;
  originalCurrency?: string;
  fxRate?: number;
};

export type ExpenseSettlement = {
  fromMemberId: string;
  toMemberId: string;
  from?: string | null;
  to?: string | null;
  amount: number;
  currency?: string | null;
};

export type ExpenseMember = {
  memberId: string;
  name: string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeExpenseItem(raw: any): ExpenseItem {
  const participantMemberIds = Array.isArray(raw?.participantMemberIds)
    ? raw.participantMemberIds
    : Array.isArray(raw?.participant_member_ids)
      ? raw.participant_member_ids
      : [];
  return {
    id: raw?.id ?? "",
    title: raw?.title ?? raw?.name ?? "",
    amount: toNumber(raw?.amount ?? raw?.totalAmount ?? raw?.total_amount),
    expenseDate: raw?.expenseDate ?? raw?.expense_date ?? raw?.date ?? "",
    paidByMemberId: raw?.paidByMemberId ?? raw?.paid_by_member_id ?? null,
    participantMemberIds: participantMemberIds.map((id: unknown) => String(id ?? "")).filter(Boolean),
    currency: raw?.currency ?? null,
    paymentSource: raw?.paymentSource ?? raw?.payment_source ?? null,
    splitMethod: raw?.splitMethod ?? raw?.split_method ?? null,
    originalAmount: raw?.originalAmount ?? raw?.original_amount ?? null,
    originalCurrency: raw?.originalCurrency ?? raw?.original_currency ?? null,
    fxRate: raw?.fxRate ?? raw?.fx_rate ?? null,
  };
}

function normalizeExpenseGroup(raw: any): ExpenseGroup {
  const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.expenses) ? raw.expenses : [];
  return {
    expenseDate: raw?.expenseDate ?? raw?.expense_date ?? raw?.date ?? "",
    items: items.map(normalizeExpenseItem),
  };
}

function normalizeExpenseSummary(raw: any): ExpenseSummary {
  const settlements = Array.isArray(raw?.settlements) ? raw.settlements.map(normalizeExpenseSettlement) : [];
  const members = dedupeMembers([
    ...extractMembers(raw?.members),
    ...extractMembers(raw?.participants),
    ...extractMembers(raw?.memberBalances),
    ...extractMembers(raw?.balances),
    ...extractMembersFromSettlements(settlements),
  ]);

  return {
    ...raw,
    currency: raw?.currency ?? null,
    totalAmount: raw?.totalAmount ?? raw?.total_amount ?? raw?.total ?? null,
    totalBalance: raw?.totalBalance ?? raw?.total_balance ?? raw?.balance ?? null,
    totalPaid: raw?.totalPaid ?? raw?.total_paid ?? raw?.paid ?? null,
    unsettledAmount: raw?.unsettledAmount ?? raw?.unsettled_amount ?? null,
    settlements,
    members,
  };
}

function normalizeExpenseSettlement(raw: any): ExpenseSettlement {
  return {
    fromMemberId: raw?.fromMemberId ?? raw?.from_member_id ?? "",
    toMemberId: raw?.toMemberId ?? raw?.to_member_id ?? "",
    from: raw?.from ?? raw?.fromNickname ?? raw?.from_nickname ?? null,
    to: raw?.to ?? raw?.toNickname ?? raw?.to_nickname ?? null,
    amount: toNumber(raw?.amount),
    currency: raw?.currency ?? null,
  };
}

function normalizeExpenseMember(raw: any): ExpenseMember | null {
  const memberId = String(raw?.memberId ?? raw?.id ?? "").trim();
  if (!memberId) return null;

  return {
    memberId,
    name: String(
      raw?.nickname ?? raw?.name ?? raw?.displayName ?? raw?.memberName ?? memberId,
    ).trim() || memberId,
  };
}

function extractMembers(raw: any): ExpenseMember[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeExpenseMember).filter(Boolean) as ExpenseMember[];
}

function extractMembersFromSettlements(settlements: ExpenseSettlement[]): ExpenseMember[] {
  return settlements.flatMap((item) => {
    const next: ExpenseMember[] = [];
    if (item.fromMemberId) {
      next.push({
        memberId: item.fromMemberId,
        name: item.from?.trim() || item.fromMemberId,
      });
    }
    if (item.toMemberId) {
      next.push({
        memberId: item.toMemberId,
        name: item.to?.trim() || item.toMemberId,
      });
    }
    return next;
  });
}

function dedupeMembers(members: ExpenseMember[]): ExpenseMember[] {
  const seen = new Set<string>();
  return members.filter((member) => {
    if (!member.memberId || seen.has(member.memberId)) return false;
    seen.add(member.memberId);
    return true;
  });
}

export async function getExpensesAll(tripId: string): Promise<ExpenseGroup[]> {
  const res = await api.get(`/api/trips/${tripId}/expenses/all`);
  const data = res.data as any;
  if (data && typeof data === 'object' && !Array.isArray(data) && !data.items && !data.data) {
    return Object.entries(data).map(([date, items]) => {
      const parsedItems = Array.isArray(items) ? items : [];
      return {
        expenseDate: date,
        items: parsedItems.map(normalizeExpenseItem),
      };
    }).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  }
  const list = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
  return list.map(normalizeExpenseGroup);
}

export async function getExpenseSummary(tripId: string): Promise<ExpenseSummary | null> {
  const res = await api.get(`/api/trips/${tripId}/expenses/summary`);
  const data = res.data as any;
  const summary = data?.summary ?? data?.data ?? data;
  if (!summary || typeof summary !== "object") return null;
  return normalizeExpenseSummary(summary);
}

export async function getSettlements(tripId: string): Promise<ExpenseSettlement[]> {
  const res = await api.get(`/api/trips/${tripId}/expenses/settlements`);
  const data = res.data as any;
  const list = Array.isArray(data) ? data : data?.items ?? data?.settlements ?? data?.data ?? [];
  return list.map(normalizeExpenseSettlement);
}

export async function createExpense(tripId: string, payload: CreateExpensePayload): Promise<ExpenseItem> {
  const reqPayload: any = {
    title: payload.title,
    amount: payload.amount,
    expenseDate: payload.expenseDate,
    paidByMemberId: payload.paidByMemberId,
    participantMemberIds: payload.participantMemberIds,
    paymentSource: "PERSONAL",
    splitMethod: "EQUAL",
  };
  
  if (payload.originalAmount !== undefined && payload.originalCurrency !== undefined && payload.fxRate !== undefined) {
    reqPayload.original = {
      amount: payload.originalAmount,
      currency: payload.originalCurrency,
      fxRate: payload.fxRate,
    };
  }

  const res = await api.post(`/api/trips/${tripId}/expenses`, reqPayload);
  const data = res.data as any;
  const item = data?.item ?? data?.expense ?? data?.data ?? data;
  return normalizeExpenseItem(item);
}

export async function updateExpense(tripId: string, expenseId: string, payload: CreateExpensePayload): Promise<ExpenseItem> {
  const reqPayload: any = {
    title: payload.title,
    amount: payload.amount,
    expenseDate: payload.expenseDate,
    paidByMemberId: payload.paidByMemberId,
    participantMemberIds: payload.participantMemberIds,
    paymentSource: "PERSONAL",
    splitMethod: "EQUAL",
  };
  
  if (payload.originalAmount !== undefined && payload.originalCurrency !== undefined && payload.fxRate !== undefined) {
    reqPayload.original = {
      amount: payload.originalAmount,
      currency: payload.originalCurrency,
      fxRate: payload.fxRate,
    };
  }

  const res = await api.put(`/api/trips/${tripId}/expenses/${expenseId}`, reqPayload);
  const data = res.data as any;
  const item = data?.item ?? data?.expense ?? data?.data ?? data;
  return normalizeExpenseItem(item);
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<void> {
  await api.delete(`/api/trips/${tripId}/expenses/${expenseId}`);
}
