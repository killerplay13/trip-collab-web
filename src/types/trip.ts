export type Trip = {
  id: string;
  title: string;
  timezone: string; // "Asia/Taipei"
  startDate: string; // "2026-02-10"
  endDate: string;   // "2026-02-14"
  notes?: string | null;
  inviteToken?: string; // returned only on create in v0.1
};
