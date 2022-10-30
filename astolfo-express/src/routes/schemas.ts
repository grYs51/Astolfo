import { JSONSchemaType } from 'ajv';
import ajv from '../utils/ajv';

interface IdParam {
  id: string;
}

const idParam: JSONSchemaType<IdParam> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'object-id' },
  },
  required: ['id'],
};

export const validateIdParam = ajv.compile<IdParam>(idParam);
