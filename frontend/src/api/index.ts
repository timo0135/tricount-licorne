import { api } from './client';
import type {
  AuthResponse,
  BalanceSummary,
  CategoryCoefficients,
  CoefficientMatrix,
  CategoryStat,
  Expense,
  ExpensePayload,
  Group,
  Settlement,
  User,
} from './types';

export const authApi = {
  register: (body: { email: string; name: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', body),
  login: (body: { email: string; password: string }) => api.post<AuthResponse>('/auth/login', body),
  me: () => api.get<User>('/auth/me'),
  logout: () => api.post<void>('/auth/logout'),
  updateProfile: (body: { name?: string; emoji?: string; color?: string }) =>
    api.patch<User>('/users/me', body),
};

export const groupsApi = {
  list: () => api.get<Group[]>('/groups'),
  get: (id: string) => api.get<Group>(`/groups/${id}`),
  create: (body: { name: string; description?: string; emoji?: string; gradient?: string; currency?: string }) =>
    api.post<Group>('/groups', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<Group>(`/groups/${id}`, body),
  remove: (id: string) => api.delete<{ deleted: boolean }>(`/groups/${id}`),
  join: (inviteCode: string) => api.post<Group>('/groups/join', { inviteCode }),
  leave: (groupId: string, userId: string) =>
    api.delete<{ removed: boolean }>(`/groups/${groupId}/members/${userId}`),
  balances: (id: string) => api.get<BalanceSummary>(`/groups/${id}/balances`),
  regenerateInvite: (id: string) =>
    api.post<{ id: string; inviteCode: string }>(`/groups/${id}/invite-code`),
};

export const expensesApi = {
  list: (groupId: string) => api.get<Expense[]>(`/groups/${groupId}/expenses`),
  get: (groupId: string, id: string) => api.get<Expense>(`/groups/${groupId}/expenses/${id}`),
  stats: (groupId: string) => api.get<CategoryStat[]>(`/groups/${groupId}/expenses/stats`),
  create: (groupId: string, body: ExpensePayload) =>
    api.post<Expense>(`/groups/${groupId}/expenses`, body),
  update: (groupId: string, id: string, body: Partial<ExpensePayload>) =>
    api.patch<Expense>(`/groups/${groupId}/expenses/${id}`, body),
  remove: (groupId: string, id: string) =>
    api.delete<{ deleted: boolean }>(`/groups/${groupId}/expenses/${id}`),
};

export const coefficientsApi = {
  get: (groupId: string) => api.get<CoefficientMatrix>(`/groups/${groupId}/coefficients`),
  replace: (groupId: string, categories: CategoryCoefficients[]) =>
    api.put<CoefficientMatrix>(`/groups/${groupId}/coefficients`, { categories }),
  apply: (groupId: string) =>
    api.post<{ updated: number }>(`/groups/${groupId}/coefficients/apply`),
};

export const settlementsApi = {
  list: (groupId: string) => api.get<Settlement[]>(`/groups/${groupId}/settlements`),
  create: (
    groupId: string,
    body: { fromUserId: string; toUserId: string; amountCents: number; note?: string },
  ) => api.post<Settlement>(`/groups/${groupId}/settlements`, body),
  remove: (groupId: string, id: string) =>
    api.delete<{ deleted: boolean }>(`/groups/${groupId}/settlements/${id}`),
};
