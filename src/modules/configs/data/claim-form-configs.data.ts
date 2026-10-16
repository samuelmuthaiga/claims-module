import { ConfigInputType } from '../enums/config-input-type.enum';

/**
 * Mock form configurations for the Claims UI, seeded from the actual forms in
 * workspace/claims. The metaData contract follows Fleetzen's task-form shape
 * (sections/fields, options/options_source, required_if, validation,
 * auto_populate) so the UI can adopt the same renderer pattern.
 *
 * Claims-specific extensions on top of the Fleetzen shape:
 *  - `visible_if`: same rule shape as required_if; the field is only shown
 *    (and only validated) when the rule passes.
 *  - `readOnly`: rendered disabled; used for auto-populated fields.
 *  - `options_source.url` placeholders: {{fieldKey}} is resolved from the
 *    current form values (e.g. {{searchType}}), {{context.*}} from the
 *    entity context the config was fetched with (e.g. {{context.country}}).
 *  - `auto_populate`: [{ sourceKey, targetKey }] copies keys off the chosen
 *    option's full data into other form fields.
 *  - `type: "group"` + `repeatable: true`: a repeating sub-form (line items);
 *    the renderer collects an array of row objects.
 *  - `metaData.constraints`: cross-field rules. type "sum" requires the sum
 *    of `fields` to equal `value` or a number resolved from `contextKey`.
 */
