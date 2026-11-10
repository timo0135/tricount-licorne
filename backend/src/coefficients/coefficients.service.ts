import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CATEGORIES } from '../common/categories';
import { splitByWeights } from '../common/split';
import { UpdateCoefficientsDto } from './dto/update-coefficients.dto';
import {
  ShareBp,
  TOTAL_BP,
  equalShares,
  normalizeShares,
  sumBp,
  withNewMember,
} from './coefficients.util';
import {
  MemberLink,
  buildPartyIndex,
  equalizeFamilies,
  expandPartyShares,
  membersByParty,
  partyShares,
  splitByParties,
} from '../families/parties.util';

const USER_SELECT = { id: true, name: true, emoji: true, color: true, avatarUrl: true } as const;

@Injectable()
export class CoefficientsService {
  constructor(private prisma: PrismaService) {}

  private async assertMember(userId: string, groupId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) throw new NotFoundException('Troupeau introuvable.');
    return membership;
  }

  /** Crée la matrice par défaut (tout le monde à parts égales) à la création du troupeau. */
  async initForGroup(groupId: string, userIds: string[]) {
    const base = equalShares(userIds);
    await this.prisma.categoryShare.createMany({
      data: CATEGORIES.flatMap((category) =>
        base.map((s) => ({ groupId, userId: s.userId, category, shareBp: s.shareBp })),
      ),
      skipDuplicates: true,
    });
  }

  /** Membres actuels et leur famille, dans l'ordre d'arrivée. */
  async links(groupId: string): Promise<MemberLink[]> {
    return this.prisma.membership.findMany({
      where: { groupId },
      select: { userId: true, familyId: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /**
   * Aligne la matrice sur les membres actuels : ajoute les nouveaux membres,
   * retire ceux qui sont partis, renormalise chaque catégorie à 100 % et
   * répartit le coefficient de chaque famille à parts égales entre ses membres.
   * Idempotent — n'écrit que si quelque chose a bougé.
   */
  async sync(groupId: string) {
    const [links, rows] = await Promise.all([
      this.links(groupId),
      this.prisma.categoryShare.findMany({ where: { groupId } }),
    ]);

    const memberIds = links.map((l) => l.userId);
    const memberSet = new Set(memberIds);
    const operations: any[] = [];

    for (const category of CATEGORIES) {
      const existing = rows.filter((r) => r.category === category);
      const kept = existing.filter((r) => memberSet.has(r.userId));
      const stale = existing.filter((r) => !memberSet.has(r.userId));
      const missing = memberIds.filter((id) => !kept.some((r) => r.userId === id));

      let entries: ShareBp[] = kept.map((r) => ({ userId: r.userId, shareBp: r.shareBp }));
      if (stale.length || missing.length || sumBp(kept) !== TOTAL_BP) {
        for (const userId of missing) entries = withNewMember(entries, userId);
        entries = entries.length ? normalizeShares(entries) : equalShares(memberIds);
      }
      entries = equalizeFamilies(entries, links);

      for (const row of stale) {
        operations.push(this.prisma.categoryShare.delete({ where: { id: row.id } }));
      }
      for (const entry of entries) {
        const current = kept.find((r) => r.userId === entry.userId);
        if (current?.shareBp === entry.shareBp) continue;
        operations.push(
          this.prisma.categoryShare.upsert({
            where: {
              groupId_userId_category: { groupId, userId: entry.userId, category },
            },
            create: { groupId, userId: entry.userId, category, shareBp: entry.shareBp },
            update: { shareBp: entry.shareBp },
          }),
        );
      }
    }

    if (operations.length) await this.prisma.$transaction(operations);
  }

  /**
   * Matrice complète, prête à afficher : catégories × entités. Une famille est
   * une seule ligne ; son coefficient est la somme de ceux de ses membres.
   */
  async matrix(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    await this.sync(groupId);

    const [rows, members, families] = await Promise.all([
      this.prisma.categoryShare.findMany({ where: { groupId } }),
      this.prisma.membership.findMany({
        where: { groupId },
        select: { familyId: true, user: { select: USER_SELECT } },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.family.findMany({ where: { groupId }, select: { id: true, name: true } }),
    ]);

    const links = members.map((m) => ({ userId: m.user.id, familyId: m.familyId }));
    const index = buildPartyIndex(links);
    const grouped = membersByParty(links);
    const familyName = new Map(families.map((f) => [f.id, f.name]));
    const userName = new Map(members.map((m) => [m.user.id, m.user.name]));

    const parties = [...grouped.entries()].map(([partyId, userIds]) => {
      const familyId = members.find((m) => m.user.id === userIds[0])?.familyId ?? null;
      return {
        id: partyId,
        kind: familyId ? ('family' as const) : ('member' as const),
        familyId,
        name: familyId ? (familyName.get(familyId) ?? 'Famille') : (userName.get(userIds[0]) ?? ''),
        userIds,
      };
    });

    return {
      groupId,
      totalBp: TOTAL_BP,
      members: members.map((m) => ({ ...m.user, familyId: m.familyId })),
      parties,
      categories: CATEGORIES.map((category) => {
        const memberShares = rows
          .filter((r) => r.category === category)
          .map((r) => ({ userId: r.userId, shareBp: r.shareBp }));
        const byParty = partyShares(memberShares, index);
        return {
          category,
          shares: parties.map((p) => ({ partyId: p.id, shareBp: byParty.get(p.id) ?? 0 })),
          memberShares,
        };
      }),
    };
  }

  /** Poids à utiliser pour répartir une dépense d'une catégorie donnée. */
  async weightsFor(groupId: string, category: string): Promise<Map<string, number>> {
    await this.sync(groupId);
    const rows = await this.prisma.categoryShare.findMany({
      where: { groupId, category },
    });
    return new Map(rows.map((r) => [r.userId, r.shareBp]));
  }

  /** Enregistre la matrice saisie par entité ; chaque famille est répartie entre ses membres. */
  async replace(userId: string, groupId: string, dto: UpdateCoefficientsDto) {
    await this.assertMember(userId, groupId);

    const links = await this.links(groupId);
    const grouped = membersByParty(links);
    const partyIds = new Set(grouped.keys());

    const operations: any[] = [];

    for (const entry of dto.categories) {
      if (!CATEGORIES.includes(entry.category as never)) {
        throw new BadRequestException(`Catégorie inconnue : ${entry.category}`);
      }

      const unknown = entry.shares.find((s) => !partyIds.has(s.partyId));
      if (unknown) {
        throw new BadRequestException(
          'Une entité de la répartition ne fait pas partie du troupeau (recharge la page).',
        );
      }

      const seen = new Set(entry.shares.map((s) => s.partyId));
      if (seen.size !== entry.shares.length) {
        throw new BadRequestException('Une entité apparaît deux fois dans la même catégorie.');
      }
      if (seen.size !== partyIds.size) {
        throw new BadRequestException(
          'Chaque membre ou famille du troupeau doit avoir un coefficient (0 % est autorisé).',
        );
      }

      const total = entry.shares.reduce((sum, s) => sum + s.shareBp, 0);
      if (total !== TOTAL_BP) {
        throw new BadRequestException(
          `Le total de la catégorie « ${entry.category} » doit faire 100 % (actuellement ${(total / 100).toFixed(2)} %)`,
        );
      }

      for (const share of expandPartyShares(entry.shares, grouped)) {
        operations.push(
          this.prisma.categoryShare.upsert({
            where: {
              groupId_userId_category: {
                groupId,
                userId: share.userId,
                category: entry.category,
              },
            },
            create: {
              groupId,
              userId: share.userId,
              category: entry.category,
              shareBp: share.shareBp,
            },
            update: { shareBp: share.shareBp },
          }),
        );
      }
    }

    if (operations.length) await this.prisma.$transaction(operations);
    return this.matrix(userId, groupId);
  }

  /**
   * Recalcule les dépenses déjà saisies en mode automatique avec les coefficients
   * actuels. Les licornes exclues d'une dépense précise le restent.
   */
  async applyToExistingExpenses(userId: string, groupId: string) {
    await this.assertMember(userId, groupId);
    await this.sync(groupId);

    const expenses = await this.prisma.expense.findMany({
      where: { groupId, splitMode: 'AUTO' },
      include: { shares: true },
    });

    const weightsByCategory = new Map<string, Map<string, number>>();
    const index = buildPartyIndex(await this.links(groupId));
    let updated = 0;

    for (const expense of expenses) {
      if (!weightsByCategory.has(expense.category)) {
        weightsByCategory.set(expense.category, await this.weightsFor(groupId, expense.category));
      }
      const weights = weightsByCategory.get(expense.category);

      const participants = expense.shares
        .map((s) => ({ userId: s.userId, weight: weights.get(s.userId) ?? 0 }))
        .filter((p) => p.weight > 0);

      const computed = participants.length
        ? splitByParties(expense.amountCents, participants, index)
        : splitByWeights(
            expense.amountCents,
            expense.shares.map((s) => ({ userId: s.userId, weight: 1 })),
          );

      await this.prisma.$transaction([
        this.prisma.expenseShare.deleteMany({ where: { expenseId: expense.id } }),
        this.prisma.expense.update({
          where: { id: expense.id },
          data: {
            shares: {
              create: computed.map((c) => ({
                userId: c.userId,
                weight: c.weight,
                amountCents: c.amountCents,
              })),
            },
          },
        }),
      ]);
      updated += 1;
    }

    return { updated };
  }
}
