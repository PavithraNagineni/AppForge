/**
 * Config Validator
 * Handles incomplete, inconsistent, or partially incorrect configs.
 * Returns a sanitized config + a list of warnings (never throws for recoverable issues).
 */

import { AppConfig, Entity, EntityField, Page, AppComponent } from '../types/config';

export interface ValidationResult {
  config: AppConfig;
  warnings: string[];
  errors: string[];
  isValid: boolean;
}

const VALID_FIELD_TYPES = new Set([
  'string', 'text', 'number', 'integer', 'boolean',
  'datetime', 'date', 'uuid', 'enum', 'json', 'file',
]);

const VALID_COMPONENT_TYPES = new Set([
  'table', 'form', 'stats', 'chart', 'detail',
  'markdown', 'csv-importer',
]);

export function validateAndSanitizeConfig(raw: unknown): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      config: { name: 'Unnamed App', entities: [], pages: [] },
      warnings: [],
      errors: ['Config must be a JSON object'],
      isValid: false,
    };
  }

  const obj = raw as Record<string, unknown>;

  // ── name ───────────────────────────────────────────────────────────────────
  let name = 'Unnamed App';
  if (typeof obj.name === 'string' && obj.name.trim()) {
    name = obj.name.trim();
  } else {
    warnings.push('Missing or invalid "name" — defaulting to "Unnamed App"');
  }

  // ── entities ───────────────────────────────────────────────────────────────
  const entities: Entity[] = [];
  if (Array.isArray(obj.entities)) {
    for (const [i, rawEntity] of obj.entities.entries()) {
      const sanitized = sanitizeEntity(rawEntity, i, warnings, errors);
      if (sanitized) entities.push(sanitized);
    }
  } else if (obj.entities !== undefined) {
    warnings.push('"entities" should be an array — ignoring');
  }

  // ── pages ──────────────────────────────────────────────────────────────────
  const pages: Page[] = [];
  if (Array.isArray(obj.pages)) {
    for (const [i, rawPage] of obj.pages.entries()) {
      const sanitized = sanitizePage(rawPage, i, entities, warnings, errors);
      if (sanitized) pages.push(sanitized);
    }
  } else {
    warnings.push('"pages" missing or not an array — no pages will be rendered');
  }

  // ── auth ───────────────────────────────────────────────────────────────────
  const auth = sanitizeAuth(obj.auth, warnings);

  // ── theme ──────────────────────────────────────────────────────────────────
  const theme = sanitizeTheme(obj.theme, warnings);

  // ── locale ─────────────────────────────────────────────────────────────────
  const locale = sanitizeLocale(obj.locale, warnings);

  // ── navigation ─────────────────────────────────────────────────────────────
  const navigation = Array.isArray(obj.navigation)
    ? obj.navigation.filter((n) => n && typeof n === 'object')
    : generateNavFromPages(pages);

  const config: AppConfig = {
    id: typeof obj.id === 'string' ? obj.id : undefined,
    name,
    version: typeof obj.version === 'string' ? obj.version : '1.0.0',
    description: typeof obj.description === 'string' ? obj.description : undefined,
    locale,
    auth,
    theme,
    entities,
    pages,
    navigation,
  };

  return {
    config,
    warnings,
    errors,
    isValid: errors.length === 0,
  };
}

function sanitizeEntity(
  raw: unknown,
  index: number,
  warnings: string[],
  errors: string[],
): Entity | null {
  if (!raw || typeof raw !== 'object') {
    warnings.push(`Entity at index ${index} is not an object — skipping`);
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    errors.push(`Entity at index ${index} missing required "name" — skipping`);
    return null;
  }

  const name = obj.name.trim();
  const fields: EntityField[] = [];

  // Always ensure id field exists
  const hasId = Array.isArray(obj.fields) &&
    obj.fields.some((f: unknown) => typeof f === 'object' && f !== null && (f as Record<string, unknown>).primary === true);

  if (!hasId) {
    fields.push({ name: 'id', type: 'uuid', primary: true, auto: true });
  }

  if (Array.isArray(obj.fields)) {
    for (const [fi, rawField] of obj.fields.entries()) {
      const sf = sanitizeField(rawField, fi, name, warnings);
      if (sf) fields.push(sf);
    }
  } else {
    warnings.push(`Entity "${name}" has no fields array — only id field will exist`);
  }

  // Always add timestamps unless explicitly disabled
  const hasTimestamps = obj.timestamps !== false;
  if (hasTimestamps) {
    const hasCreatedAt = fields.some((f) => f.name === 'createdAt');
    const hasUpdatedAt = fields.some((f) => f.name === 'updatedAt');
    if (!hasCreatedAt) fields.push({ name: 'createdAt', type: 'datetime', auto: true, readonly: true });
    if (!hasUpdatedAt) fields.push({ name: 'updatedAt', type: 'datetime', auto: true, readonly: true });
  }

  return {
    name,
    displayName: typeof obj.displayName === 'string' ? obj.displayName : name,
    fields,
    relations: Array.isArray(obj.relations) ? obj.relations as Entity['relations'] : [],
    timestamps: hasTimestamps,
    userScoped: obj.userScoped !== false,
  };
}

