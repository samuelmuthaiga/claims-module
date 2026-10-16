import { ENUMS } from '../../../domain/enums';
import { ConfigInputType as T } from '../enums/config-input-type.enum';
import { ConfigSeed } from '../types/config.types';

const FILE_RULES = { allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png'], maxFileSizeMb: 20 };

/** E.164 after normalisation (API spec 1.5). */
const PHONE_PATTERN = '^\\+[1-9]\\d{7,14}$';

const apiOptions = (url: string, labelKey = 'label', valueKey = 'value', dataPath = 'data') => ({
  type: 'api',
  method: 'GET',
  url,
  dataPath,
  labelKey,
  valueKey,
});

const money = (key: string, label: string, extra: Record<string, unknown> = {}) => ({
  key,
  type: T.MONEY,
  label,
  required: true,
  currency: '{{context.currency}}',
  validation: { numeric: true, min: 0 },
  ...extra,
});

/**
 * Form configurations. Field `key`s are the API payload keys, so a form can
 * submit its values directly to the action endpoint. Fields marked
 * `transient: true` exist only to drive the UI (search helpers, autofilled
 * read-only values) and are never sent.
 *
 * Extensions over Fleetzen's metadata contract:
 *  - `visible_if` / `required_if`: { field, equals | not_equals | in | not_in,
 *    source?: 'context' } — `source: 'context'` reads the entity context
 *    returned with the config (e.g. repairFinanced) instead of a form value.
 *  - `options_source.url` placeholders: {{fieldKey}} (form value) and
 *    {{context.key}} (entity context).
 *  - `type: 'group'` (+ `repeatable`) for nested objects / row collections.
 *  - `metaData.constraints`: cross-field rules (sum | lte | sumRows).
 *  - `transient`, `readOnly`, `colSpan`, `clearsOnChange`, `auto_populate`.
 */
export const FORM_CONFIGS: ConfigSeed[] = [
  {
    key: 'claim-create',
    type: 'FORM',
    title: 'New Claim Request',
    description: 'Customer care logs a repair or warranty request and creates the job order.',
    domain: 'claims',
    actions: [
      { key: 'submit', label: 'Create Job Order', style: 'primary', endpoint: '/v1/claims', method: 'POST', permission: 'claims:write' },
    ],
    metaData: {
      title: 'New Claim Request',
      subtitle: 'Log a repair or warranty request and create the job order',
      notice: {
        icon: 'mail-forward',
        text: 'Saving creates the job order and immediately emails the customer a scheduling form. They choose the repair type, repair category, preferred workshop and appointment.',
      },
      sections: [
        {
          key: 'request',
          label: 'Request Details',
          columns: 2,
          fields: [
            { key: 'claimType', type: T.SELECT, label: 'Request Type', required: true, placeholder: 'Select request type', options: ENUMS.claimTypes, validation: { messages: { required: 'Please select the request type' } } },
            { key: 'warrantyType', type: T.SELECT, label: 'Warranty Type', placeholder: 'Select warranty type', options: ENUMS.warrantyTypes, visible_if: { field: 'claimType', equals: 'WARRANTY' }, required_if: { field: 'claimType', equals: 'WARRANTY' }, validation: { messages: { required: 'Please select the warranty type' } } },
            { key: 'requestChannel', type: T.SELECT, label: 'Request Received Via', required: true, colSpan: 2, placeholder: 'How did the request come in?', options: ENUMS.requestChannels, validation: { messages: { required: 'Please select how the request came in' } } },
          ],
        },
        {
          key: 'vehicle',
          label: 'Vehicle & Customer',
          columns: 2,
          fields: [
            { key: 'searchType', type: T.SELECT, label: 'Search By', required: true, transient: true, placeholder: 'Select search type', options_source: apiOptions('/v1/lookups/search-types?claimType={{claimType}}&warrantyType={{warrantyType}}'), dependsOn: ['claimType', 'warrantyType'], clearsOnChange: ['carId', 'customerName', 'customerEmail', 'customerPhone'], validation: { messages: { required: 'Please select what to search by' } } },
            {
              key: 'carId', type: T.SELECT, label: 'Select Car', required: true, placeholder: 'Type to search',
              options_source: { ...apiOptions('/v1/lookups/cars?searchType={{searchType}}&search={{search}}'), searchable: true, paginated: true, minSearchLength: 2 },
              dependsOn: ['searchType'],
              auto_populate: [
                { sourceKey: 'customer.name', targetKey: 'customerName' },
                { sourceKey: 'customer.email', targetKey: 'customerEmail' },
                { sourceKey: 'customer.phone', targetKey: 'customerPhone' },
              ],
              validation: { messages: { required: "Please select the customer's car" } },
            },
            { key: 'customerName', type: T.TEXT, label: 'Customer Name', required: true, transient: true, readOnly: true, placeholder: 'Autofilled from the selected car', validation: { messages: { required: 'Select a car to load the customer' } } },
            { key: 'customerEmail', type: T.EMAIL, label: 'Email Address', required: true, transient: true, readOnly: true, placeholder: 'Autofilled from the selected car', validation: { email: true, messages: { required: 'Select a car to load the customer', email: 'A valid customer email is required' } } },
            { key: 'customerPhone', type: T.PHONE, label: 'Phone Number', required: true, colSpan: 2, validation: { pattern: PHONE_PATTERN, messages: { required: 'Customer phone number is required', pattern: 'Enter the phone number in international format, e.g. +2348012345678' } } },
          ],
        },
        {
          key: 'details',
          label: 'Claim Details',
          columns: 1,
          fields: [
            { key: 'initialDetails', type: T.TEXTAREA, label: 'Initial Claim Details', required: true, placeholder: 'What did the customer report? Include symptoms, when it started, and anything relevant to the request.', validation: { minLength: 10, maxLength: 4000, messages: { required: 'Please describe the issue the customer reported', minLength: 'Please describe the issue the customer reported (at least 10 characters)' } } },
            { key: 'supportingDocumentUrl', type: T.FILE, label: 'Upload a photo or document showing what happened to the car', validation: FILE_RULES },
          ],
        },
      ],
    },
  },

  {
    key: 'claim-scheduling',
    type: 'FORM',
    title: 'Schedule Your Repair',
    description: 'Public form emailed to the customer when the job order is created.',
    domain: 'scheduling',
    actions: [
      { key: 'submit', label: 'Submit Scheduling Details', style: 'primary', endpoint: '/v1/public/schedule/:token/submission', method: 'POST' },
    ],
    metaData: {
      title: 'Schedule Your Repair',
      subtitle: 'Confirm a few details so we can book your vehicle in with a workshop.',
      public: true,
      fields: [
        { key: 'repairType', type: T.SELECT, label: 'Repair Type', options: ENUMS.claimTypes.filter((o) => o.value !== 'INSURANCE'), visible_if: { source: 'context', field: 'needsTypeConfirmation', equals: true }, required_if: { source: 'context', field: 'needsTypeConfirmation', equals: true } },
        { key: 'category', type: T.SELECT, label: 'Category of Repair', required: true, placeholder: 'Select a category', options: ENUMS.repairCategories.filter((o) => o.value !== 'LABOUR'), validation: { messages: { required: 'Please select a repair category' } } },
        { key: 'state', type: T.SELECT, label: 'State / Region', transient: true, placeholder: 'Select your state or region', options_source: apiOptions('/v1/public/schedule/{{context.token}}/states', 'name', 'code'), clearsOnChange: ['city', 'vendorId'] },
        { key: 'city', type: T.SELECT, label: 'City', transient: true, placeholder: 'Select your city', options_source: apiOptions('/v1/public/schedule/{{context.token}}/cities?state={{state}}', 'name', 'name'), dependsOn: ['state'] },
        { key: 'vendorId', type: T.SELECT, label: 'Preferred Workshop', required: true, placeholder: 'Select a workshop near you', options_source: apiOptions('/v1/public/schedule/{{context.token}}/vendors?city={{city}}', 'name', 'id'), dependsOn: ['city'], validation: { messages: { required: 'Please select a preferred workshop' } } },
        { key: 'appointmentDate', type: T.DATETIME, label: 'Preferred Appointment Date & Time', required: true, placeholder: 'Pick a date and time', slots: { url: '/v1/public/schedule/{{context.token}}/slots?vendorId={{vendorId}}' }, validation: { minDate: 'now', messages: { required: 'Please pick a date and time' } } },
        { key: 'customerNotes', type: T.TEXTAREA, label: 'Notes or Comments', placeholder: "Anything the workshop should know — when the fault started, how you'd like to be contacted, or anything else.", validation: { maxLength: 2000 } },
      ],
    },
  },

  {
    key: 'diagnosis-approval-request',
    type: 'FORM',
    title: 'Request Approval to Carry Out Diagnosis',
    description: 'Asks the claims admin to approve starting diagnosis on the vehicle.',
    domain: 'claims',
    actions: [
      { key: 'submit', label: 'Request Approval', style: 'primary', endpoint: '/v1/claims/:id/diagnosis-approval-requests', method: 'POST', permission: 'claims:write' },
    ],
    metaData: {
      title: 'Request Approval to Carry Out Diagnosis',
      description: 'This sends a request to the claims admin for approval to begin diagnosis on this vehicle.',
      fields: [
        { key: 'workshopProofUrl', type: T.FILE, label: 'Proof of Car at Service Workshop', required: true, validation: { ...FILE_RULES, messages: { required: 'Please upload proof that the car is at the workshop' } } },
      ],
    },
  },

  {
    key: 'quote-upload',
    type: 'FORM',
    title: 'Upload Repair Quote',
    description: 'Submit the diagnosis and the priced quote for claims admin review.',
    domain: 'claims',
    actions: [
      { key: 'submit', label: 'Upload Quote', style: 'primary', endpoint: '/v1/claims/:id/quotes', method: 'POST', permission: 'claims:write' },
    ],
    metaData: {
      title: 'Upload Repair Quote',
      subtitle: 'Submit the diagnosis and the priced quote for claims admin review',
      sections: [
        {
          key: 'diagnosis',
          label: 'Diagnosis',
          columns: 1,
          fields: [
            { key: 'issueTypes', type: T.MULTISELECT, label: 'Issue Type', required: true, placeholder: 'Select the issue types found', options: ENUMS.repairCategories.filter((o) => o.value !== 'LABOUR'), validation: { minCount: 1, messages: { required: 'Select at least one issue type', minCount: 'Select at least one issue type' } } },
            { key: 'diagnosisReportUrl', type: T.FILE, label: 'Diagnosis Report', required: true, validation: { ...FILE_RULES, messages: { required: 'Please upload the diagnosis report' } } },
            { key: 'scanReportUrl', type: T.FILE, label: 'Scan Report', required: true, validation: { ...FILE_RULES, messages: { required: 'Please upload the scan report' } } },
            { key: 'diagnosisNotes', type: T.TEXTAREA, label: 'Notes / Comments', placeholder: 'Optional — what was found on strip-down, and anything the claims admin should know.', validation: { maxLength: 4000 } },
          ],
        },
        {
          key: 'quote',
          label: 'Quote',
          columns: 2,
          fields: [
            { key: 'invoiceNumber', type: T.TEXT, label: 'Invoice Number', required: true, placeholder: 'e.g. INV-00123', validation: { pattern: '^[A-Za-z0-9_-]{1,64}$', messages: { required: 'Invoice number is required', pattern: 'Use letters, numbers, hyphen or underscore (max 64)' } } },
            money('upfrontAmount', 'Upfront Amount', { validation: { numeric: true, min: 0, messages: { required: 'Upfront amount is required' } } }),
            money('totalAmount', 'Total Amount', { validation: { numeric: true, min: 1, messages: { required: 'Total amount is required' } } }),
            { key: 'documentUrl', type: T.FILE, label: 'Invoice Document', required: true, validation: { ...FILE_RULES, messages: { required: 'Please upload the invoice document' } } },
          ],
        },
        {
          key: 'line-items',
          label: 'Line Items',
          columns: 1,
          fields: [
            {
              key: 'lineItems', type: T.GROUP, label: 'Line Items', required: true, repeatable: true, addLabel: 'Add Line Item',
              description: 'Add every part and job on the quote. Each row is priced per unit and multiplied by its quantity.',
              validation: { minCount: 1, messages: { required: 'Add at least one line item before uploading the quote.', minCount: 'Add at least one line item before uploading the quote.' } },
              fields: [
                { key: 'description', type: T.TEXT, label: 'Item Description', required: true, placeholder: 'e.g. Brake Pad Set', validation: { maxLength: 200, messages: { required: 'Describe the part or work' } } },
                { key: 'spec', type: T.TEXT, label: 'Spec', placeholder: 'e.g. 2.0L, front axle' },
                { key: 'brand', type: T.TEXT, label: 'Brand', placeholder: 'e.g. Bosch' },
                { key: 'condition', type: T.SELECT, label: 'Condition', placeholder: 'Select condition', options: ENUMS.partConditions },
                { key: 'quantity', type: T.NUMBER, label: 'Quantity', required: true, defaultValue: 1, step: 0.5, validation: { numeric: true, min: 0.5, max: 10, multipleOf: 0.5, messages: { required: 'Select a quantity' } } },
                money('unitAmount', 'Amount (per unit)', { validation: { numeric: true, min: 0.01, messages: { required: 'Enter an amount' } } }),
                { key: 'categoryCode', type: T.SELECT, label: 'Category', options: ENUMS.repairCategories },
              ],
            },
          ],
        },
      ],
      constraints: [
        { type: 'lte', field: 'upfrontAmount', max: 'totalAmount', message: 'Upfront amount cannot exceed the total amount' },
        { type: 'sumRows', collection: 'lineItems', multiply: ['quantity', 'unitAmount'], equals: 'totalAmount', message: 'Line items must add up to the total amount' },
      ],
    },
  },

  {
    key: 'payment-split',
    type: 'FORM',
    title: 'Payment Split',
    description: 'Agree who pays what before the quote goes for approval.',
    domain: 'claims',
    actions: [
      { key: 'submit', label: 'Submit Payment Split', style: 'primary', endpoint: '/v1/claims/:id/payment-split', method: 'PUT', permission: 'claims:write' },
    ],
    metaData: {
      title: 'Payment Split',
      subtitle: 'Agree who pays what before the quote goes for approval',
      summary: { label: 'Quote total', contextKey: 'quoteTotal' },
      fields: [
        money('autochek', 'Autochek'),
        money('customer', 'Customer'),
        money('insurance', 'Insurance'),
        money('repairFinancing', 'Repair Financing', {
          required: false,
          visible_if: { source: 'context', field: 'repairFinanced', equals: true },
        }),
      ],
      constraints: [
        { type: 'sum', fields: ['customer', 'autochek', 'insurance', 'repairFinancing'], contextKey: 'quoteTotal', message: 'The payment split must equal the quote total' },
      ],
    },
  },

  {
    key: 'repair-completion',
    type: 'FORM',
    title: 'Complete Repair',
    description: 'Submit proof of the completed repair for quality control.',
    domain: 'claims',
    actions: [
      { key: 'submit', label: 'Mark Repair Complete', style: 'primary', endpoint: '/v1/claims/:id/repair-completion', method: 'POST', permission: 'claims:write' },
    ],
    metaData: {
      title: 'Complete Repair',
      subtitle: 'Submit proof of the completed repair for quality control',
      fields: [
        { key: 'afterImageUrl', type: T.FILE, label: 'Proof of Repair Completion', required: true, validation: { ...FILE_RULES, messages: { required: 'Please upload proof of the completed repair' } } },
        { key: 'notes', type: T.TEXTAREA, label: 'Notes', validation: { maxLength: 2000 } },
      ],
    },
  },

  {
    key: 'vehicle-pickup',
    type: 'FORM',
    title: 'Complete — Vehicle Pickup',
    description: 'Closes the claim and marks the vehicle as delivered to the customer.',
    domain: 'claims',
    actions: [
      { key: 'submit', label: 'Mark as Delivered', style: 'primary', endpoint: '/v1/claims/:id/pickup', method: 'POST', permission: 'claims:write', confirm: { title: 'Complete — Vehicle Pickup', text: 'This closes the claim and marks the vehicle as delivered to the customer.' } },
    ],
    metaData: {
      title: 'Complete — Vehicle Pickup',
      fields: [
        { key: 'pickupFileUrl', type: T.FILE, label: 'Proof of Handover (optional)', validation: FILE_RULES },
        { key: 'pickupDate', type: T.DATETIME, label: 'Pickup Date & Time (optional)' },
      ],
    },
  },

  {
    key: 'claim-cancel',
    type: 'FORM',
    title: 'Cancel Claim',
    description: 'Cancel the claim with a reason.',
    domain: 'claims',
    actions: [
      { key: 'submit', label: 'Confirm Cancellation', style: 'danger', endpoint: '/v1/claims/:id/cancellation', method: 'POST', permission: 'claims:write', confirm: { title: 'Cancel Claim', text: 'This claim will be marked as cancelled and removed from active workflow tracking.' } },
    ],
    metaData: {
      title: 'Cancel Claim',
      note: 'When "Others" is chosen, submit the text from otherReason as `reason` (the API requires 10–500 characters).',
      fields: [
        { key: 'reason', type: T.SELECT, label: 'Reason for Cancellation', required: true, placeholder: 'Select reason', options: ENUMS.cancelReasons, validation: { messages: { required: 'Please select a reason' } } },
        { key: 'otherReason', type: T.TEXTAREA, label: 'Other Reason', transient: true, mapsTo: 'reason', placeholder: 'Describe the reason', visible_if: { field: 'reason', equals: 'Others' }, required_if: { field: 'reason', equals: 'Others' }, validation: { minLength: 10, maxLength: 500, messages: { required: 'Please describe the reason', minLength: 'Please describe the reason (at least 10 characters)' } } },
      ],
    },
  },

  {
    key: 'approval-decision',
    type: 'FORM',
    title: 'Approval Decision',
    description: 'Approve or decline a pending review. Declines need a reason for the workshop.',
    domain: 'approvals',
    actions: [
      { key: 'submit', label: 'Submit Decision', style: 'primary', endpoint: '/v1/approvals/:id/decision', method: 'POST', permission: 'reviews:approve' },
    ],
    metaData: {
      title: 'Approval Decision',
      // Button labels per approval type — previously hard-coded on each detail page.
      variants: {
        DIAGNOSIS: { approveLabel: 'Approve Diagnosis', rejectLabel: 'Reject Request' },
        QUOTE: { approveLabel: 'Approve Quote', rejectLabel: 'Reject Quote' },
        QA_SIGNOFF: { approveLabel: 'Pass QC', rejectLabel: 'Fail QC' },
        PAYMENT: { approveLabel: 'Approve Payment', rejectLabel: 'Decline Payment' },
      },
      fields: [
        { key: 'decision', type: T.RADIO, label: 'Decision', required: true, options: [{ value: 'APPROVE', label: 'Approve' }, { value: 'DECLINE', label: 'Decline' }] },
        { key: 'reason', type: T.TEXTAREA, label: 'Reason for rejection', placeholder: 'Explain what needs to change before this can be approved…', visible_if: { field: 'decision', equals: 'DECLINE' }, required_if: { field: 'decision', equals: 'DECLINE' }, validation: { minLength: 10, maxLength: 500, messages: { required: 'A reason is required when declining', minLength: 'Please give a reason of at least 10 characters' } } },
      ],
    },
  },

  {
    key: 'payment-request',
    type: 'FORM',
    title: 'Request Payment',
    description: 'Raise a payment request for an approved quote or completed repair.',
    domain: 'payments',
    actions: [
      { key: 'submit', label: 'Request Payment', style: 'primary', endpoint: '/v1/payments/request', method: 'POST', permission: 'payments:write' },
    ],
    metaData: {
      title: 'Request Payment',
      sections: [
        {
          key: 'vendor',
          label: 'Vendor & Invoice',
          columns: 2,
          fields: [
            { key: 'vendorName', type: T.TEXT, label: 'Vendor', transient: true, readOnly: true },
            { key: 'bankName', type: T.TEXT, label: 'Bank', transient: true, readOnly: true },
            { key: 'accountNumber', type: T.TEXT, label: 'Account Number', transient: true, readOnly: true },
            { key: 'paymentType', type: T.TEXT, label: 'Payment Type', transient: true, readOnly: true },
            { key: 'invoiceNumber', type: T.TEXT, label: 'Invoice Number', required: true, readOnly: true, validation: { pattern: '^[A-Za-z0-9_-]{1,64}$' } },
            money('amount', 'Amount', { validation: { numeric: true, min: 1, messages: { required: 'Enter the amount to be paid' } } }),
          ],
        },
        {
          key: 'split',
          label: 'Payment Split',
          columns: 2,
          fields: [
            {
              key: 'paymentSplit', type: T.GROUP, label: 'Payment Split', required: true,
              fields: [
                money('autochek', 'Autochek'),
                money('customer', 'Customer'),
                money('insurance', 'Insurance'),
                money('repairFinancing', 'Repair Financing', { required: false, visible_if: { source: 'context', field: 'repairFinanced', equals: true } }),
              ],
            },
          ],
        },
      ],
      constraints: [
        { type: 'sum', fields: ['paymentSplit.customer', 'paymentSplit.autochek', 'paymentSplit.insurance', 'paymentSplit.repairFinancing'], equals: 'amount', message: 'The payment split must equal the requested amount' },
      ],
    },
  },

  {
    key: 'payment-action',
    type: 'FORM',
    title: 'Payment Action',
    description: 'Approve, decline or dispute a payment, with a reason.',
    domain: 'payments',
    actions: [
      { key: 'submit', label: 'Confirm', style: 'primary', endpoint: '/v1/payments/action', method: 'POST', permission: 'payments:approve' },
    ],
    metaData: {
      title: 'Payment Action',
      // Copy and request payload per action — previously a local table in the modal.
      variants: {
        approve: { label: 'Approve Payment', color: 'green', description: 'This payment will be marked as approved and released for disbursement.', successMessage: 'Payment approved successfully.', payload: { approve: true, newStatus: 'APPROVED' } },
        decline: { label: 'Decline Invoice', color: 'red', description: 'This invoice will be declined and sent back to the vendor for correction.', successMessage: 'Invoice declined.', payload: { approve: false, newStatus: 'INVOICE_DECLINED' } },
        dispute: { label: 'Dispute Payment', color: 'orange', description: 'This payment will be flagged as disputed pending vendor clarification.', successMessage: 'Payment marked as disputed.', payload: { newStatus: 'DISPUTED' } },
      },
      fields: [
        { key: 'reason', type: T.TEXTAREA, label: 'Reason', required: true, placeholder: 'Provide a reason for this action.', validation: { minLength: 2, maxLength: 500, messages: { required: 'Please provide a reason', minLength: 'Please provide a reason' } } },
      ],
    },
  },
];
