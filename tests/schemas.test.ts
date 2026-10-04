import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { expect, it } from 'vitest';
import { intent, manifest, selection } from './data';

it('validates portable JSON Schema contracts and their rejection cases', async () => {
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  for (const [name, value] of Object.entries({ manifest, selection, intent })) {
    const schema = JSON.parse(await readFile('schemas/' + name + '.schema.json', 'utf8'));
    const validate = ajv.compile(schema);
    expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...value, schema: 'unsupported' })).toBe(false);
    expect(validate({ ...value, source_revision: undefined })).toBe(false);
    if (name === 'selection') {
      expect(validate({ ...selection, entity_ids: ['x', 'x'] })).toBe(false);
      expect(validate({ ...selection, mode: 'clear' })).toBe(false);
    }
    if (name === 'manifest') expect(validate({ ...manifest, proxy_uri: '../unsafe.glb' })).toBe(false);
  }
});