function sanitizeField(
  raw: unknown,
  index: number,
  entityName: string,
  warnings: string[],
): EntityField | null {
  if (!raw || typeof raw !== 'object') {
    warnings.push(`Field at index ${index} in entity "${entityName}" is not an object — skipping`);
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    warnings.push(`Field at index ${index} in entity "${entityName}" missing "name" — skipping`);
    return null;
  }

  const name = obj.name.trim();
  let type = obj.type as string;

  if (!VALID_FIELD_TYPES.has(type)) {
    warnings.push(`Field "${entityName}.${name}" has unknown type "${type}" — defaulting to "string"`);
    type = 'string';
  }

  // Enum requires options
  if (type === 'enum') {
    if (!Array.isArray(obj.options) || obj.options.length === 0) {
      warnings.push(`Field "${entityName}.${name}" is enum but has no options — defaulting to string`);
      type = 'string';
    }
  }

  return {
    name,
    type: type as EntityField['type'],
    required: Boolean(obj.required),
    primary: Boolean(obj.primary),
    auto: Boolean(obj.auto),
    unique: Boolean(obj.unique),
    default: obj.default,
    options: type === 'enum' && Array.isArray(obj.options) ? obj.options.map(String) : undefined,
    maxLength: typeof obj.maxLength === 'number' ? obj.maxLength : undefined,
    min: typeof obj.min === 'number' ? obj.min : undefined,
    max: typeof obj.max === 'number' ? obj.max : undefined,
    label: typeof obj.label === 'string' ? obj.label : undefined,
    hidden: Boolean(obj.hidden),
    readonly: Boolean(obj.readonly),
  };
}

function sanitizePage(
  raw: unknown,
  index: number,
  entities: Entity[],
  warnings: string[],
  errors: string[],
): Page | null {
  if (!raw || typeof raw !== 'object') {
    warnings.push(`Page at index ${index} is not an object — skipping`);
    return null;
  }

  const obj = raw as Record<string, unknown>;

  const id = typeof obj.id === 'string' ? obj.id : `page-${index}`;
  const path = typeof obj.path === 'string' ? obj.path : `/page-${index}`;
  const title = typeof obj.title === 'string' ? obj.title : `Page ${index + 1}`;

  const components: AppComponent[] = [];
  if (Array.isArray(obj.components)) {
    for (const [ci, rawComp] of obj.components.entries()) {
      const sc = sanitizeComponent(rawComp, ci, id, entities, warnings);
      components.push(sc); // Always push (even unknown types get placeholder)
    }
  }

  const VALID_LAYOUTS = new Set(['dashboard', 'blank', 'centered']);
  const layout = VALID_LAYOUTS.has(obj.layout as string)
    ? (obj.layout as Page['layout'])
    : 'dashboard';

  return {
    id,
    path,
    title,
    requiresAuth: obj.requiresAuth !== false, // default true
    layout,
    components,
  };
}

function sanitizeComponent(
  raw: unknown,
  index: number,
  pageId: string,
  entities: Entity[],
  warnings: string[],
): AppComponent {
  if (!raw || typeof raw !== 'object') {
    warnings.push(`Component at index ${index} on page "${pageId}" is not an object`);
    return { type: 'unknown', _error: 'Component is not an object' };
  }

  const obj = raw as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : 'unknown';

  if (!VALID_COMPONENT_TYPES.has(type)) {
    warnings.push(`Component "${type}" at index ${index} on page "${pageId}" is unknown — rendering placeholder`);
    return { ...obj, type } as AppComponent;
  }

  // Entity-bound component validation
  if (['table', 'form', 'detail', 'csv-importer'].includes(type)) {
    const entityName = obj.entity as string;
    if (entityName && !entities.find((e) => e.name === entityName)) {
      warnings.push(`Component "${type}" references unknown entity "${entityName}" on page "${pageId}"`);
    }
  }

  return obj as AppComponent;
}

function sanitizeAuth(raw: unknown, warnings: string[]): AppConfig['auth'] {
  if (!raw) return { enabled: true, methods: ['email'] };
  if (typeof raw !== 'object') {
    warnings.push('"auth" should be an object — using defaults');
    return { enabled: true, methods: ['email'] };
  }

  const obj = raw as Record<string, unknown>;
  const validMethods = new Set(['email', 'google', 'magic-link']);
  let methods: AppConfig['auth']['methods'] = ['email'];

  if (Array.isArray(obj.methods)) {
    methods = obj.methods.filter((m) => validMethods.has(m)) as typeof methods;
    if (methods.length === 0) {
      warnings.push('No valid auth methods — defaulting to email');
      methods = ['email'];
    }
  }

  return {
    enabled: obj.enabled !== false,
    methods,
    ui: typeof obj.ui === 'object' && obj.ui !== null ? obj.ui as AppConfig['auth']['ui'] : undefined,
  };
}

function sanitizeTheme(raw: unknown, _warnings: string[]): AppConfig['theme'] {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  return {
    primaryColor: typeof obj.primaryColor === 'string' ? obj.primaryColor : undefined,
    borderRadius: typeof obj.borderRadius === 'string' ? obj.borderRadius : undefined,
    fontFamily: typeof obj.fontFamily === 'string' ? obj.fontFamily : undefined,
    darkMode: Boolean(obj.darkMode),
  };
}

function sanitizeLocale(raw: unknown, warnings: string[]): AppConfig['locale'] {
  if (!raw) return { default: 'en', supported: ['en'], strings: {} };
  if (typeof raw !== 'object') {
    warnings.push('"locale" should be an object — using defaults');
    return { default: 'en', supported: ['en'], strings: {} };
  }

  const obj = raw as Record<string, unknown>;
  return {
    default: typeof obj.default === 'string' ? obj.default : 'en',
    supported: Array.isArray(obj.supported) ? obj.supported.map(String) : ['en'],
    strings: typeof obj.strings === 'object' && obj.strings !== null
      ? obj.strings as Record<string, Record<string, string>>
      : {},
  };
}

function generateNavFromPages(pages: Page[]): AppConfig['navigation'] {
  return pages.map((p) => ({ label: p.title, path: p.path }));
}
