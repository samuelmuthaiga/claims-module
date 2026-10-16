import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalResponseDto, ApprovalSummaryResponseDto, ApprovalDecisionDto } from '../dto/approval.dto';
import { Approval } from '../entities/approval.entity';

@Injectable()
export class ApprovalsService {
  constructor(
    @Optional() @InjectRepository(Approval)
    private approvalRepository: Repository<Approval>,
  ) {}

  private mockApprovals: ApprovalResponseDto[] = [
    {
      id: 42,
      claimId: 1024,
      type: 'QUOTE',
      subjectId: 31,
      status: 'PENDING',
      submittedBy: 'user-101',
      submittedAt: '2026-10-05T10:00:00.000Z',
      decidedBy: null,
      decidedAt: null,
      decisionReason: null,
      version: 1,
    },
    {
      id: 43,
      claimId: 1023,
      type: 'QUOTE',
      subjectId: 30,
      status: 'APPROVED',
      submittedBy: 'user-102',
      submittedAt: '2026-10-04T09:00:00.000Z',
      decidedBy: 'user-201',
      decidedAt: '2026-10-04T14:00:00.000Z',
      decisionReason: 'Quote within warranty limits',
      version: 1,
    },
  ];

  async findAll(page: number = 1, limit: number = 10): Promise<{ data: ApprovalResponseDto[]; meta: any }> {
    try {
      const [approvals, total] = await this.approvalRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
        order: { submittedAt: 'DESC' },
      });

      return {
        data: approvals.map(a => this.mapEntityToDto(a)),
        meta: { total, page, limit },
      };
    } catch (error) {
      const start = (page - 1) * limit;
      const end = start + limit;
      const data = this.mockApprovals.slice(start, end);
      return {
        data,
        meta: {
          total: this.mockApprovals.length,
          page,
          limit,
        },
      };
    }
  }

  async getSummary(): Promise<ApprovalSummaryResponseDto> {
    try {
      const pending = await this.approvalRepository.count({ where: { status: 'PENDING' } });
      const approved = await this.approvalRepository.count({ where: { status: 'APPROVED' } });
      const declined = await this.approvalRepository.count({ where: { status: 'DECLINED' } });
      const total = await this.approvalRepository.count();

      return { pending, approved, declined, total };
    } catch (error) {
      const pending = this.mockApprovals.filter((a) => a.status === 'PENDING').length;
      const approved = this.mockApprovals.filter((a) => a.status === 'APPROVED').length;
      const declined = this.mockApprovals.filter((a) => a.status === 'DECLINED').length;
      return {
        pending,
        approved,
        declined,
        total: this.mockApprovals.length,
      };
    }
  }

  async findOne(id: number): Promise<ApprovalResponseDto> {
    try {
      const approval = await this.approvalRepository.findOne({
        where: { id },
      });
      if (!approval) {
        throw new Error('Approval not found');
      }
      return this.mapEntityToDto(approval);
    } catch (error) {
      const approval = this.mockApprovals.find((a) => a.id === id);
      if (!approval) {
        throw new Error('Approval not found');
      }
      return approval;
    }
  }

  async submitDecision(id: number, decisionDto: ApprovalDecisionDto): Promise<ApprovalResponseDto> {
    try {
      const approval = await this.approvalRepository.findOne({ where: { id } });
      if (!approval) {
        throw new Error('Approval not found');
      }
      approval.status = decisionDto.decision;
      approval.decidedBy = 'user-201';
      approval.decidedAt = new Date();
      approval.decisionReason = decisionDto.reason || null;
      const saved = await this.approvalRepository.save(approval);
      return this.mapEntityToDto(saved);
    } catch (error) {
      const approval = this.mockApprovals.find((a) => a.id === id);
      if (!approval) {
        throw new Error('Approval not found');
      }
      approval.status = decisionDto.decision;
      approval.decidedBy = 'user-201';
      approval.decidedAt = new Date().toISOString();
      approval.decisionReason = decisionDto.reason || null;
      return approval;
    }
  }

  private mapEntityToDto(approval: Approval): ApprovalResponseDto {
    return {
      id: approval.id,
      claimId: approval.claimId,
      type: approval.type,
      subjectId: approval.subjectId,
      status: approval.status,
      submittedBy: approval.submittedBy,
      submittedAt: approval.submittedAt?.toISOString() || '',
      decidedBy: approval.decidedBy,
      decidedAt: approval.decidedAt?.toISOString() || null,
      decisionReason: approval.decisionReason,
      version: approval.version,
    };
  }
}
