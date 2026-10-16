import { HttpStatus, Injectable } from '@nestjs/common';
import { ClaimsException, ErrorCode } from '../../../common/exceptions/claims.exception';
import { includesText } from '../../../common/utils/query.util';
import { ClaimRecord, ClaimStatus } from '../../../domain/claim.types';
import { ENUMS } from '../../../domain/enums';
import { MockDataStore } from '../../../store/mock-data.store';
import { STATES } from '../../../store/seed/reference-data';
import { ClaimWorkflowService } from '../../claim-workflow/services/claim-workflow.service';
import { ConfigContextService } from '../../configs/services/config-context.service';
import { ConfigsService } from '../../configs/services/configs.service';
import { ScheduleSubmissionDto, SlotsQueryDto } from '../dto/schedule-submission.dto';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Calendar date, wall-clock time and weekday of an instant in a given IANA timezone. */
const localParts = (instant: Date, timeZone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
    day: String(parts.weekday).toUpperCase().slice(0, 3),
  };
};

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const fromMinutes = (total: number): string =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

@Injectable()
export class PublicScheduleService {
  constructor(
    private readonly store: MockDataStore,
    private readonly workflow: ClaimWorkflowService,
    private readonly configs: ConfigsService,
    private readonly contexts: ConfigContextService,
  ) {}

  /** Resolves a link into everything the customer's form needs to render. */
  resolve(token: string) {
    const claim = this.requireLink(token);
    const settings = this.configs.getSettings();
    const form = this.configs.get('claim-scheduling', { country: claim.country, entityType: 'schedule', entityId: token });

    return {
      greetingName: claim.customer.name.split(' ')[0],
      claimNumber: claim.reference,
      vehicle: {
        make: claim.car.make, model: claim.car.model, year: claim.car.year,
        plateMasked: claim.car.plateNumber.replace(/^(.{3})(.*)(.{2})$/, (_m, a, b, c) => `${a}${'*'.repeat(b.length)}${c}`),
      },
      claimType: claim.claimType,
      needsTypeConfirmation: claim.needsTypeConfirmation,
      categories: ENUMS.repairCategories.filter((c) => c.value !== 'LABOUR').map((c) => ({ code: c.value, label: c.label })),
      vendors: this.vendorsFor(claim).map((v) => ({ id: v.id, name: v.name, city: v.city })),
      appointmentRules: {
        minDaysInAdvance: settings.appointment.minDaysInAdvance,
        maxDaysInAdvance: settings.appointment.maxDaysInAdvance,
        workingHours: settings.appointment.workingHours,
      },
      // Full config so the public page renders from the same schema as every other form.
      form: { ...form, context: { ...form.context, token } },
    };
  }

  vendors(token: string, city?: string) {
    const claim = this.requireLink(token);
    return this.vendorsFor(claim)
      .filter((v) => !city || includesText(v.city, city))
      .map((v) => ({ id: v.id, name: v.name, city: v.city }));
  }

  states(token: string) {
    const claim = this.requireLink(token);
    return (STATES[claim.country] ?? []).map(({ code, name }) => ({ code, name }));
  }

  cities(token: string, state?: string) {
    const claim = this.requireLink(token);
    return (STATES[claim.country] ?? [])
      .filter((s) => !state || s.code === state)
      .flatMap((s) => s.cities.map((c) => ({ ...c, state: s.code })));
  }

  slots(token: string, query: SlotsQueryDto) {
    const claim = this.requireLink(token);
    const vendor = this.eligibleVendor(claim, query.vendorId);
    const { appointment } = this.configs.getSettings();
    const tz = this.timezone(claim.country);
    const taken = new Set(
      this.store.claims
        .filter((c) => c.id !== claim.id && c.vendor?.id === vendor.id && c.appointmentDate)
        .map((c) => {
          const p = localParts(new Date(c.appointmentDate!), tz);
          return `${p.date}T${p.time}`;
        }),
    );

    const earliest = Date.now() + appointment.minDaysInAdvance * 86_400_000;
    const latest = Date.now() + appointment.maxDaysInAdvance * 86_400_000;
    const start = new Date(`${query.from.slice(0, 10)}T00:00:00Z`).getTime();
    const end = Math.min(new Date(`${query.to.slice(0, 10)}T00:00:00Z`).getTime(), start + 30 * 86_400_000);
    const [open, close] = [toMinutes(appointment.workingHours.start), toMinutes(appointment.workingHours.end)];

    const result: { date: string; slots: { start: string; end: string; available: boolean }[] }[] = [];
    for (let day = start; day <= end; day += 86_400_000) {
      const date = new Date(day).toISOString().slice(0, 10);
      if (!appointment.workingHours.days.includes(DAYS[new Date(day).getUTCDay()]!)) continue;
      const slots = [];
      for (let m = open; m + appointment.slotMinutes <= close; m += appointment.slotMinutes) {
        const instant = this.zonedInstant(date, fromMinutes(m), tz);
        slots.push({
          start: fromMinutes(m),
          end: fromMinutes(m + appointment.slotMinutes),
          available: instant >= earliest && instant <= latest && !taken.has(`${date}T${fromMinutes(m)}`),
        });
      }
      result.push({ date, slots });
    }
    return result;
  }

