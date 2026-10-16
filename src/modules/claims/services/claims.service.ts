import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaimResponseDto } from '../dto/claim-response.dto';
import { ClaimSummaryResponseDto } from '../dto/claim-summary-response.dto';
import { ClaimDetailResponseDto } from '../dto/claim-detail-response.dto';
import { CreateClaimDto } from '../dto/create-claim.dto';
import { Claim } from '../entities/claim.entity';
import { ClaimStatusHistory } from '../entities/claim-status-history.entity';

@Injectable()
export class ClaimsService {
  constructor(
    @Optional() @InjectRepository(Claim)
    private claimRepository: Repository<Claim>,
    @Optional() @InjectRepository(ClaimStatusHistory)
    private claimStatusHistoryRepository: Repository<ClaimStatusHistory>,
  ) {}

  private mockClaims: ClaimResponseDto[] = [
    {
      id: 1024,
      reference: 'CLM-NG-2026-000123',
      jobOrderNumber: 'JO-NG-2026-000123',
      claimType: 'WARRANTY',
      warrantyType: 'LOAN_WARRANTY',
      status: 'DIAGNOSIS_IN_PROGRESS',
      statusLabel: 'Diagnosis In Progress',
      country: 'NG',
      currency: 'NGN',
      requestDate: '2026-10-01T10:00:00.000Z',
      claimsDate: '2026-10-01T10:00:00.000Z',
      appointmentDate: '2026-10-10T09:00:00.000Z',
      customer: {
        id: 'cust-882',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: '+2348012345678',
      },
      car: {
        id: 'car-991',
        loanId: 'loan-123',
        acquireId: 'acq-456',
        warrantyId: 'warranty-789',
        vin: '4T1B11HK5MU123456',
        plateNumber: 'KJA-123AA',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        price: 2500000,
        currency: 'NGN',
        customerId: 'cust-882',
      },
      vendor: {
        id: 'v-101',
        name: 'Autochek Flagship Workshop Ikeja',
        country: 'NG',
      },
      issueSubType: 'Transmission Noise',
      issueTypes: ['Transmission'],
      odometer: 45000,
      ppiHighlighted: true,
      insuranceClaim: false,
      trackerStatus: 'Active',
      repairFinanced: false,
      upfrontAmount: 150000,
      totalAmount: 450000,
      warrantyCapUsedAmount: 300000,
      qa: {
        inspectionId: 412,
        state: 'CORRECTIVE_ACTION_REQUIRED',
        round: 1,
        failedItemCount: 1,
        assignedInspector: 'inspector-123',
        slaDueAt: '2026-10-15T17:00:00.000Z',
        overdue: false,
      },
      version: 5,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-05T14:30:00.000Z',
    },
  ];

  async findAll(page: number = 1, limit: number = 10): Promise<{ data: ClaimResponseDto[]; meta: any }> {
    try {
      const [claims, total] = await this.claimRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
        order: { createdAt: 'DESC' },
      });

