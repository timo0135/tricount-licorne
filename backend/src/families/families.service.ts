import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CoefficientsService } from '../coefficients/coefficients.service';
import { CreateFamilyDto, UpdateFamilyDto } from './dto/family.dto';

/**
 * Familles d'un troupeau. Rattacher des membres à une famille fusionne leurs
 * coefficients (la somme est conservée, puis répartie à parts égales) ; leurs
 * soldes et remboursements sont désormais calculés ensemble.
 */
@Injectable()
export class FamiliesService {
  constructor(
    private prisma: PrismaService,
    private groups: GroupsService,
    private coefficients: CoefficientsService,
  ) {}

  async create(userId: string, groupId: string, dto: CreateFamilyDto) {
    await this.groups.assertMember(userId, groupId);
    await this.assertMembers(groupId, dto.memberIds);

    await this.prisma.$transaction(async (tx) => {
      const family = await tx.family.create({ data: { groupId, name: dto.name.trim() } });
      await tx.membership.updateMany({
        where: { groupId, userId: { in: dto.memberIds } },
        data: { familyId: family.id },
      });
    });

    return this.afterChange(userId, groupId);
  }

  async update(userId: string, groupId: string, familyId: string, dto: UpdateFamilyDto) {
    await this.groups.assertMember(userId, groupId);
    await this.findFamily(groupId, familyId);
    if (dto.memberIds) await this.assertMembers(groupId, dto.memberIds);

    await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.family.update({ where: { id: familyId }, data: { name: dto.name.trim() } });
      }
      if (dto.memberIds) {
        await tx.membership.updateMany({
          where: { groupId, familyId, userId: { notIn: dto.memberIds } },
          data: { familyId: null },
        });
        await tx.membership.updateMany({
          where: { groupId, userId: { in: dto.memberIds } },
          data: { familyId },
        });
      }
    });

    return this.afterChange(userId, groupId);
  }

  /** Supprime la famille : ses membres redeviennent des entités à part entière. */
  async remove(userId: string, groupId: string, familyId: string) {
    await this.groups.assertMember(userId, groupId);
    await this.findFamily(groupId, familyId);
    await this.prisma.family.delete({ where: { id: familyId } });
    return this.afterChange(userId, groupId);
  }

  private async findFamily(groupId: string, familyId: string) {
    const family = await this.prisma.family.findFirst({ where: { id: familyId, groupId } });
    if (!family) throw new NotFoundException('Famille introuvable.');
    return family;
  }

  private async assertMembers(groupId: string, memberIds: string[]) {
    const count = await this.prisma.membership.count({
      where: { groupId, userId: { in: memberIds } },
    });
    if (count !== memberIds.length) {
      throw new BadRequestException('Chaque personne de la famille doit faire partie du troupeau.');
    }
  }

  /** Familles vidées supprimées, coefficients réalignés, troupeau renvoyé à jour. */
  private async afterChange(userId: string, groupId: string) {
    await this.prisma.family.deleteMany({ where: { groupId, members: { none: {} } } });
    await this.coefficients.sync(groupId);
    await this.prisma.group.update({ where: { id: groupId }, data: { updatedAt: new Date() } });
    return this.groups.findOne(userId, groupId);
  }
}
