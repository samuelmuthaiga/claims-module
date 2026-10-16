import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ApprovalRecord,
  AuditLogRecord,
  CarRef,
  ClaimDocumentRecord,
  ClaimRecord,
  CountryRecord,
  CoverItem,
  CustomerRef,
  PartPriceRecord,
  PaymentRecord,
  QuoteRecord,
  StatusHistoryRecord,
  TimelineRecord,
  VendorRef,
} from '../domain/claim.types';
import { seedStore } from './seed/seed';

export type Sequence =
  | 'claim' | 'history' | 'timeline' | 'document' | 'quote'
  | 'approval' | 'payment' | 'part' | 'audit' | 'inspection' | 'schedule';

const GENESIS_HASH = '0'.repeat(64);

/**
 * In-memory system of record used until the platform team provisions the
 * standalone claims database. Every module reads and writes through this one
 * store, so cross-module workflow (approve quote -> raise payment -> advance
 * claim) behaves exactly as it will against real tables.
 *
 * It is a drop-in seam: when the database lands, each collection here maps to
 * one repository (see the entities under modules/*\/entities).
 */
@Injectable()
export class MockDataStore {
  claims: ClaimRecord[] = [];
  history: StatusHistoryRecord[] = [];
  timeline: TimelineRecord[] = [];
  documents: ClaimDocumentRecord[] = [];
  quotes: QuoteRecord[] = [];
  approvals: ApprovalRecord[] = [];
  payments: PaymentRecord[] = [];
  parts: PartPriceRecord[] = [];
  audit: AuditLogRecord[] = [];

  countries: CountryRecord[] = [];
  vendors: VendorRef[] = [];
  customers: CustomerRef[] = [];
  cars: CarRef[] = [];
  coverItems: CoverItem[] = [];

  private sequences: Record<Sequence, number> = {
    claim: 1023, history: 0, timeline: 0, document: 0, quote: 30,
    approval: 40, payment: 49, part: 0, audit: 9900, inspection: 411, schedule: 455,
  };

  constructor() {
    seedStore(this);
    // Seeded claims carry fixed ids, so new ones must continue after the highest.
    this.sequences.claim = Math.max(this.sequences.claim, ...this.claims.map((claim) => claim.id));
  }

  nextId(sequence: Sequence): number {
    this.sequences[sequence] += 1;
    return this.sequences[sequence];
  }

  findClaim(id: number): ClaimRecord | undefined {
    return this.claims.find((claim) => claim.id === id);
  }

  /** Appends to the hash-chained audit trail (tamper evidence per the DB spec). */
  appendAudit(entry: Omit<AuditLogRecord, 'id' | 'seq' | 'prevHash' | 'hash'>): AuditLogRecord {
    const seq = this.nextId('audit');
    const prevHash = this.audit[this.audit.length - 1]?.hash ?? GENESIS_HASH;
    const body = JSON.stringify({ seq, ...entry });
    const record: AuditLogRecord = {
      ...entry,
      id: `audit-${seq}`,
      seq,
      prevHash,
      hash: createHash('sha256').update(prevHash + body).digest('hex'),
    };
    this.audit.push(record);
    return record;
  }
}
