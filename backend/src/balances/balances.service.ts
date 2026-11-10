import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceInput, computeBalances, simplifyDebts } from './balance.util';

@Injectable()
export class BalancesService {
  constructor(private prisma: PrismaService) {}

  /** Agrégat brut réutilisé par la liste des troupeaux (pas de contrôle d'accès ici). */
  async summary(groupId: string) {
    const [members, expenses, shares, settlements] = await Promise.all([
      this.prisma.membership.findMany({
        where: { groupId },
        select: { userId: true },
      }),
      this.prisma.expense.groupBy({
        by: ['paidById'],
        where: { groupId },
        _sum: { amountCents: true },
      }),
      this.prisma.expenseShare.groupBy({
        by: ['userId'],
        where: { expense: { groupId } },
        _sum: { amountCents: true },
      }),
      this.prisma.settlement.findMany({
        where: { groupId },
        select: { fromUserId: true, toUserId: true, amountCents: true },
      }),
    ]);

    const paid = new Map(expenses.map((e) => [e.paidById, e._sum.amountCents ?? 0]));
    const owed = new Map(shares.map((s) => [s.userId, s._sum.amountCents ?? 0]));
    const sent = new Map<string, number>();
    const received = new Map<string, number>();
    for (const s of settlements) {
      sent.set(s.fromUserId, (sent.get(s.fromUserId) ?? 0) + s.amountCents);
      received.set(s.toUserId, (received.get(s.toUserId) ?? 0) + s.amountCents);
    }

    // On inclut les membres actuels + toute personne apparaissant dans l'historique.
    const userIds = new Set<string>(members.map((m) => m.userId));
    [paid, owed, sent, received].forEach((m) => m.forEach((_v, k) => userIds.add(k)));

    const inputs: BalanceInput[] = [...userIds].map((userId) => ({
      userId,
      paidCents: paid.get(userId) ?? 0,
      owedCents: owed.get(userId) ?? 0,
      sentCents: sent.get(userId) ?? 0,
      receivedCents: received.get(userId) ?? 0,
    }));

    const totalCents = [...paid.values()].reduce((sum, v) => sum + v, 0);
    return { totalCents, balances: computeBalances(inputs) };
  }

  /** Vue complète pour l'écran « Soldes » : qui doit quoi à qui. */
  async forGroup(userId: string, groupId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) throw new ForbiddenException('Tu ne fais pas partie de ce troupeau');

    const { totalCents, balances } = await this.summary(groupId);

    const users = await this.prisma.user.findMany({
      where: { id: { in: balances.map((b) => b.userId) } },
      select: { id: true, name: true, emoji: true, color: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const detailed = balances
      .map((b) => ({ ...b, user: byId.get(b.userId) }))
      .sort((a, b) => b.balanceCents - a.balanceCents);

    const reimbursements = simplifyDebts(balances).map((r) => ({
      ...r,
      fromUser: byId.get(r.fromUserId),
      toUser: byId.get(r.toUserId),
    }));

    const memberCount = await this.prisma.membership.count({ where: { groupId } });

    return {
      groupId,
      totalCents,
      averagePerMemberCents: memberCount ? Math.round(totalCents / memberCount) : 0,
      balances: detailed,
      reimbursements,
    };
  }
}
