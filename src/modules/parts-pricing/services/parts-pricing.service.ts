import { Injectable } from '@nestjs/common';
import { ClaimsException } from '../../../common/exceptions/claims.exception';
import { paginate } from '../../../common/utils/paginate.util';
import { compareBy, includesText, parseSort } from '../../../common/utils/query.util';
import { PartPriceRecord } from '../../../domain/claim.types';
import { MockDataStore } from '../../../store/mock-data.store';
import { PARTS_SORT_FIELDS, PartsPricingQueryDto } from '../dto/parts-pricing-query.dto';

@Injectable()
export class PartsPricingService {
  constructor(private readonly store: MockDataStore) {}

  list(query: PartsPricingQueryDto) {
    const sort = parseSort(query.sort, PARTS_SORT_FIELDS, { field: 'approved_date', direction: 'desc' });
    const rows = this.store.parts
      .filter((part) => {
        if (query.category && part.category !== query.category) return false;
        if (query.make && !includesText(part.make, query.make)) return false;
        if (query.model && !includesText(part.model, query.model)) return false;
        if (query.country && part.country !== query.country) return false;
        if (!query.search) return true;
        const fields: Record<string, unknown> = { PART_NAME: part.partName, WORKSHOP: part.workshop, VEHICLE: part.carLabel };
        return query.searchType
          ? includesText(fields[query.searchType], query.search)
          : Object.values(fields).some((value) => includesText(value, query.search!));
      })
      .sort(
        compareBy<PartPriceRecord>(sort, (part, field) =>
          field === 'approved_price' ? part.approvedPrice : field === 'part_name' ? part.partName : part.approvedDate,
        ),
      )
      .map((part) => this.toView(part));
    return paginate(rows, query.page, query.limit);
  }

  get(id: number) {
    const part = this.store.parts.find((p) => p.id === id);
    if (!part) throw ClaimsException.notFound('Part', id);
    return this.toView(part);
  }

  private toView(part: PartPriceRecord) {
    const claim = this.store.findClaim(part.claimId);
    return {
      id: part.id,
      partName: part.partName,
      workshop: part.workshop,
      approvedPrice: part.approvedPrice,
      currency: part.currency,
      country: part.country,
      carLabel: part.carLabel,
      approvedDate: part.approvedDate,
      claimId: part.claimId,
      customer: claim?.customer ?? null,
      // Catalogue-style fields from the API spec.
      unitPrice: part.approvedPrice,
      category: part.category ?? null,
      oemNumber: part.oemNumber ?? null,
      compatibleMake: part.make,
      compatibleModel: part.model,
      stockStatus: null,
    };
  }
}
