import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SectionService {
  private readonly logger = new Logger(SectionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all sections, optionally filtered by studyPeriod
   */
  async getAll(studyPeriod?: string) {
    const where: any = {};
    if (studyPeriod && (studyPeriod === 'MORNING' || studyPeriod === 'EVENING')) {
      where.studyPeriod = studyPeriod;
    }

    const sections = await this.prisma.section.findMany({
      where,
      orderBy: [
        { studyPeriod: 'asc' },
        { name: 'asc' },
      ],
    });

    return sections;
  }

  /**
   * Create a new section
   */
  async create(data: { studyPeriod: string; name: string; label?: string }) {
    const period = data.studyPeriod?.trim().toUpperCase() === 'EVENING' ? 'EVENING' : 'MORNING';
    const cleanName = data.name.trim();

    if (!cleanName) {
      throw new ConflictException('يرجى تحديد اسم أو رقم الشعبة');
    }

    const existing = await this.prisma.section.findUnique({
      where: {
        studyPeriod_name: {
          studyPeriod: period,
          name: cleanName,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`الشعبة (${cleanName}) موجودة مسبقاً في هذه الدراسة!`);
    }

    const label = data.label?.trim() || `الشعبة ${cleanName}`;

    const section = await this.prisma.section.create({
      data: {
        studyPeriod: period,
        name: cleanName,
        label,
      },
    });

    this.logger.log(`Created section: ${period} - ${cleanName}`);
    return section;
  }

  /**
   * Delete a section by ID
   */
  async delete(id: string) {
    const section = await this.prisma.section.findUnique({ where: { id } });
    if (!section) {
      throw new NotFoundException('الشعبة غير موجودة');
    }

    await this.prisma.section.delete({ where: { id } });
    this.logger.log(`Deleted section: ${section.studyPeriod} - ${section.name}`);
    return { success: true, message: `تم حذف الشعبة (${section.name}) بنجاح` };
  }
}

