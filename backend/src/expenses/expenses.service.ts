import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CoefficientsService } from '../coefficients/coefficients.service';
import { CreateExpenseDto, SplitModeDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ComputedShare, splitByWeights, validateExactShares } from '../common/split';

const EXPENSE_INCLUDE = {
  paidBy: { select: { id: true, name: true, emoji: true, color: true } },
  createdBy: { select: { id: true, name: true, emoji: true } },
  shares: {
    include: { user: { select: { id: true, name: true, emoji: true, color: true } } },
  },
} as const;

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private groups: GroupsService,
    private coefficients: CoefficientsService,
  ) {}

  async findAll(userId: string, groupId: string, category?: string) {
    await this.groups.assertMember(userId, groupId);
    return this.prisma.expense.findMany({
      where: { groupId, ...(category ? { category } : {}) },
      include: EXPENSE_INCLUDE,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(userId: string, groupId: string, expenseId: string) {
    await this.groups.assertMember(userId, groupId);
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, groupId },
      include: EXPENSE_INCLUDE,
    });
    if (!expense) throw new NotFoundException('Dépense introuvable');
    return expense;
  }

  async create(userId: string, groupId: string, dto: CreateExpenseDto) {
    await this.groups.assertMember(userId, groupId);

    const paidById = dto.paidById ?? userId;
    const memberIds = await this.memberIds(groupId);
    this.assertInGroup(memberIds, [paidById], 'La licorne qui paie');

    const category = dto.category ?? 'autre';
    const shares = await this.buildShares(groupId, memberIds, dto.amountCents, category, dto);

    const expense = await this.prisma.expense.create({
      include: EXPENSE_INCLUDE,
      data: {
        groupId,
        title: dto.title.trim(),
        amountCents: dto.amountCents,
        date: dto.date ? new Date(dto.date) : new Date(),
        category,
        note: dto.note,
        splitMode: dto.splitMode ?? SplitModeDto.AUTO,
        paidById,
        createdById: userId,
        shares: {
          create: shares.map((s) => ({
            userId: s.userId,
            weight: s.weight,
            amountCents: s.amountCents,
          })),
        },
      },
    });

    await this.touchGroup(groupId);
    return expense;
  }

  async update(userId: string, groupId: string, expenseId: string, dto: UpdateExpenseDto) {
    await this.groups.assertMember(userId, groupId);
    const existing = await this.prisma.expense.findFirst({
      where: { id: expenseId, groupId },
      include: { shares: true },
    });
    if (!existing) throw new NotFoundException('Dépense introuvable');

    const memberIds = await this.memberIds(groupId);
    const paidById = dto.paidById ?? existing.paidById;
    this.assertInGroup(memberIds, [paidById], 'La licorne qui paie');

    const amountCents = dto.amountCents ?? existing.amountCents;
    const splitMode = dto.splitMode ?? (existing.splitMode as SplitModeDto);

    // Si la répartition n'est pas renvoyée, on réutilise les participants existants.
    const participants =
      dto.participants ??
      (splitMode === SplitModeDto.AUTO
        ? undefined
        : existing.shares.map((s) => ({
            userId: s.userId,
            weight: s.weight,
            amountCents: splitMode === SplitModeDto.EXACT ? s.amountCents : undefined,
          })));

    const category = dto.category ?? existing.category;
    const shares = await this.buildShares(groupId, memberIds, amountCents, category, {
      ...dto,
      splitMode,
      participants,
    });

    await this.prisma.$transaction([
      this.prisma.expenseShare.deleteMany({ where: { expenseId } }),
      this.prisma.expense.update({
        where: { id: expenseId },
        data: {
          title: dto.title?.trim() ?? existing.title,
          amountCents,
          date: dto.date ? new Date(dto.date) : existing.date,
          category,
          note: dto.note ?? existing.note,
          splitMode,
          paidById,
          shares: {
            create: shares.map((s) => ({
              userId: s.userId,
              weight: s.weight,
              amountCents: s.amountCents,
            })),
          },
        },
      }),
    ]);

    await this.touchGroup(groupId);
    return this.findOne(userId, groupId, expenseId);
  }

  async remove(userId: string, groupId: string, expenseId: string) {
    await this.groups.assertMember(userId, groupId);
    const expense = await this.prisma.expense.findFirst({ where: { id: expenseId, groupId } });
    if (!expense) throw new NotFoundException('Dépense introuvable');

    await this.prisma.expense.delete({ where: { id: expenseId } });
    await this.touchGroup(groupId);
    return { deleted: true };
  }

  /** Statistiques par catégorie, pour le petit graphique du front. */
  async statsByCategory(userId: string, groupId: string) {
    await this.groups.assertMember(userId, groupId);
    const rows = await this.prisma.expense.groupBy({
      by: ['category'],
      where: { groupId },
      _sum: { amountCents: true },
      _count: true,
    });
    return rows
      .map((r) => ({
        category: r.category,
        totalCents: r._sum.amountCents ?? 0,
        count: r._count,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }

  // --- helpers -------------------------------------------------------------

  private async memberIds(groupId: string): Promise<string[]> {
    const members = await this.prisma.membership.findMany({
      where: { groupId },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((m) => m.userId);
  }

  private assertInGroup(memberIds: string[], ids: string[], label: string) {
    const missing = ids.filter((id) => !memberIds.includes(id));
    if (missing.length > 0) {
      throw new BadRequestException(`${label} doit faire partie du troupeau`);
    }
  }

  private async buildShares(
    groupId: string,
    memberIds: string[],
    amountCents: number,
    category: string,
    dto: Pick<CreateExpenseDto, 'splitMode' | 'participants'>,
  ): Promise<ComputedShare[]> {
    const mode = dto.splitMode ?? SplitModeDto.AUTO;
    const participants =
      dto.participants && dto.participants.length > 0
        ? dto.participants
        : memberIds.map((userId) => ({ userId, weight: 1 }));

    const unique = new Set(participants.map((p) => p.userId));
    if (unique.size !== participants.length) {
      throw new BadRequestException('Une licorne ne peut apparaître qu\'une fois dans la répartition');
    }
    this.assertInGroup(memberIds, [...unique], 'Chaque participant');

    try {
      if (mode === SplitModeDto.EXACT) {
        return validateExactShares(amountCents, participants);
      }

      // Mode automatique : les poids viennent de la matrice de coefficients
      // du troupeau, pour la catégorie de la dépense.
      if (mode === SplitModeDto.AUTO) {
        const coefficients = await this.coefficients.weightsFor(groupId, category);
        const weighted = participants
          .map((p) => ({ userId: p.userId, weight: coefficients.get(p.userId) ?? 0 }))
          .filter((p) => p.weight > 0);

        // Aucune licorne concernée n'a de coefficient : partage égal par défaut.
        if (weighted.length === 0) {
          return splitByWeights(
            amountCents,
            participants.map((p) => ({ userId: p.userId, weight: 1 })),
          );
        }
        return splitByWeights(amountCents, weighted);
      }

      const weighted =
        mode === SplitModeDto.EQUAL
          ? participants.map((p) => ({ userId: p.userId, weight: 1 }))
          : participants;
      return splitByWeights(amountCents, weighted);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  private touchGroup(groupId: string) {
    return this.prisma.group.update({ where: { id: groupId }, data: { updatedAt: new Date() } });
  }
}