export const CLAIM_FORM_CONFIGS: Record<string, unknown>[] = [
  {
    id: 'cfg-claim-create',
    key: 'claim-create',
    title: 'New Claim Request',
    description:
      'Customer care logs a repair or warranty request and creates the job order. Saving emails the customer the scheduling form.',
    domain: 'claims',
    isActive: true,
    version: 1,
    actions: [
      {
        key: 'submit',
        label: 'Create Job Order',
        style: 'primary',
        endpoint: '/api/v1/claims',
        method: 'POST',
      },
    ],
    metaData: {
      title: 'New Claim Request',
      subtitle: 'Log a repair or warranty request and create the job order',
      sections: [
        {
          key: 'request',
          label: 'Request Details',
          fields: [
            {
              key: 'claimType',
              type: ConfigInputType.SELECT,
              label: 'Request Type',
              required: true,
              options: [
                { value: 'WARRANTY', label: 'Warranty' },
                { value: 'REPAIRS', label: 'Repairs' },
                { value: 'INSURANCE', label: 'Insurance' },
              ],
              validation: {
                messages: { required: 'Please select the request type' },
              },
            },
            {
              key: 'warrantyType',
              type: ConfigInputType.SELECT,
              label: 'Warranty Type',
              required: false,
              visible_if: { field: 'claimType', equals: 'WARRANTY' },
              required_if: { field: 'claimType', equals: 'WARRANTY' },
              options: [
                { value: 'LOAN_WARRANTY', label: 'Loan Warranty' },
                { value: 'CASH_WARRANTY', label: 'Cash Warranty' },
              ],
              validation: {
                messages: { required: 'Please select the warranty type' },
              },
            },
            {
              key: 'requestChannel',
              type: ConfigInputType.SELECT,
              label: 'Request Received Via',
              required: true,
              options: [
                { value: 'Phone Call', label: 'Phone Call' },
                { value: 'Email', label: 'Email' },
              ],
              validation: {
                messages: {
                  required: 'Please select how the request came in',
                },
              },
            },
          ],
        },
        {
          key: 'vehicle',
          label: 'Vehicle & Customer',
          fields: [
            {
              key: 'searchType',
              type: ConfigInputType.SELECT,
              label: 'Search By',
              required: true,
              options_source: {
                type: 'api',
                method: 'GET',
                url: '/api/v1/lookups/search-types?claimType={{claimType}}&warrantyType={{warrantyType}}',
                dataPath: 'data',
                labelKey: 'label',
                valueKey: 'value',
              },
              clearsOnChange: ['carId', 'customerName', 'customerEmail', 'customerPhone'],
              validation: {
                messages: { required: 'Please select what to search by' },
              },
            },
            {
              key: 'carId',
              type: ConfigInputType.SELECT,
              label: 'Select Car',
              required: true,
              options_source: {
                type: 'api',
                method: 'GET',
                url: '/api/v1/lookups/cars?searchType={{searchType}}&search={{search}}',
                dataPath: 'data',
                labelKey: 'label',
                valueKey: 'value',
                searchable: true,
                paginated: true,
              },
              auto_populate: [
                { sourceKey: 'customer.name', targetKey: 'customerName' },
                { sourceKey: 'customer.email', targetKey: 'customerEmail' },
                { sourceKey: 'customer.phone', targetKey: 'customerPhone' },
              ],
              validation: {
                messages: { required: "Please select the customer's car" },
              },
            },
            {
              key: 'customerName',
              type: ConfigInputType.TEXT,
              label: 'Customer Name',
              required: true,
              readOnly: true,
              description: 'Autofilled from the selected car',
              validation: {
                messages: {
                  required: 'Select a car to load the customer',
                },
              },
            },
            {
              key: 'customerEmail',
              type: ConfigInputType.EMAIL,
              label: 'Email Address',
              required: true,
              readOnly: true,
              description: 'Autofilled from the selected car',
              validation: {
                email: true,
                messages: {
                  required: 'Select a car to load the customer',
                  email: 'A valid customer email is required',
                },
              },
            },
            {
              key: 'customerPhone',
              type: ConfigInputType.PHONE,
              label: 'Phone Number',
              required: true,
              validation: {
                phone: true,
                minLength: 6,
                messages: {
                  required: 'Customer phone number is required',
                },
              },
            },
          ],
        },
        {
          key: 'details',
          label: 'Claim Details',
          fields: [
            {
              key: 'initialDetails',
              type: ConfigInputType.TEXTAREA,
              label: 'Initial Claim Details',
              required: true,
              description:
                'What did the customer report? Include symptoms, when it started, and anything relevant to the request.',
              validation: {
                minLength: 10,
                messages: {
                  required: 'Please describe the issue the customer reported',
                  minLength: 'Please describe the issue the customer reported',
                },
              },
            },
            {
              key: 'supportingDocumentUrl',
              type: ConfigInputType.FILE,
              label:
                'Upload a photo or document showing what happened to the car',
              required: false,
              validation: {
                maxFileSizeMb: 10,
                allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png'],
              },
            },
          ],
        },
      ],
      notice: {
        icon: 'mail-forward',
        text: 'Saving creates the job order and immediately emails the customer a scheduling form. They choose the repair type, repair category, preferred workshop and appointment.',
      },
    },
  },

  {
    id: 'cfg-claim-scheduling',
    key: 'claim-scheduling',
    title: 'Schedule Your Repair',
    description:
      'Public scheduling form emailed to the customer when the job order is created. They pick the repair category, preferred workshop and appointment.',
    domain: 'claims',
    isActive: true,
    version: 1,
    actions: [
      {
        key: 'submit',
        label: 'Submit Scheduling Details',
        style: 'primary',
        endpoint: '/api/v1/claims/:claimId/schedule',
        method: 'POST',
      },
    ],
    metaData: {
      title: 'Schedule Your Repair',
      subtitle:
        'Confirm a few details so we can book your vehicle in with a workshop.',
      public: true,
      sections: [
        {
          key: 'booking',
          label: 'Appointment',
          fields: [
            {
              key: 'category',
              type: ConfigInputType.SELECT,
              label: 'Category of Repair',
              required: true,
              options: [
                { value: 'Body Work Only', label: 'Body Work Only' },
                {
                  value: 'Electrical, Mechanical & Suspension',
                  label: 'Electrical, Mechanical & Suspension',
                },
              ],
              validation: {
                messages: { required: 'Please select a repair category' },
              },
            },
            {
              key: 'state',
              type: ConfigInputType.SELECT,
              label: 'State / Region',
              required: false,
              options_source: {
                type: 'api',
                method: 'GET',
                url: '/api/v1/lookups/states?country={{context.country}}',
                dataPath: 'data',
                labelKey: 'name',
                valueKey: 'code',
              },
            },
            {
              key: 'city',
              type: ConfigInputType.SELECT,
              label: 'City',
              required: false,
              options_source: {
                type: 'api',
                method: 'GET',
                url: '/api/v1/lookups/cities?country={{context.country}}&state={{state}}',
                dataPath: 'data',
                labelKey: 'name',
                valueKey: 'code',
              },
              dependsOn: ['state'],
            },
            {
              key: 'vendorId',
              type: ConfigInputType.SELECT,
              label: 'Preferred Workshop',
              required: true,
              options_source: {
                type: 'api',
                method: 'GET',
                url: '/api/v1/lookups/vendors?country={{context.country}}',
                dataPath: 'data',
                labelKey: 'name',
                valueKey: 'id',
              },
              validation: {
                messages: { required: 'Please select a preferred workshop' },
              },
            },
            {
              key: 'appointmentDate',
              type: ConfigInputType.DATETIME,
              label: 'Preferred Appointment Date & Time',
              required: true,
              validation: {
                minDate: 'now',
                messages: {
                  required: 'Please pick a date and time',
                },
              },
            },
            {
              key: 'customerNotes',
              type: ConfigInputType.TEXTAREA,
              label: 'Notes or Comments',
              required: false,
              description:
                "Anything the workshop should know — when the fault started, how you'd like to be contacted, or anything else.",
            },
          ],
        },
      ],
    },
  },

  {
    id: 'cfg-diagnosis-approval-request',
    key: 'diagnosis-approval-request',
    title: 'Request Approval to Carry Out Diagnosis',
    description:
      'Sends a request to the claims admin for approval to begin diagnosis on the vehicle.',
    domain: 'claims',
    isActive: true,
    version: 1,
    actions: [
      {
        key: 'submit',
        label: 'Request Approval',
        style: 'primary',
        endpoint: '/api/v1/claims/:claimId/diagnosis-approval',
        method: 'POST',
      },
    ],
    metaData: {
      title: 'Request Approval to Carry Out Diagnosis',
      fields: [
        {
          key: 'workshopProofUrl',
          type: ConfigInputType.FILE,
          label: 'Proof of Car at Service Workshop',
          required: true,
          validation: {
            allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png'],
            maxFileSizeMb: 10,
            messages: {
              required:
                'Please upload proof that the car is at the workshop',
            },
          },
        },
      ],
    },
  },

  {
    id: 'cfg-quote-upload',
    key: 'quote-upload',
    title: 'Upload Repair Quote',
    description:
      'Submit the diagnosis and the priced quote for claims admin review.',
    domain: 'claims',
    isActive: true,
    version: 1,
    actions: [
      {
        key: 'submit',
        label: 'Upload Quote',
        style: 'primary',
        endpoint: '/api/v1/claims/:claimId/quotes',
        method: 'POST',
      },
    ],
    metaData: {
      title: 'Upload Repair Quote',
      sections: [
        {
          key: 'diagnosis',
          label: 'Diagnosis',
          fields: [
            {
              key: 'issueTypes',
              type: ConfigInputType.MULTISELECT,
              label: 'Issue Type',
              required: true,
              options: [
                { value: 'Body Work Only', label: 'Body Work Only' },
                {
                  value: 'Electrical, Mechanical & Suspension',
                  label: 'Electrical, Mechanical & Suspension',
                },
                {
                  value: 'Body Work + Electrical, Mechanical & Suspension',
                  label: 'Body Work + Electrical, Mechanical & Suspension',
                },
              ],
              validation: {
                minCount: 1,
                messages: { required: 'Select at least one issue type' },
              },
            },
            {
              key: 'diagnosisReportUrl',
              type: ConfigInputType.FILE,
              label: 'Diagnosis Report',
              required: true,
              validation: {
                allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png'],
                maxFileSizeMb: 20,
                messages: {
                  required: 'Please upload the diagnosis report',
                },
              },
            },
            {
              key: 'scanReportUrl',
              type: ConfigInputType.FILE,
              label: 'Scan Report',
              required: true,
              validation: {
                allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png'],
                maxFileSizeMb: 20,
                messages: { required: 'Please upload the scan report' },
              },
            },
            {
              key: 'diagnosisNotes',
              type: ConfigInputType.TEXTAREA,
              label: 'Notes / Comments',
              required: false,
              description:
                'Optional — what was found on strip-down, and anything the claims admin should know.',
            },
          ],
        },
        {
          key: 'quote',
          label: 'Quote',
          fields: [
            {
              key: 'invoiceNumber',
              type: ConfigInputType.TEXT,
              label: 'Invoice Number',
              required: true,
              description: 'e.g. INV-00123',
              validation: {
                messages: { required: 'Invoice number is required' },
              },
            },
            {
              key: 'upfrontAmount',
              type: ConfigInputType.MONEY,
              label: 'Upfront Amount',
              required: true,
              currency: '{{context.currency}}',
              validation: {
                numeric: true,
                min: 0,
                messages: {
                  required: 'Upfront amount is required',
                },
              },
            },
            {
              key: 'totalAmount',
              type: ConfigInputType.MONEY,
              label: 'Total Amount',
              required: true,
              currency: '{{context.currency}}',
              validation: {
                numeric: true,
                min: 1,
                messages: { required: 'Total amount is required' },
              },
            },
            {
              key: 'documentUrl',
              type: ConfigInputType.FILE,
              label: 'Invoice Document',
              required: true,
              validation: {
                allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png'],
                maxFileSizeMb: 20,
                messages: { required: 'Please upload the invoice document' },
              },
            },
          ],
        },
        {
          key: 'line-items',
          label: 'Line Items',
          fields: [
            {
              key: 'lineItems',
              type: ConfigInputType.GROUP,
              label: 'Line Items',
              required: true,
              repeatable: true,
              addLabel: 'Add Line Item',
              description:
                'Add every part and job on the quote. Each row is priced per unit and multiplied by its quantity.',
              validation: {
                minCount: 1,
                messages: {
                  required: 'Add at least one line item before uploading the quote.',
                },
              },
              fields: [
                {
                  key: 'description',
                  type: ConfigInputType.TEXT,
                  label: 'Item Description',
                  required: true,
                  description: 'e.g. Brake Pad Set',
                  validation: {
                    messages: { required: 'Describe the part or work' },
                  },
                },
                {
                  key: 'spec',
                  type: ConfigInputType.TEXT,
                  label: 'Spec',
                  required: false,
                  description: 'e.g. 2.0L, front axle',
                },
                {
                  key: 'brand',
                  type: ConfigInputType.TEXT,
                  label: 'Brand',
                  required: false,
                  description: 'e.g. Bosch',
                },
                {
                  key: 'condition',
                  type: ConfigInputType.SELECT,
                  label: 'Condition',
                  required: false,
                  options: [
                    { value: 'Brand New', label: 'Brand New' },
                    { value: 'Used', label: 'Used' },
                  ],
                },
                {
                  key: 'quantity',
                  type: ConfigInputType.SELECT,
                  label: 'Quantity',
                  required: true,
                  options: Array.from({ length: 19 }, (_, i) => {
                    const v = String(1 + i * 0.5);
                    return { value: v, label: v };
                  }),
                  validation: {
                    messages: { required: 'Select a quantity' },
                  },
                },
                {
                  key: 'unitAmount',
                  type: ConfigInputType.MONEY,
                  label: 'Amount (per unit)',
                  required: true,
                  currency: '{{context.currency}}',
                  validation: {
                    numeric: true,
                    min: 0.01,
                    messages: { required: 'Enter an amount' },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  },

  {
    id: 'cfg-payment-split',
    key: 'payment-split',
    title: 'Payment Split',
    description:
      'Agree who pays what before the quote goes for approval. Warranty and repair-financed claims settle the split first.',
    domain: 'claims',
    isActive: true,
    version: 1,
    actions: [
      {
        key: 'submit',
        label: 'Submit Payment Split',
        style: 'primary',
        endpoint: '/api/v1/claims/:claimId/payment-split',
        method: 'PUT',
      },
    ],
    metaData: {
      title: 'Payment Split',
      fields: [
        {
          key: 'autochekSplit',
          type: ConfigInputType.MONEY,
          label: 'Autochek',
          required: true,
          currency: '{{context.currency}}',
          validation: { numeric: true, min: 0 },
        },
        {
          key: 'customerSplit',
          type: ConfigInputType.MONEY,
          label: 'Customer',
          required: true,
          currency: '{{context.currency}}',
          validation: { numeric: true, min: 0 },
        },
        {
          key: 'insuranceSplit',
          type: ConfigInputType.MONEY,
          label: 'Insurance',
          required: true,
          currency: '{{context.currency}}',
          validation: { numeric: true, min: 0 },
        },
        {
          key: 'repairFinancingSplit',
          type: ConfigInputType.MONEY,
          label: 'Repair Financing',
          required: true,
          currency: '{{context.currency}}',
          validation: { numeric: true, min: 0 },
        },
      ],
      constraints: [
        {
          type: 'sum',
          fields: [
            'autochekSplit',
            'customerSplit',
            'insuranceSplit',
            'repairFinancingSplit',
          ],
          contextKey: 'quoteTotal',
          tolerance: 0.01,
          message: 'The payment split must equal the quote total',
        },
      ],
    },
  },

  {
    id: 'cfg-repair-completion',
    key: 'repair-completion',
    title: 'Complete Repair',
    description:
      'Submit proof of the completed repair for quality control.',
    domain: 'claims',
    isActive: true,
    version: 1,
    actions: [
      {
        key: 'submit',
        label: 'Mark Repair Complete',
        style: 'primary',
        endpoint: '/api/v1/claims/:claimId/repair-completion',
        method: 'POST',
      },
    ],
    metaData: {
      title: 'Complete Repair',
      fields: [
        {
          key: 'afterImageUrl',
          type: ConfigInputType.FILE,
          label: 'Proof of Repair Completion',
          required: true,
          validation: {
            allowedFileTypes: ['.jpg', '.jpeg', '.png', '.pdf'],
            maxFileSizeMb: 10,
            messages: {
              required: 'Please upload proof of the completed repair',
            },
          },
        },
      ],
    },
  },

  {
    id: 'cfg-vehicle-pickup',
    key: 'vehicle-pickup',
    title: 'Complete — Vehicle Pickup',
    description:
      'Closes the claim and marks the vehicle as delivered to the customer.',
    domain: 'claims',
    isActive: true,
    version: 1,
    actions: [
      {
        key: 'submit',
        label: 'Mark as Delivered',
        style: 'primary',
        endpoint: '/api/v1/claims/:claimId/pickup',
        method: 'POST',
        confirm: {
          title: 'Complete — Vehicle Pickup',
          text: 'This closes the claim and marks the vehicle as delivered to the customer.',
        },
      },
    ],
    metaData: {
      title: 'Complete — Vehicle Pickup',
      fields: [
        {
          key: 'pickupProofUrl',
          type: ConfigInputType.FILE,
          label: 'Proof of Handover (optional)',
          required: false,
          validation: {
            allowedFileTypes: ['.jpg', '.jpeg', '.png', '.pdf'],
            maxFileSizeMb: 10,
          },
        },
        {
          key: 'deliveryNotes',
          type: ConfigInputType.TEXTAREA,
          label: 'Delivery Notes (optional)',
          required: false,
          description:
            'Condition at handover, who collected the vehicle, or anything worth recording.',
        },
      ],
    },
  },

  {
    id: 'cfg-claim-cancel',
    key: 'claim-cancel',
    title: 'Cancel Claim',
    description: 'Cancel the claim with a reason.',
    domain: 'claims',
    isActive: true,
    version: 1,
    actions: [
      {
        key: 'submit',
        label: 'Confirm Cancellation',
        style: 'danger',
        endpoint: '/api/v1/claims/:claimId/cancel',
        method: 'POST',
        confirm: {
          title: 'Cancel Claim',
          text: 'This cancels the claim. This action cannot be undone.',
        },
      },
    ],
    metaData: {
      title: 'Cancel',
      fields: [
        {
          key: 'reason',
          type: ConfigInputType.SELECT,
          label: 'Reason for Cancellation',
          required: true,
          options: [
            { value: 'Customer Request', label: 'Customer Request' },
            { value: 'Duplicate Entry', label: 'Duplicate Entry' },
            { value: 'Incorrect Information', label: 'Incorrect Information' },
            { value: 'Others', label: 'Others' },
          ],
          validation: {
            messages: { required: 'Please select a reason' },
          },
        },
        {
          key: 'otherReason',
          type: ConfigInputType.TEXTAREA,
          label: 'Other Reason',
          required: false,
          visible_if: { field: 'reason', equals: 'Others' },
          required_if: { field: 'reason', equals: 'Others' },
          description: 'Describe the reason',
          validation: {
            messages: { required: 'Please describe the reason' },
          },
        },
      ],
    },
  },

  {
    id: 'cfg-payment-request',
    key: 'payment-request',
    title: 'Request Payment',
    description:
      'Raise a payment request for an approved quote or completed repair.',
    domain: 'payments',
    isActive: true,
    version: 1,
    actions: [
      {
        key: 'submit',
        label: 'Request Payment',
        style: 'primary',
        endpoint: '/api/v1/payments/request',
        method: 'POST',
      },
    ],
    metaData: {
      title: 'Request Payment',
      sections: [
        {
          key: 'vendor',
          label: 'Vendor & Invoice',
          fields: [
            {
              key: 'vendorName',
              type: ConfigInputType.TEXT,
              label: 'Vendor',
              required: true,
              readOnly: true,
            },
            {
              key: 'bankName',
              type: ConfigInputType.TEXT,
              label: 'Bank',
              required: true,
              readOnly: true,
            },
            {
              key: 'accountNumber',
              type: ConfigInputType.TEXT,
              label: 'Account Number',
              required: true,
              readOnly: true,
            },
            {
              key: 'paymentType',
              type: ConfigInputType.TEXT,
              label: 'Payment Type',
              required: true,
              readOnly: true,
            },
            {
              key: 'invoiceNumber',
              type: ConfigInputType.TEXT,
              label: 'Invoice Number',
              required: true,
              readOnly: true,
            },
            {
              key: 'amount',
              type: ConfigInputType.MONEY,
              label: 'Amount',
              required: true,
              currency: '{{context.currency}}',
              validation: {
                numeric: true,
                min: 1,
                messages: {
                  required: 'Enter the amount to be paid',
                },
              },
            },
          ],
        },
        {
          key: 'split',
          label: 'Payment Split',
          fields: [
            {
              key: 'autochekSplit',
              type: ConfigInputType.MONEY,
              label: 'Autochek',
              required: true,
              currency: '{{context.currency}}',
              validation: { numeric: true, min: 0 },
            },
            {
              key: 'customerSplit',
              type: ConfigInputType.MONEY,
              label: 'Customer',
              required: true,
              currency: '{{context.currency}}',
              validation: { numeric: true, min: 0 },
            },
            {
              key: 'insuranceSplit',
              type: ConfigInputType.MONEY,
              label: 'Insurance',
              required: true,
              currency: '{{context.currency}}',
              validation: { numeric: true, min: 0 },
            },
            {
              key: 'repairFinancingSplit',
              type: ConfigInputType.MONEY,
              label: 'Repair Financing',
              required: true,
              currency: '{{context.currency}}',
              validation: { numeric: true, min: 0 },
            },
          ],
        },
      ],
      constraints: [
        {
          type: 'sum',
          fields: [
            'autochekSplit',
            'customerSplit',
            'insuranceSplit',
            'repairFinancingSplit',
          ],
          contextKey: 'amount',
          tolerance: 0.01,
          message: 'The payment split must equal the requested amount',
        },
      ],
    },
  },
];
