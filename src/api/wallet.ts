import { api } from "./client";

export type WalletBalanceDto = {
  currency: string;
  balance: number;
};

export type TotalsInBaseDto = {
  depositsIn: number;
  withdrawalsOut: number;
  spentOut: number;
  adjustmentsNet: number;
};

export type WalletSummaryResponse = {
  walletId: number;
  tripId: string;
  baseCurrency: string;
  balances: WalletBalanceDto[];
  totalsInBase: TotalsInBaseDto;
  updatedAt: string;
};

export type WalletTransactionResponse = {
  transactionId: number;
  walletId: number;
  txnType: string;
  direction: string;
  originalAmount: number;
  originalCurrency: string;
  fxRate: number;
  computedBaseAmount: number;
  memberId: string;
  expenseId: string | null;
  exchangeGroupId: string | null;
  fxSource: string | null;
  note: string | null;
  createdAt: string;
};

export type WalletTransactionListResponse = {
  items: WalletTransactionResponse[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export type WalletDepositPayload = {
  originalAmount: number;
  originalCurrency: string;
  fxRate: number;
  fxSource?: string;
  note?: string;
};

export type WalletExchangeLeg = {
  currency: string;
  amount: number;
  fxRateToBase: number;
};

export type WalletExchangePayload = {
  from: WalletExchangeLeg;
  to: WalletExchangeLeg;
  fxSource?: string;
  note?: string;
};

export type WalletWithdrawalPayload = WalletDepositPayload;

export type WalletAdjustmentPayload = WalletDepositPayload & {
  direction: "IN" | "OUT";
};

export async function getWalletSummary(tripId: string): Promise<WalletSummaryResponse> {
  const res = await api.get(`/api/trips/${tripId}/wallet`);
  return res.data;
}

export async function getWalletTransactions(tripId: string, page = 0, size = 50): Promise<WalletTransactionListResponse> {
  const res = await api.get(`/api/trips/${tripId}/wallet/transactions`, { params: { page, size } });
  return res.data;
}

export async function createWalletDeposit(tripId: string, payload: WalletDepositPayload): Promise<void> {
  await api.post(`/api/trips/${tripId}/wallet/deposits`, payload);
}

export async function createWalletExchange(tripId: string, payload: WalletExchangePayload): Promise<void> {
  await api.post(`/api/trips/${tripId}/wallet/exchanges`, payload);
}

export async function createWalletWithdrawal(tripId: string, payload: WalletWithdrawalPayload): Promise<void> {
  await api.post(`/api/trips/${tripId}/wallet/withdrawals`, payload);
}

export async function createWalletAdjustment(tripId: string, payload: WalletAdjustmentPayload): Promise<void> {
  await api.post(`/api/trips/${tripId}/wallet/adjustments`, payload);
}
