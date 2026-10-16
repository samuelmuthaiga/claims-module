import { Injectable } from '@nestjs/common';
import { paginate } from '../../../common/utils/paginate.util';
import { includesText } from '../../../common/utils/query.util';
import { carEligibility } from '../../../domain/eligibility';
import { ENUMS } from '../../../domain/enums';
import { MockDataStore } from '../../../store/mock-data.store';
import { STATES } from '../../../store/seed/reference-data';
import { ConfigsService } from '../../configs/services/configs.service';
import { CarSearchQueryDto, CitiesQueryDto, SearchTypesQueryDto, StatesQueryDto, VendorsQueryDto } from '../dto/lookups-query.dto';

const flag = (code: string): string =>
  [...code.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('');

@Injectable()
export class LookupsService {
  constructor(
    private readonly store: MockDataStore,
    private readonly configs: ConfigsService,
  ) {}

  /** Vehicle search behind the new-claim picker. Upstream (Acquire/loan service) replaces the store later. */
  searchCars(query: CarSearchQueryDto) {
    const settings = this.configs.getSettings();
    const rows = this.store.cars
      .map((car) => ({ car, customer: this.store.customers.find((c) => c.id === car.customerId)! }))
      .filter(({ car, customer }) => {
        if (!query.search) return true;
        const fields: Record<string, unknown> = {
          VIN: car.vin, CAR_ID: car.id, PLATE_NUMBER: car.plateNumber, WARRANTY_ID: car.warrantyId,
          CUSTOMER_NAME: customer.name, CUSTOMER_EMAIL: customer.email, CUSTOMER_PHONE: customer.phone,
        };
        return query.searchType
          ? includesText(fields[query.searchType], query.search)
          : Object.values(fields).some((value) => includesText(value, query.search!));
      })
      .map(({ car, customer }) => ({
        value: car.id,
        label: `${car.year} ${car.make} ${car.model} · ${car.plateNumber}`,
        email: customer.email,
        car,
        customer,
        eligibility: carEligibility(this.store, settings, car.id),
      }));
    return paginate(rows, query.page, query.limit);
  }

  enums() {
    return ENUMS;
  }

  countries() {
    return this.store.countries.map((country) => ({ ...country, flag: flag(country.code) }));
  }

  vendors(query: VendorsQueryDto) {
    return this.store.vendors.filter((vendor) => {
      if (!query.includeInactive && vendor.active === false) return false;
      if (query.country && vendor.country !== query.country) return false;
      if (query.city && !includesText(vendor.city, query.city)) return false;
      if (query.category && vendor.category !== query.category) return false;
      return !query.search || includesText(vendor.name, query.search);
    });
  }

  states(query: StatesQueryDto) {
    return (STATES[query.country ?? 'NG'] ?? []).map(({ code, name }) => ({ code, name }));
  }

  cities(query: CitiesQueryDto) {
    const states = STATES[query.country ?? 'NG'] ?? [];
    return states
      .filter((state) => !query.state || state.code === query.state)
      .flatMap((state) => state.cities.map((city) => ({ ...city, state: state.code })));
  }

  /** Cash warranties are found by warranty reference or VIN; everything else by car/customer fields. */
  searchTypes(query: SearchTypesQueryDto) {
    const label = (value: string, text: string) => ({ value, label: `Search by ${text}` });
    if (query.claimType === 'WARRANTY' && query.warrantyType === 'CASH_WARRANTY') {
      return [label('WARRANTY_ID', 'Warranty ID'), label('VIN', 'VIN')];
    }
    return [
      label('VIN', 'VIN'), label('CAR_ID', 'Car ID'), label('PLATE_NUMBER', 'Plate Number'),
      label('CUSTOMER_NAME', 'Customer Name'), label('CUSTOMER_EMAIL', 'Customer Email'), label('CUSTOMER_PHONE', 'Customer Phone'),
    ];
  }
}
