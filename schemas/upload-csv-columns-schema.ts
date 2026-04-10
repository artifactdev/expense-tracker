import { z } from 'zod';

import { FIELDS_FROM_CSV, MULTI_COLUMN_FIELDS } from '@/utils/const';

// Diese Felder sind optional (kein Pflichtfeld beim Mapping)
const OPTIONAL_CSV_FIELDS = new Set(['Notes', 'Counterparty', 'Account', 'PaymentType']);

export const uploadCSVColumnsObject = {
  ...FIELDS_FROM_CSV.reduce(
    (acc, field) => {
      const isMulti = MULTI_COLUMN_FIELDS.has(field);
      const isOptional = OPTIONAL_CSV_FIELDS.has(field);

      if (isMulti) {
        // Multi-column fields: array of column names (JSON-stringified in FormData)
        const schema = z
          .union([z.string(), z.array(z.string())])
          .transform(v => (typeof v === 'string' ? [v] : v));
        acc[field] = isOptional ? schema.optional() : schema;
      } else if (isOptional) {
        acc[field] = z.string().optional();
      } else {
        acc[field] = z.string({
          required_error: `Need to select an option to parse the ${field}`,
        });
      }
      return acc;
    },
    {} as Record<string, z.ZodTypeAny>
  ),
  DateFormat: z.string({
    required_error: 'Need to select the date format on your CSV',
  }),
} as Record<string, z.ZodTypeAny>;

export const UploadCSVColumnsSchema = z.object(uploadCSVColumnsObject);
