import { defineStore } from 'pinia';
import { ref } from 'vue';
import { coefficientsApi, expensesApi, familiesApi, groupsApi, settlementsApi } from '@/api';
import type {
  BalanceSummary,
  CategoryCoefficients,
  CategoryStat,
  CoefficientMatrix,
  Expense,
  ExpensePayload,
  Group,
  Settlement,
} from '@/api/types';

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([]);
  const current = ref<Group | null>(null);
  const expenses = ref<Expense[]>([]);
  const balances = ref<BalanceSummary | null>(null);
  const settlements = ref<Settlement[]>([]);
  const stats = ref<CategoryStat[]>([]);
  const coefficients = ref<CoefficientMatrix | null>(null);
  const loading = ref(false);

  async function fetchGroups() {
    loading.value = true;
    try {
      groups.value = await groupsApi.list();
    } finally {
      loading.value = false;
    }
  }

  async function openGroup(id: string) {
    loading.value = true;
    try {
      const [group, groupExpenses, groupBalances, groupSettlements] = await Promise.all([
        groupsApi.get(id),
        expensesApi.list(id),
        groupsApi.balances(id),
        settlementsApi.list(id),
      ]);
      current.value = group;
      expenses.value = groupExpenses;
      balances.value = groupBalances;
      settlements.value = groupSettlements;
    } finally {
      loading.value = false;
    }
  }

  /** Recharge les données dérivées après une modification. */
  async function refresh(id: string) {
    const [group, groupExpenses, groupBalances, groupSettlements] = await Promise.all([
      groupsApi.get(id),
      expensesApi.list(id),
      groupsApi.balances(id),
      settlementsApi.list(id),
    ]);
    current.value = group;
    expenses.value = groupExpenses;
    balances.value = groupBalances;
    settlements.value = groupSettlements;
  }

  async function fetchCoefficients(id: string) {
    coefficients.value = await coefficientsApi.get(id);
    return coefficients.value;
  }

  async function saveCoefficients(id: string, categories: CategoryCoefficients[]) {
    coefficients.value = await coefficientsApi.replace(id, categories);
    return coefficients.value;
  }

  /** Recalcule les dépenses en mode automatique avec les coefficients actuels. */
  async function applyCoefficients(id: string) {
    const result = await coefficientsApi.apply(id);
    await refresh(id);
    return result;
  }

  async function fetchStats(id: string) {
    stats.value = await expensesApi.stats(id);
  }

  async function createGroup(payload: Parameters<typeof groupsApi.create>[0]) {
    const group = await groupsApi.create(payload);
    groups.value = [group, ...groups.value];
    return group;
  }

  async function joinGroup(inviteCode: string) {
    const group = await groupsApi.join(inviteCode);
    if (!groups.value.some((g) => g.id === group.id)) groups.value = [group, ...groups.value];
    return group;
  }

  async function addExpense(groupId: string, payload: ExpensePayload) {
    await expensesApi.create(groupId, payload);
    await refresh(groupId);
  }

  async function editExpense(groupId: string, expenseId: string, payload: Partial<ExpensePayload>) {
    await expensesApi.update(groupId, expenseId, payload);
    await refresh(groupId);
  }

  async function deleteExpense(groupId: string, expenseId: string) {
    await expensesApi.remove(groupId, expenseId);
    await refresh(groupId);
  }

  async function addSettlement(
    groupId: string,
    payload: { fromUserId: string; toUserId: string; amountCents: number; note?: string },
  ) {
    await settlementsApi.create(groupId, payload);
    await refresh(groupId);
  }

  async function deleteSettlement(groupId: string, settlementId: string) {
    await settlementsApi.remove(groupId, settlementId);
    await refresh(groupId);
  }

  async function leaveGroup(groupId: string, userId: string) {
    await groupsApi.leave(groupId, userId);
    groups.value = groups.value.filter((g) => g.id !== groupId);
  }

  async function deleteGroup(groupId: string) {
    await groupsApi.remove(groupId);
    groups.value = groups.value.filter((g) => g.id !== groupId);
  }

  /** Remplace le troupeau courant (et sa carte dans la liste) par sa version à jour. */
  function applyGroup(group: Group) {
    current.value = group;
    groups.value = groups.value.map((g) => (g.id === group.id ? group : g));
    return group;
  }

  async function updateGroup(id: string, body: Record<string, unknown>) {
    return applyGroup(await groupsApi.update(id, body));
  }

  async function setGroupImage(id: string, kind: 'photo' | 'banner', file: Blob) {
    return applyGroup(await groupsApi.setImage(id, kind, file));
  }

  async function removeGroupImage(id: string, kind: 'photo' | 'banner') {
    return applyGroup(await groupsApi.removeImage(id, kind));
  }

  /** Les familles changent les coefficients et les soldes : on recharge tout. */
  async function createFamily(groupId: string, body: { name: string; memberIds: string[] }) {
    applyGroup(await familiesApi.create(groupId, body));
    await refresh(groupId);
    coefficients.value = null;
  }

  async function updateFamily(
    groupId: string,
    familyId: string,
    body: { name?: string; memberIds?: string[] },
  ) {
    applyGroup(await familiesApi.update(groupId, familyId, body));
    await refresh(groupId);
    coefficients.value = null;
  }

  async function deleteFamily(groupId: string, familyId: string) {
    applyGroup(await familiesApi.remove(groupId, familyId));
    await refresh(groupId);
    coefficients.value = null;
  }

  function reset() {
    groups.value = [];
    current.value = null;
    expenses.value = [];
    balances.value = null;
    settlements.value = [];
    stats.value = [];
    coefficients.value = null;
  }

  return {
    groups,
    current,
    expenses,
    balances,
    settlements,
    stats,
    coefficients,
    loading,
    fetchGroups,
    openGroup,
    refresh,
    fetchStats,
    fetchCoefficients,
    saveCoefficients,
    applyCoefficients,
    createGroup,
    joinGroup,
    addExpense,
    editExpense,
    deleteExpense,
    addSettlement,
    deleteSettlement,
    leaveGroup,
    deleteGroup,
    updateGroup,
    setGroupImage,
    removeGroupImage,
    createFamily,
    updateFamily,
    deleteFamily,
    reset,
  };
});
