/**
 * Calcul des soldes et simplification des dettes.
 *
 * Solde d'une licorne = (ce qu'elle a avancé) - (ce qu'elle doit)
 *                       + (remboursements envoyés) - (remboursements reçus)
 *
 * Solde > 0 : on lui doit de l'argent. Solde < 0 : elle doit de l'argent.
 */

export interface BalanceInput {
  userId: string;
  paidCents: number;
  owedCents: number;
  sentCents: number;
  receivedCents: number;
}

export interface Balance {
  userId: string;
  paidCents: number;
  owedCents: number;
  balanceCents: number;
}

export interface Reimbursement {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

export function computeBalances(inputs: BalanceInput[]): Balance[] {
  return inputs.map((i) => ({
    userId: i.userId,
    paidCents: i.paidCents,
    owedCents: i.owedCents,
    balanceCents: i.paidCents - i.owedCents + i.sentCents - i.receivedCents,
  }));
}

/**
 * Simplification des dettes (greedy min cash flow) : on associe le plus gros
 * débiteur au plus gros créancier jusqu'à ce que tout le monde soit à zéro.
 * Le résultat contient au plus n-1 transferts pour n participants.
 */
export function simplifyDebts(balances: Balance[]): Reimbursement[] {
  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ userId: b.userId, amount: -b.balanceCents }))
    .sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));

  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ userId: b.userId, amount: b.balanceCents }))
    .sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));

  const transfers: Reimbursement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) {
      transfers.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amountCents: amount,
      });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }

  return transfers;
}
