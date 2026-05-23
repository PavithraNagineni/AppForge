/**
 * Runtime record validator.
 * Validates and coerces data against an Entity's field definitions.
 */

import { Entity, EntityField } from '../types/config';

export interface RecordValidationResult {
  data: Record<string, unknown>;
  errors: Record<string, string>;
  isValid: boolean;
}

export function validateRecord(
  raw: Record<string, unknown>,
  entity: Entity,
  mode: 'create' | 'update' = 'create',
): RecordValidationResult {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const field of entity.fields) {
    // Skip auto/primary/readonly fields
    if (field.auto || field.primary || field.readonly) continue;
    if (field.name === 'createdAt' || field.name === 'updatedAt') continue;

    const rawValue = raw[field.name];
    const isPresent = rawValue !== undefined && rawValue !== null && rawValue !== '';

    // Required check (only on create, or if value provided on update)
    if (field.required && mode === 'create' && !isPresent) {
      errors[field.name] = `${field.label || field.name} is required`;
      continue;
    }

    // Skip optional missing fields
    if (!isPresent) {
      if (field.default !== undefined) {
        data[field.name] = field.default;
      }
      continue;
    }

    // Type coercion + validation
    const result = coerceField(field, rawValue);
    if (result.error) {
      errors[field.name] = result.error;
    } else {
      data[field.name] = result.value;
    }
  }

  return { data, errors, isValid: Object.keys(errors).length === 0 };
}

function coerceField(
  field: EntityField,
  value: unknown,
): { value?: unknown; error?: string } {
  const label = field.label || field.name;

  switch (field.type) {
    case 'string':
    case 'file': {
      const str = String(value);
      if (field.maxLength && str.length > field.maxLength) {
        return { error: `${label} exceeds maximum length of ${field.maxLength}` };
      }
      return { value: str };
    }

    case 'text': {
      return { value: String(value) };
    }

    case 'number': {
      const num = Number(value);
      if (isNaN(num)) return { error: `${label} must be a number` };
      if (field.min !== undefined && num < field.min) return { error: `${label} must be ≥ ${field.min}` };
      if (field.max !== undefined && num > field.max) return { error: `${label} must be ≤ ${field.max}` };
      return { value: num };
    }

    case 'integer': {
      const int = parseInt(String(value), 10);
      if (isNaN(int)) return { error: `${label} must be an integer` };
      if (field.min !== undefined && int < field.min) return { error: `${label} must be ≥ ${field.min}` };
      if (field.max !== undefined && int > field.max) return { error: `${label} must be ≤ ${field.max}` };
      return { value: int };
    }

    case 'boolean': {
      if (typeof value === 'boolean') return { value };
      if (value === 'true' || value === '1' || value === 1) return { value: true };
      if (value === 'false' || value === '0' || value === 0) return { value: false };
      return { error: `${label} must be true or false` };
    }

    case 'datetime':
    case 'date': {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return { error: `${label} must be a valid date` };
      return { value: d.toISOString() };
    }

    case 'uuid': {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const str = String(value);
      if (!uuidRegex.test(str)) return { error: `${label} must be a valid UUID` };
      return { value: str };
    }

    case 'enum': {
      const str = String(value);
      if (!field.options?.includes(str)) {
        return { error: `${label} must be one of: ${field.options?.join(', ')}` };
      }
      return { value: str };
    }

    case 'json': {
      if (typeof value === 'object') return { value };
      try {
        return { value: JSON.parse(String(value)) };
      } catch {
        return { error: `${label} must be valid JSON` };
      }
    }

    default:
      return { value };
  }
}
