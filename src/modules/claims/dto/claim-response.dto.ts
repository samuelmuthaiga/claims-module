export class CustomerDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string;
}

export class CarDto {
  id!: string;
  loanId!: string;
  acquireId!: string;
  warrantyId!: string;
  vin!: string;
  plateNumber!: string;
  make!: string;
  model!: string;
  year!: number;
  price!: number;
  currency!: string;
  customerId!: string;
}

export class VendorDto {
  id!: string;
  name!: string;
  country!: string;
}

export class QaDto {
  inspectionId!: number;
  state!: string;
  round!: number;
  failedItemCount!: number;
  assignedInspector!: string;
  slaDueAt!: string;
  overdue!: boolean;
}

export class ClaimResponseDto {
  id!: number;
  reference!: string;
  jobOrderNumber!: string;
  claimType!: string;
  warrantyType!: string;
  status!: string;
  statusLabel!: string;
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
  upfrontAmount!: number;
  totalAmount!: number;
  warrantyCapUsedAmount!: number;
  qa!: QaDto;
  version!: number;
  createdAt!: string;
  updatedAt!: string;
}
