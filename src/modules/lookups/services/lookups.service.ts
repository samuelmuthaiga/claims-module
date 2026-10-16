import { Injectable } from '@nestjs/common';
import { CarLookupDto, EnumDto, CountryDto, VendorDto } from '../dto/lookup.dto';

@Injectable()
export class LookupsService {
  private mockCars: CarLookupDto[] = [
    {
      value: 'car-991',
      label: '2021 Toyota Camry · KJA-123AA',
      email: 'jane.doe@example.com',
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
      customer: {
        id: 'cust-882',
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: '+2348012345678',
      },
      eligibility: {
        warranty: { eligible: true, reason: null },
        repairs: { eligible: true, reason: null },
        insurance: { eligible: false, reason: 'No active insurance policy' },
      },
    },
  ];

  private mockEnums: Record<string, EnumDto[]> = {
    claimType: [
      { code: 'WARRANTY', label: 'Warranty', description: 'Warranty claims' },
      { code: 'REPAIRS', label: 'Repairs', description: 'Repair claims' },
      { code: 'INSURANCE', label: 'Insurance', description: 'Insurance claims' },
    ],
    claimStatus: [
      { code: 'JOB_ORDER_CREATED', label: 'Job Order Created' },
      { code: 'CUSTOMER_SUBMITTED_FORM', label: 'Customer Submitted Form' },
      { code: 'DIAGNOSIS_IN_PROGRESS', label: 'Diagnosis In Progress' },
      { code: 'REPAIR_ONGOING', label: 'Repair Ongoing' },
      { code: 'QUALITY_CONTROL', label: 'Quality Control' },
      { code: 'VEHICLE_READY', label: 'Vehicle Ready' },
      { code: 'VEHICLE_DELIVERED', label: 'Vehicle Delivered' },
      { code: 'CANCELLED', label: 'Cancelled' },
    ],
    warrantyType: [
      { code: 'LOAN_WARRANTY', label: 'Loan Warranty' },
      { code: 'CASH_WARRANTY', label: 'Cash Warranty' },
    ],
  };

  private mockCountries: CountryDto[] = [
    { code: 'NG', name: 'Nigeria', currency: 'NGN', callingCode: '+234' },
    { code: 'KE', name: 'Kenya', currency: 'KES', callingCode: '+254' },
    { code: 'GH', name: 'Ghana', currency: 'GHS', callingCode: '+233' },
  ];

  private mockVendors: VendorDto[] = [
    {
      id: 'v-101',
      name: 'Autochek Flagship Workshop Ikeja',
      country: 'NG',
      city: 'Lagos',
      active: true,
    },
    {
      id: 'v-102',
      name: 'Autochek Workshop Nairobi',
      country: 'KE',
      city: 'Nairobi',
      active: true,
    },
  ];

  async searchCars(searchType?: string, search?: string): Promise<{ data: CarLookupDto[]; meta: any }> {
    let filtered = this.mockCars;
    if (search && searchType) {
      filtered = this.mockCars.filter((car) => {
        if (searchType === 'VIN') return car.car.vin.includes(search);
        if (searchType === 'CAR_ID') return car.car.id.includes(search);
        if (searchType === 'PLATE_NUMBER') return car.car.plateNumber.includes(search);
        if (searchType === 'CUSTOMER_NAME') return car.customer.name.toLowerCase().includes(search.toLowerCase());
        if (searchType === 'CUSTOMER_EMAIL') return car.customer.email.toLowerCase().includes(search.toLowerCase());
        if (searchType === 'CUSTOMER_PHONE') return car.customer.phone.includes(search);
        return true;
      });
    }
    return {
      data: filtered,
      meta: { total: filtered.length, page: 1, limit: 8 },
    };
  }

  async getEnums(): Promise<Record<string, EnumDto[]>> {
    return this.mockEnums;
  }

  async getCountries(): Promise<CountryDto[]> {
    return this.mockCountries;
  }

  async getVendors(): Promise<VendorDto[]> {
    return this.mockVendors;
  }

  /**
   * Search-by options for the claim-create car picker. A cash warranty is
   * looked up by warranty reference or VIN; everything else searches the car
   * and customer fields — mirrors the Claims UI's claimOptions.ts.
   */
  getSearchTypes(
    claimType?: string,
    warrantyType?: string,
  ): { value: string; label: string }[] {
    const isCashWarranty =
      claimType === 'WARRANTY' && warrantyType === 'CASH_WARRANTY';

    if (isCashWarranty) {
      return [
        { value: 'WARRANTY_ID', label: 'Search by Warranty ID' },
        { value: 'VIN', label: 'Search by VIN' },
      ];
    }

    return [
      { value: 'VIN', label: 'Search by VIN' },
      { value: 'CAR_ID', label: 'Search by Car ID' },
      { value: 'PLATE_NUMBER', label: 'Search by Plate Number' },
      { value: 'CUSTOMER_NAME', label: 'Search by Customer Name' },
      { value: 'CUSTOMER_EMAIL', label: 'Search by Customer Email' },
      { value: 'CUSTOMER_PHONE', label: 'Search by Customer Phone' },
    ];
  }
}
