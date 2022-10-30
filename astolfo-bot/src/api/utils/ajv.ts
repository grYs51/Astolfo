import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({
  coerceTypes: true,
  useDefaults: true,
  removeAdditional: true,
});

ajv.addFormat('object-id', /^[\da-fA-F]{24}$/);

addFormats(ajv, { keywords: true });

export default ajv;
