import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceInput, computeBalances, simplifyDebts } from './balance.util';
import {
  PartyBalance,
  aggregateBalances,
  buildPartyIndex,
  isFamilyParty,
  partyOf,
  partyRawId,
} from '../families/parties.util';

const USER_SELECT = { id: true, name: true, emoji: true, color: true, avatarUrl: true } as const;

@Injectable()
export class BalancesService {
  constructor(private prisma: PrismaService) {}

  /** Soldes bruts par personne (pas de contrôle d'accès ici). */
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

  /** Soldes par entité : une famille a un solde commun, une personne seule le sien. */
  async partySummary(groupId: string) {
    const [{ totalCents, balances }, links] = await Promise.all([
      this.summary(groupId),
      this.prisma.membership.findMany({
        where: { groupId },
        select: { userId: true, familyId: true },
        orderBy: { joinedAt: 'asc' },
      }),
    ]);
    const index = buildPartyIndex(links);
    // Ordre stable : membres actuels d'abord (ordre d'arrivée), puis anciens membres.
    const order = new Map(links.map((l, i) => [l.userId, i]));
    const sorted = [...balances].sort(
      (a, b) => (order.get(a.userId) ?? 1e9) - (order.get(b.userId) ?? 1e9),
    );
    return { totalCents, index, parties: aggregateBalances(sorted, index) };
  }

  /** Solde de l'entité d'une personne (sa famille, ou elle seule). */
  async balanceOf(groupId: string, userId: string) {
    const { totalCents, index, parties } = await this.partySummary(groupId);
    const mine = parties.find((p) => p.partyId === partyOf(index, userId));
    return { totalCents, myBalanceCents: mine?.balanceCents ?? 0 };
  }

  /** Vue complète pour l'écran « Soldes » : qui doit quoi à qui, par entité. */
  async forGroup(userId: string, groupId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) throw new NotFoundException('Troupeau introuvable.');

    const { totalCents, parties } = await this.partySummary(groupId);

    const [users, families] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: parties.flatMap((p) => p.userIds) } },
        select: USER_SELECT,
      }),
      this.prisma.family.findMany({ where: { groupId }, select: { id: true, name: true } }),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const familyById = new Map(families.map((f) => [f.id, f]));

    const describe = (p: PartyBalance) => {
      const members = p.userIds.map((id) => userById.get(id)).filter(Boolean);
      const family = isFamilyParty(p.partyId) ? familyById.get(partyRawId(p.partyId)) : undefined;
      return {
        partyId: p.partyId,
        kind: family ? ('family' as const) : ('member' as const),
        familyId: family?.id ?? null,
        name: family?.name ?? members[0]?.name ?? 'Ancien membre',
        members,
      };
    };

    const byParty = new Map(parties.map((p) => [p.partyId, p]));
    const detailed = parties
      .map((p) => ({
        ...describe(p),
        paidCents: p.paidCents,
        owedCents: p.owedCents,
        balanceCents: p.balanceCents,
      }))
      .sort((a, b) => b.balanceCents - a.balanceCents);

    const reimbursements = simplifyDebts(parties.map((p) => ({ ...p, userId: p.partyId }))).map(
      (r) => {
        const from = describe(byParty.get(r.fromUserId)!);
        const to = describe(byParty.get(r.toUserId)!);
        return {
          fromPartyId: r.fromUserId,
          toPartyId: r.toUserId,
          amountCents: r.amountCents,
          from,
          to,
          // Personnes proposées par défaut pour enregistrer le remboursement.
          fromUserId: from.members[0]?.id,
          toUserId: to.members[0]?.id,
        };
      },
    );

    const currentParties = new Set(
      (
        await this.prisma.membership.findMany({
          where: { groupId },
          select: { userId: true, familyId: true },
        })
      ).map((m) => m.familyId ?? m.userId),
    );

    return {
      groupId,
      totalCents,
      averagePerPartyCents: currentParties.size ? Math.round(totalCents / currentParties.size) : 0,
      balances: detailed,
      reimbursements,
    };
  }
}