  submit(token: string, dto: ScheduleSubmissionDto) {
    const claim = this.requireLink(token);
    const context = this.contexts.claimContext(claim);
    this.configs.assertValid(
      'claim-scheduling',
      { repairType: dto.repairType, category: dto.category, vendorId: dto.vendorId, appointmentDate: dto.appointmentDate, customerNotes: dto.customerNotes },
      context,
    );

    const vendor = this.eligibleVendor(claim, dto.vendorId);
    this.assertWithinWindow(claim, dto.appointmentDate);

    const now = new Date().toISOString();
    const confirmationRef = `SCH-${claim.country}-${new Date().getFullYear()}-${String(this.store.nextId('schedule')).padStart(6, '0')}`;
    const category = ENUMS.repairCategories.find((c) => c.value === dto.category);

    if (claim.needsTypeConfirmation && dto.repairType) claim.claimType = dto.repairType;
    claim.needsTypeConfirmation = false;
    Object.assign(claim, {
      vendor, appointmentDate: dto.appointmentDate, customerNotes: dto.customerNotes,
      issueSubType: category?.label ?? dto.category, issueTypes: [dto.category], scheduleTokenUsedAt: now,
      scheduling: {
        repairType: claim.claimType, repairCategory: dto.category, preferredWorkshop: vendor.name,
        appointmentDate: dto.appointmentDate, customerNotes: dto.customerNotes, submittedAt: now, confirmationRef,
      },
    });

    this.workflow.transition(claim, ClaimStatus.CUSTOMER_SUBMITTED_FORM, {
      action: 'submit_schedule_form',
      actor: { id: claim.customer.id, name: claim.customer.name, roles: ['Customer'] },
      event: 'Customer submitted scheduling form',
      message: `Customer scheduled a ${claim.claimType.toLowerCase()} repair at ${vendor.name} for ${dto.appointmentDate}.`,
      channel: 'Public',
    });

    return { confirmationRef, appointmentDate: dto.appointmentDate, vendorName: vendor.name };
  }

  // ───────────────────────────── internals ─────────────────────────────

  private requireLink(token: string): ClaimRecord {
    const claim = this.store.claims.find((c) => c.scheduleToken === token);
    if (!claim) {
      throw ClaimsException.notFound('Schedule link');
    }
    if (claim.scheduleTokenUsedAt || claim.status !== ClaimStatus.JOB_ORDER_CREATED) {
      throw new ClaimsException(HttpStatus.GONE, ErrorCode.SCHEDULE_LINK_USED, 'This scheduling link has already been used');
    }
    if (new Date(claim.scheduleTokenExpiresAt) < new Date()) {
      throw new ClaimsException(HttpStatus.GONE, ErrorCode.SCHEDULE_LINK_EXPIRED, 'This scheduling link has expired. Please contact customer care for a new one');
    }
    return claim;
  }

  private vendorsFor(claim: ClaimRecord) {
    return this.store.vendors.filter((v) => v.active !== false && v.country === claim.country);
  }

  private eligibleVendor(claim: ClaimRecord, vendorId: string) {
    const vendor = this.vendorsFor(claim).find((v) => v.id === vendorId);
    if (!vendor) {
      throw ClaimsException.unprocessable(ErrorCode.VENDOR_NOT_ELIGIBLE, 'That workshop is not available for this request');
    }
    return vendor;
  }

  private timezone(country: string): string {
    return this.store.countries.find((c) => c.code === country)?.timezone ?? 'UTC';
  }

  /** Instant (ms) for a local wall-clock date/time in a timezone. */
  private zonedInstant(date: string, time: string, timeZone: string): number {
    const guess = new Date(`${date}T${time}:00Z`);
    const shown = localParts(guess, timeZone);
    const offset = new Date(`${shown.date}T${shown.time}:00Z`).getTime() - guess.getTime();
    return guess.getTime() - offset;
  }

  private assertWithinWindow(claim: ClaimRecord, appointmentDate: string): void {
    const { appointment } = this.configs.getSettings();
    const at = new Date(appointmentDate);
    const earliest = Date.now() + appointment.minDaysInAdvance * 86_400_000;
    const latest = Date.now() + appointment.maxDaysInAdvance * 86_400_000;
    const local = localParts(at, this.timezone(claim.country));
    const minutes = toMinutes(local.time);
    const { start, end, days } = appointment.workingHours;

    const reason =
      at.getTime() < earliest ? `Appointments must be at least ${appointment.minDaysInAdvance} day(s) ahead`
      : at.getTime() > latest ? `Appointments can be booked up to ${appointment.maxDaysInAdvance} days ahead`
      : !days.includes(local.day) ? `Workshops are open ${days.join(', ')}`
      : minutes < toMinutes(start) || minutes + appointment.slotMinutes > toMinutes(end) ? `Appointments run between ${start} and ${end}`
      : null;

    if (reason) throw ClaimsException.unprocessable(ErrorCode.APPOINTMENT_OUT_OF_WINDOW, reason);
  }
}
