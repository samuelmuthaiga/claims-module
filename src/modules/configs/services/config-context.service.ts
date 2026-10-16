import { Injectable } from '@nestjs/common';
import { ClaimsException } from '../../../common/exceptions/claims.exception';
import { ClaimRecord } from '../../../domain/claim.types';
import { vendorBank } from '../../../domain/vendor-bank';
import { MockDataStore } from '../../../store/mock-data.store';

export interface ResolvedContext {
  context: Record<string, unknown>;
  initialValues: Record<string, unknown>;
}

/**
 * Builds the entity context a config is rendered/validated against, so the
 * client never has to assemble (or be trusted with) values like the quote
 * total. Works off the store today; the same shape comes from the claims
 * tables once the database exists.
 */
@Injectable()
export class ConfigContextService {
  constructor(private readonly store: MockDataStore) {}

  resolve(formKey: string, entityType?: string, entityId?: string): ResolvedContext {
    if (!entityType || entityId === undefined) return { context: {}, initialValues: {} };

    switch (entityType) {
      case 'claim': {
        const claim = this.claim(Number(entityId));
        return { context: this.claimContext(claim), initialValues: this.claimInitialValues(formKey, claim) };
      }
      case 'payment': {
        const payment = this.store.payments.find((p) => p.id === Number(entityId));
        if (!payment) throw ClaimsException.notFound('Payment', entityId);
        const claim = this.claim(payment.claimId);
        const vendor = this.store.vendors.find((v) => v.id === payment.vendorId);
        const bank = vendor ? vendorBank(vendor) : undefined;
        return {
          context: { ...this.claimContext(claim), paymentId: payment.id, amount: payment.amount, currency: payment.currency },
          initialValues: {
            vendorName: vendor?.name,
            bankName: bank?.bankName,
            accountNumber: bank?.accountNumber,
            paymentType: bank?.paymentType,
            invoiceNumber: payment.invoiceNumber,
            amount: payment.amount,
            paymentSplit: payment.paymentSplit,
          },
        };
      }
      case 'approval': {
        const approval = this.store.approvals.find((a) => a.id === Number(entityId));
        if (!approval) throw ClaimsException.notFound('Approval', entityId);
        return { context: { ...this.claimContext(this.claim(approval.claimId)), approvalType: approval.type }, initialValues: {} };
      }
      case 'schedule': {
        const claim = this.store.claims.find((c) => c.scheduleToken === entityId);
        if (!claim) throw ClaimsException.notFound('Schedule link');
        return { context: { ...this.claimContext(claim), token: entityId }, initialValues: {} };
      }
      default:
        return { context: {}, initialValues: {} };
    }
  }

  private claim(id: number): ClaimRecord {
    const claim = this.store.findClaim(id);
    if (!claim) throw ClaimsException.notFound('Claim', id);
    return claim;
  }

  /** Context used by `{{context.*}}` placeholders, `source:'context'` rules and constraints. */
  claimContext(claim: ClaimRecord): Record<string, unknown> {
    return {
      entityType: 'claim',
      claimId: claim.id,
      reference: claim.reference,
      claimType: claim.claimType,
      warrantyType: claim.warrantyType ?? null,
      status: claim.status,
      country: claim.country,
      currency: claim.currency,
      quoteTotal: claim.totalAmount ?? null,
      upfrontAmount: claim.upfrontAmount ?? null,
      repairFinanced: claim.repairFinanced,
      needsTypeConfirmation: claim.needsTypeConfirmation,
    };
  }

  private claimInitialValues(formKey: string, claim: ClaimRecord): Record<string, unknown> {
    if (formKey === 'payment-split') {
      const { customer, autochek, insurance, repairFinancing } = claim.paymentSplit;
      return { customer, autochek, insurance, repairFinancing };
    }
    return {};
  }
}