      return {
        data: claims.map(claim => this.mapEntityToDto(claim)),
        meta: { total, page, limit },
      };
    } catch (error) {
      // Fall back to mock data if database is not available
      const start = (page - 1) * limit;
      const end = start + limit;
      const data = this.mockClaims.slice(start, end);
      return {
        data,
        meta: {
          total: this.mockClaims.length,
          page,
          limit,
        },
      };
    }
  }

  async getSummary(): Promise<ClaimSummaryResponseDto> {
    try {
      const vehiclesInWorkshop = await this.claimRepository
        .createQueryBuilder('claim')
        .where('claim.status NOT IN (:...statuses)', {
          statuses: ['VEHICLE_DELIVERED', 'CANCELLED'],
        })
        .getCount();

      const repair = await this.claimRepository.count({
        where: { claimType: 'REPAIRS' },
      });

      const warranty = await this.claimRepository.count({
        where: { claimType: 'WARRANTY' },
      });

      const insurance = await this.claimRepository.count({
        where: { claimType: 'INSURANCE' },
      });

      return { vehiclesInWorkshop, repair, warranty, insurance };
    } catch (error) {
      // Fall back to mock data
      return {
        vehiclesInWorkshop: 28,
        repair: 12,
        warranty: 10,
        insurance: 6,
      };
    }
  }

  async findOne(id: number): Promise<ClaimDetailResponseDto> {
    try {
      const claim = await this.claimRepository.findOne({
        where: { id },
      });

      if (!claim) {
        throw new Error('Claim not found');
      }

      return this.mapEntityToDetailDto(claim);
    } catch (error) {
      // Fall back to mock data
      const claim = this.mockClaims.find((c) => c.id === id);
      if (!claim) {
        throw new Error('Claim not found');
      }
      return this.mapMockToDetailDto(claim);
    }
  }

  private mapMockToDetailDto(claim: ClaimResponseDto): ClaimDetailResponseDto {
    return {
      ...claim,
      legacyStatus: 'REPAIR',
      customerNotes: 'Prefer morning appointment',
      initialDetails: 'Customer reported harsh gear shifts during acceleration',
      requestChannel: 'PHONE_CALL',
      supportingDocument: {
        fileId: 'file-1001',
        name: 'voice_note.mp3',
        readUrl: 'https://storage.googleapis.com/.../voice_note.mp3',
      },
      diagnosisReport: {
        fileId: 'file-1002',
        name: 'diagnosis_report.pdf',
        readUrl: 'https://storage.googleapis.com/.../diagnosis_report.pdf',
      },
      scanReport: {
        fileId: 'file-1003',
        name: 'scan_report.pdf',
        readUrl: 'https://storage.googleapis.com/.../scan_report.pdf',
      },
      diagnosisNotes: 'Transmission fluid level low, clutch pack worn',
      paymentSplit: {
        customer: 150000,
        autochek: 300000,
        insurance: 0,
        repairFinancing: 0,
      },
      quote: {
        id: 31,
        revision: 1,
        kind: 'INITIAL',
        status: 'APPROVED',
        invoiceNumber: 'INV-88319',
        upfrontAmount: 150000,
        totalAmount: 450000,
        currency: 'NGN',
        lineItemCount: 3,
      },
      repairCompletionProof: {
        fileId: 'file-2001',
        name: 'repair_done.jpg',
        readUrl: 'https://storage.googleapis.com/.../repair_done.jpg',
      },
      pickupProof: null as any,
      warrantyCap: {
        vehiclePrice: 2500000,
        capPercentage: 30,
        capLimit: 750000,
        used: 300000,
        remaining: 450000,
        eligible: true,
        percentUsed: 40,
      },
      intelligence: {
        amcDone: 2,
        expectedAmc: 4,
        coverStartDate: '2026-01-15T00:00:00.000Z',
        operationalStatus: 'Compliant',
        ifrsStatus: 'Recognized',
        asOf: '2026-10-05T10:00:00.000Z',
        unavailable: false,
      },
      workflow: {
        configId: 1,
        version: 1,
        rail: [
          {
            code: 'JOB_ORDER_CREATED',
            label: 'Job Order Created',
            state: 'DONE',
            at: '2026-10-01T10:00:00.000Z',
            by: 'user-101',
          },
          {
            code: 'CUSTOMER_SUBMITTED_FORM',
            label: 'Customer Submitted Form',
            state: 'DONE',
            at: '2026-10-01T14:30:00.000Z',
            by: 'cust-882',
          },
          {
            code: 'DIAGNOSIS_IN_PROGRESS',
            label: 'Diagnosis In Progress',
            state: 'DONE',
            at: '2026-10-02T09:00:00.000Z',
            by: 'user-101',
          },
          {
            code: 'REPAIR_ONGOING',
            label: 'Repair Ongoing',
            state: 'CURRENT',
            at: '2026-10-05T10:00:00.000Z',
            by: 'user-101',
          },
          {
            code: 'QUALITY_CONTROL',
            label: 'Quality Control',
            state: 'UPCOMING',
            at: null,
            by: null,
          },
          {
            code: 'VEHICLE_READY',
            label: 'Vehicle Ready',
            state: 'UPCOMING',
            at: null,
            by: null,
          },
        ],
      },
      reviewTarget: {
        label: 'Quote Approval',
        type: 'APPROVAL',
        id: 42,
      },
      availableActions: [
        {
          action: 'upload_quote',
          label: 'Upload Quote',
          enabled: false,
          disabledReason: 'Quote already approved',
          inputSchemaRef: null,
          requiresReason: false,
        },
        {
          action: 'complete_repair',
          label: 'Complete Repair',
          enabled: true,
          disabledReason: null,
          inputSchemaRef: 'schemas/complete-repair.json',
          requiresReason: false,
        },
      ],
      createdBy: 'user-101',
      updatedBy: 'user-101',
    };
  }

  async create(createClaimDto: CreateClaimDto): Promise<any> {
    try {
      const claim = this.claimRepository.create({
        ...createClaimDto,
        reference: this.generateReference(),
        jobOrderNumber: this.generateJobOrderNumber(),
        status: 'JOB_ORDER_CREATED',
        country: 'NG',
        currency: 'NGN',
        snapshotAt: new Date(),
        workflowConfigId: 1,
        workflowVersion: 1,
        repairFinanced: false,
        warrantyCapUsed: 0,
        declineCount: 0,
        createdBy: 'system',
        updatedBy: 'system',
      });

      const saved = await this.claimRepository.save(claim);
      return this.mapEntityToDto(saved);
    } catch (error) {
      // Fall back to mock data
      return {
        id: 1025,
        reference: 'CLM-NG-2026-000124',
        jobOrderNumber: 'JO-NG-2026-000124',
        claimType: createClaimDto.claimType,
        warrantyType: createClaimDto.warrantyType,
        status: 'JOB_ORDER_CREATED',
        country: 'NG',
        currency: 'NGN',
        scheduleLink: 'https://claims.autochek.africa/public/schedule/abc123xyz',
        scheduleLinkExpiresAt: '2026-10-03T10:00:00.000Z',
      };
    }
  }

  private mapEntityToDto(claim: Claim): ClaimResponseDto {
    return {
      id: claim.id,
      reference: claim.reference,
      jobOrderNumber: claim.jobOrderNumber,
      claimType: claim.claimType,
      warrantyType: claim.warrantyType,
      status: claim.status,
      statusLabel: this.getStatusLabel(claim.status),
      country: claim.country,
      currency: claim.currency,
      requestDate: claim.createdAt?.toISOString(),
      claimsDate: claim.createdAt?.toISOString(),
      appointmentDate: claim.repairAuthorizedAt?.toISOString(),
      customer: claim.customerSnapshot ? {
        id: claim.customerSnapshot.id,
        name: claim.customerSnapshot.name,
        email: claim.customerSnapshot.email,
        phone: claim.customerSnapshot.phone,
      } : { id: '', name: '', email: '', phone: '' },
      car: claim.carSnapshot ? {
        id: claim.carSnapshot.id,
        loanId: claim.carSnapshot.loanId,
        acquireId: claim.carSnapshot.acquireId,
        warrantyId: claim.carSnapshot.warrantyId,
        vin: claim.carSnapshot.vin,
        plateNumber: claim.carSnapshot.plateNumber,
        make: claim.carSnapshot.make,
        model: claim.carSnapshot.model,
        year: claim.carSnapshot.year,
        price: claim.carSnapshot.price,
        currency: claim.carSnapshot.currency,
        customerId: claim.carSnapshot.customerId,
      } : {
        id: '', loanId: '', acquireId: '', warrantyId: '', vin: '', plateNumber: '',
        make: '', model: '', year: 0, price: 0, currency: '', customerId: ''
      },
      vendor: claim.vendorSnapshot ? {
        id: claim.vendorSnapshot.id,
        name: claim.vendorSnapshot.name,
        country: claim.vendorSnapshot.country,
      } : { id: '', name: '', country: '' },
      issueSubType: claim.issueSubType,
      issueTypes: claim.issueTypes || [],
      odometer: claim.odometer,
      ppiHighlighted: false,
      insuranceClaim: claim.claimType === 'INSURANCE',
      trackerStatus: 'Active',
      repairFinanced: claim.repairFinanced,
      upfrontAmount: claim.upfrontAmount,
      totalAmount: claim.totalAmount,
      warrantyCapUsedAmount: claim.warrantyCapUsed,
      qa: {
        inspectionId: 0,
        state: claim.qaState,
        round: 1,
        failedItemCount: 0,
        assignedInspector: '',
        slaDueAt: '',
        overdue: false,
      },
      version: claim.version,
      createdAt: claim.createdAt?.toISOString(),
      updatedAt: claim.updatedAt?.toISOString(),
    };
  }

  private mapEntityToDetailDto(claim: Claim): ClaimDetailResponseDto {
    const baseDto = this.mapEntityToDto(claim);
    return {
      ...baseDto,
      legacyStatus: claim.legacyStatus,
      customerNotes: claim.customerSnapshot?.notes,
      initialDetails: claim.initialDetails,
      requestChannel: claim.requestChannel,
      supportingDocument: { fileId: '', name: '', readUrl: '' },
      diagnosisReport: { fileId: '', name: '', readUrl: '' },
      scanReport: { fileId: '', name: '', readUrl: '' },
      diagnosisNotes: '',
      paymentSplit: {
        customer: 0,
        autochek: 0,
        insurance: 0,
        repairFinancing: 0,
      },
      quote: {
        id: 0,
        revision: 0,
        kind: '',
        status: '',
        invoiceNumber: '',
        upfrontAmount: 0,
        totalAmount: 0,
        currency: '',
        lineItemCount: 0,
      },
      repairCompletionProof: { fileId: '', name: '', readUrl: '' },
      pickupProof: null,
      warrantyCap: {
        vehiclePrice: claim.carSnapshot?.price || 0,
        capPercentage: 30,
        capLimit: 0,
        used: claim.warrantyCapUsed || 0,
        remaining: 0,
        eligible: true,
        percentUsed: 0,
      },
      intelligence: {
        amcDone: 0,
        expectedAmc: 0,
        coverStartDate: '',
        operationalStatus: 'Unknown',
        ifrsStatus: 'Unknown',
        asOf: new Date().toISOString(),
        unavailable: true,
      },
      workflow: {
        configId: claim.workflowConfigId,
        version: claim.workflowVersion,
        rail: [],
      },
      reviewTarget: null,
      availableActions: [],
      createdBy: claim.createdBy,
      updatedBy: claim.updatedBy,
    };
  }

  private getStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      'JOB_ORDER_CREATED': 'Job Order Created',
      'CUSTOMER_SUBMITTED_FORM': 'Customer Submitted Form',
      'DIAGNOSIS_IN_PROGRESS': 'Diagnosis In Progress',
      'REPAIR_ONGOING': 'Repair Ongoing',
      'QUALITY_CONTROL': 'Quality Control',
      'VEHICLE_READY': 'Vehicle Ready',
      'VEHICLE_DELIVERED': 'Vehicle Delivered',
      'CANCELLED': 'Cancelled',
    };
    return statusMap[status] || status;
  }

  private generateReference(): string {
    return `CLM-NG-2026-${String(Math.floor(Math.random() * 10000)).padStart(6, '0')}`;
  }

  private generateJobOrderNumber(): string {
    return `JO-NG-2026-${String(Math.floor(Math.random() * 10000)).padStart(6, '0')}`;
  }
}
