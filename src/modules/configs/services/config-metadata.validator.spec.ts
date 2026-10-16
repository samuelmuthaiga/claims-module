import { ConfigMetadataValidator, evaluateRule, isEmptyValue } from './config-metadata.validator';

const validator = new ConfigMetadataValidator();
const validate = (meta: Record<string, any>, values: Record<string, any>, context = {}, options = {}) =>
  validator.validateAndApplyConfigMeta(meta, values, context, options);
const keys = (result: { errors: { key: string }[] }) => result.errors.map((e) => e.key);

describe('ConfigMetadataValidator', () => {
  describe('schema validation', () => {
    it('accepts a minimal valid form', () => {
      const result = validator.validateConfigSchema('FORM', { fields: [{ key: 'a', type: 'text', label: 'A' }] });
      expect(result).toEqual({ ok: true, errors: [] });
    });

    it.each([
      ['missing fields', { title: 'x' }, '(root)'],
      ['duplicate keys', { fields: [{ key: 'a', type: 'text', label: 'A' }, { key: 'a', type: 'text', label: 'B' }] }, 'a'],
      ['unknown type', { fields: [{ key: 'a', type: 'colour', label: 'A' }] }, 'a'],
      ['select without options', { fields: [{ key: 'a', type: 'select', label: 'A' }] }, 'a'],
      ['group without fields', { fields: [{ key: 'a', type: 'group', label: 'A' }] }, 'a'],
      ['rule on unknown field', { fields: [{ key: 'a', type: 'text', label: 'A', required_if: { field: 'ghost', equals: 1 } }] }, 'a'],
      ['relative options_source url', { fields: [{ key: 'a', type: 'select', label: 'A', options_source: { url: 'v1/x' } }] }, 'a'],
      ['constraint on unknown field', { fields: [{ key: 'a', type: 'number', label: 'A' }], constraints: [{ type: 'sum', fields: ['zzz'], value: 1 }] }, 'constraints.0'],
    ])('rejects %s', (_name, meta, key) => {
      const result = validator.validateConfigSchema('FORM', meta as Record<string, any>);
      expect(result.ok).toBe(false);
      expect(keys(result)).toContain(key);
    });

    it('rejects duplicate option values', () => {
      const result = validator.validateConfigSchema('FORM', {
        fields: [{ key: 'a', type: 'select', label: 'A', options: [{ value: 'x', label: 'X' }, { value: 'x', label: 'Y' }] }],
      });
      expect(result.errors[0]?.message).toContain('Duplicate option value');
    });

    it('allows context-sourced rules without a matching field', () => {
      const result = validator.validateConfigSchema('FORM', {
        fields: [{ key: 'a', type: 'text', label: 'A', visible_if: { source: 'context', field: 'flag', equals: true } }],
      });
      expect(result.ok).toBe(true);
    });

    it('validates TABLE, WORKFLOW and SETTINGS shapes', () => {
      expect(validator.validateConfigSchema('TABLE', { endpoint: 'bad', columns: [] }).ok).toBe(false);
      expect(validator.validateConfigSchema('TABLE', { endpoint: '/v1/x', columns: [{ key: 'a', label: 'A', path: 'a', format: 'nope' }] }).ok).toBe(false);
      expect(validator.validateConfigSchema('SETTINGS', {}).ok).toBe(false);

      const workflow = {
        statuses: [{ code: 'A', label: 'A' }],
        rails: { REPAIRS: ['A', 'B'] },
        actions: [{ action: 'go', label: 'Go', from: ['C'], permission: 'p', endpoint: '/v1/x', inputSchemaRef: 'missing' }],
      };
      const result = validator.validateConfigSchema('WORKFLOW', workflow, new Set(['other']));
      expect(result.errors.map((e) => e.message)).toEqual(
        expect.arrayContaining([
          "Unknown status 'B' in rail",
          "Unknown status 'C' in action.from",
          "inputSchemaRef 'missing' is not a known form config",
        ]),
      );
    });
  });

  describe('value validation', () => {
    const base = {
      fields: [
        { key: 'name', type: 'text', label: 'Name', required: true, validation: { minLength: 3, messages: { required: 'Name please' } } },
        { key: 'email', type: 'email', label: 'Email' },
        { key: 'amount', type: 'money', label: 'Amount', validation: { min: 1, max: 100, multipleOf: 0.5 } },
        { key: 'kind', type: 'select', label: 'Kind', options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }] },
        { key: 'doc', type: 'file', label: 'Doc', validation: { allowedFileTypes: ['.pdf'] } },
      ],
    };

    it('passes valid values and echoes them onto the schema', () => {
      const result = validate(base, { name: 'Jane', kind: 'A', amount: 10.5 });
      expect(result.ok).toBe(true);
      expect(result.metaData?.fields[0].value).toBe('Jane');
    });

    it('uses custom messages and field-keyed errors', () => {
      const result = validate(base, {});
      expect(result.errors).toEqual([{ key: 'name', message: 'Name please' }]);
    });

    it('checks lengths, formats, ranges, steps, options and file types', () => {
      const result = validate(base, { name: 'Jo', email: 'nope', amount: 0.7, kind: 'Z', doc: 'https://f/x.png' });
      expect(keys(result).sort()).toEqual(['amount', 'amount', 'doc', 'email', 'kind', 'name']);
    });

    it('requires file urls and reads {url} objects', () => {
      expect(keys(validate(base, { name: 'Jane', doc: { url: '' } }))).toEqual([]);
      expect(keys(validate(base, { name: 'Jane', doc: { url: 'https://f/x.pdf' } }))).toEqual([]);
    });

    it('evaluates required_if / visible_if on form values', () => {
      const meta = {
        fields: [
          { key: 'type', type: 'text', label: 'T' },
          { key: 'sub', type: 'text', label: 'S', visible_if: { field: 'type', equals: 'W' }, required_if: { field: 'type', equals: 'W' } },
        ],
      };
      expect(keys(validate(meta, { type: 'W' }))).toEqual(['sub']);
      expect(keys(validate(meta, { type: 'R' }))).toEqual([]);
      expect(keys(validate(meta, { type: 'R', sub: 'ignored' }))).toEqual([]);
    });

    it('evaluates rules against the entity context', () => {
      const meta = { fields: [{ key: 'rf', type: 'number', label: 'RF', required_if: { source: 'context', field: 'repairFinanced', equals: true } }] };
      expect(keys(validate(meta, {}, { repairFinanced: true }))).toEqual(['rf']);
      expect(keys(validate(meta, {}, { repairFinanced: false }))).toEqual([]);
    });

    it('skips transient fields when validating an API payload', () => {
      const meta = { fields: [{ key: 'helper', type: 'text', label: 'H', required: true, transient: true }] };
      expect(keys(validate(meta, {}))).toEqual(['helper']);
      expect(keys(validate(meta, {}, {}, { skipTransient: true }))).toEqual([]);
    });
  });

  describe('groups', () => {
    const meta = {
      fields: [
        {
          key: 'items', type: 'group', label: 'Items', required: true, repeatable: true, validation: { minCount: 1 },
          fields: [
            { key: 'desc', type: 'text', label: 'D', required: true },
            { key: 'qty', type: 'number', label: 'Q', required: true, validation: { min: 1 } },
          ],
        },
        {
          key: 'split', type: 'group', label: 'Split',
          fields: [{ key: 'a', type: 'money', label: 'A', required: true }],
        },
      ],
    };

    it('validates each repeated row against its own values with indexed keys', () => {
      const result = validate(meta, { items: [{ desc: 'x', qty: 2 }, { desc: '', qty: 0 }] });
      expect(keys(result).sort()).toEqual(['items.1.desc', 'items.1.qty']);
    });

    it('does not validate row fields against root values', () => {
      // Regression: nested keys used to be looked up at the root, so valid rows failed.
      expect(validate(meta, { items: [{ desc: 'x', qty: 2 }] }).ok).toBe(true);
    });

    it('enforces minCount and shape of repeatable groups', () => {
      expect(keys(validate(meta, { items: [] }))).toEqual(['items']);
      expect(keys(validate(meta, { items: 'nope' }))).toEqual(['items']);
    });

    it('validates non-repeatable (object) groups with dotted keys', () => {
      const rows = { items: [{ desc: 'x', qty: 1 }] };
      // An untouched optional group is skipped; a partially filled one is validated.
      expect(validate(meta, { ...rows, split: {} }).ok).toBe(true);
      expect(keys(validate(meta, { ...rows, split: { b: 1 } }))).toEqual(['split.a']);
    });
  });

  describe('constraints', () => {
    const meta = {
      fields: [
        { key: 'a', type: 'money', label: 'A' },
        { key: 'b', type: 'money', label: 'B' },
        { key: 'total', type: 'money', label: 'Total' },
        { key: 'rows', type: 'group', label: 'Rows', repeatable: true, fields: [{ key: 'q', type: 'number', label: 'Q' }, { key: 'u', type: 'number', label: 'U' }] },
      ],
      constraints: [
        { type: 'sum', fields: ['a', 'b'], equals: 'total', message: 'sum!' },
        { type: 'lte', field: 'a', max: 'total', message: 'lte!' },
        { type: 'sumRows', collection: 'rows', multiply: ['q', 'u'], equals: 'total', message: 'rows!' },
      ],
    };

    it('passes when all constraints hold', () => {
      expect(validate(meta, { a: 40, b: 60, total: 100, rows: [{ q: 2, u: 50 }] }).ok).toBe(true);
    });

    it('reports each violated constraint', () => {
      const result = validate(meta, { a: 90, b: 20, total: 100, rows: [{ q: 1, u: 10 }] });
      expect(result.errors.map((e) => e.message).sort()).toEqual(['rows!', 'sum!']);
    });

    it('resolves targets from the context', () => {
      const ctxMeta = { fields: [{ key: 'a', type: 'money', label: 'A' }], constraints: [{ type: 'sum', fields: ['a'], contextKey: 'quoteTotal', message: 'ctx!' }] };
      expect(keys(validate(ctxMeta, { a: 5 }, { quoteTotal: 10 }))).toEqual(['a']);
      expect(validate(ctxMeta, { a: 10 }, { quoteTotal: 10 }).ok).toBe(true);
      expect(validate(ctxMeta, { a: 5 }, {}).ok).toBe(true); // nothing to compare against
    });

    it('does not pile a constraint error on top of a field error', () => {
      const result = validate(meta, { a: 'x', b: 1, total: 100 });
      expect(result.errors.filter((e) => e.key === 'a')).toHaveLength(1);
    });
  });

  describe('helpers', () => {
    it('isEmptyValue', () => {
      expect([null, undefined, '', '  ', [], [''], {}, { url: '' }].every(isEmptyValue)).toBe(true);
      expect([0, false, 'x', [1], { url: 'u' }].some(isEmptyValue)).toBe(false);
    });

    it('evaluateRule only applies once the other field is answered', () => {
      expect(evaluateRule({ field: 'x', equals: 'a' }, {}, {})).toBe(false);
      expect(evaluateRule({ field: 'x', equals: 'a' }, { x: 'a' }, {})).toBe(true);
      expect(evaluateRule({ field: 'x', not_equals: 'a' }, { x: 'b' }, {})).toBe(true);
      expect(evaluateRule({ field: 'x', in: ['a', 'b'] }, { x: 'b' }, {})).toBe(true);
      expect(evaluateRule({ field: 'x', not_in: ['a'] }, { x: 'a' }, {})).toBe(false);
      expect(evaluateRule({ source: 'context', field: 'f', equals: false }, {}, { f: false })).toBe(true);
    });
  });
});
