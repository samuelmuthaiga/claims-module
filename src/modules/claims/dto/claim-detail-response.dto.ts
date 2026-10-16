import { CustomerDto, CarDto, VendorDto, QaDto } from './claim-response.dto';

export class PaymentSplitDto {
  customer!: number;
  autochek!: number;
  insurance!: number;
  repairFinancing!: number;
}

export class QuoteDto {
  id!: number;
  revision!: number;
  kind!: string;
  status!: string;
  invoiceNumber!: string;
  upfrontAmount!: number;
  totalAmount!: number;
  currency!: string;
  lineItemCount!: number;
}

export class FileDto {
  fileId!: string;
  name!: string;
  readUrl!: string;
}

export class WarrantyCapDto {
  vehiclePrice!: number;
  capPercentage!: number;
  capLimit!: number;
  used!: number;
  remaining!: number;
  eligible!: boolean;
  percentUsed!: number;
}

export class IntelligenceDto {
  amcDone!: number;
  expectedAmc!: number;
  coverStartDate!: string;
  operationalStatus!: string;
  ifrsStatus!: string;
  asOf!: string;
  unavailable!: boolean;
}

export class WorkflowStepDto {
  code!: string;
  label!: string;
  state!: string;
  at!: string | null;
  by!: string | null;
}

export class WorkflowDto {
  configId!: number;
  version!: number;
  rail!: WorkflowStepDto[];
}

export class ActionDto {
  action!: string;
  label!: string;
  enabled!: boolean;
  disabledReason!: string | null;
  inputSchemaRef!: string | null;
  requiresReason!: boolean;
}

export class ClaimDetailResponseDto {
  id!: number;
  reference!: string;
  jobOrderNumber!: string;
  claimType!: string;
  warrantyType!: string;
  status!: string;
  statusLabel!: string;
  legacyStatus!: string;
  country!: string;
  currency!: string;
  requestDate!: string;
  claimsDate!: string;
  appointmentDate!: string;
  customer!: CustomerDto;
  car!: CarDto;
  vendor!: VendorDto;
  issueSubType!: string;
  issueTypes!: string[];
  odometer!: number;
  ppiHighlighted!: boolean;
  insuranceClaim!: boolean;
  trackerStatus!: string;
  repairFinanced!: boolean;
  customerNotes!: string;
  initialDetails!: string;
  requestChannel!: string;
  supportingDocument!: FileDto;
  diagnosisReport!: FileDto;
  scanReport!: FileDto;
  diagnosisNotes!: string;
  upfrontAmount!: number;
  totalAmount!: number;
  paymentSplit!: PaymentSplitDto;
  quote!: QuoteDto;
  repairCompletionProof!: FileDto;
  pickupProof!: FileDto | null;
  warrantyCapUsedAmount!: number;
  warrantyCap!: WarrantyCapDto;
  intelligence!: IntelligenceDto;
  workflow!: WorkflowDto;
  reviewTarget!: any;
  qa!: QaDto;
  availableActions!: ActionDto[];
  version!: number;
  createdAt!: string;
  updatedAt!: string;
  createdBy!: string | null;
  updatedBy!: string | null;
}
