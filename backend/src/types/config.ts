// AppForge Config Types — source of truth for both frontend and backend

export type FieldType =
  | 'string' | 'text' | 'number' | 'integer' | 'boolean'
  | 'datetime' | 'date' | 'uuid' | 'enum' | 'json' | 'file';

export interface EntityField {
  name: string;
  type: FieldType;
  required?: boolean;
  primary?: boolean;
  auto?: boolean;         // auto-generate (uuid, timestamp)
  unique?: boolean;
  default?: unknown;
  options?: string[];     // for enum
  maxLength?: number;
  min?: number;
  max?: number;
  label?: string;         // display label override
  hidden?: boolean;       // hide from UI
  readonly?: boolean;
}

export interface EntityRelation {
  type: 'belongsTo' | 'hasMany' | 'hasOne';
  entity: string;
  foreignKey: string;
}

export interface Entity {
  name: string;
  displayName?: string;
  fields: EntityField[];
  relations?: EntityRelation[];
  timestamps?: boolean; // default true
  userScoped?: boolean; // default true — records belong to user
}

// ── UI Components ─────────────────────────────────────────────────────────────

export type ComponentType =
  | 'table' | 'form' | 'stats' | 'chart' | 'detail'
  | 'markdown' | 'csv-importer' | 'unknown';

export interface TableColumn {
  field: string;
  label?: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'text' | 'badge' | 'boolean' | 'date' | 'number' | 'currency';
}

export interface TableComponent {
  type: 'table';
  entity: string;
  columns?: string[] | TableColumn[];
  actions?: Array<'create' | 'edit' | 'delete' | 'export-csv' | 'import-csv'>;
  filters?: string[];
  searchable?: boolean;
  pagination?: { pageSize: number };
  title?: string;
}

export interface FormField {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface FormComponent {
  type: 'form';
  entity: string;
  fields?: string[] | FormField[];
  submitLabel?: string;
  redirectOnSuccess?: string;
  title?: string;
  mode?: 'create' | 'edit';
}

export interface StatsMetric {
  label: string;
  entity: string;
  field?: string;
  aggregate: 'count' | 'sum' | 'avg' | 'min' | 'max';
  prefix?: string;
  suffix?: string;
  icon?: string;
}

export interface StatsComponent {
  type: 'stats';
  metrics: StatsMetric[];
}

export interface ChartComponent {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  entity: string;
  groupBy: string;
  field?: string;
  aggregate: 'count' | 'sum' | 'avg';
  title?: string;
}

export interface MarkdownComponent {
  type: 'markdown';
  content: string;
}

export interface CsvImporterComponent {
  type: 'csv-importer';
  entity: string;
  title?: string;
}

export interface UnknownComponent {
  type: string;
  [key: string]: unknown;
}

export type AppComponent =
  | TableComponent | FormComponent | StatsComponent
  | ChartComponent | MarkdownComponent | CsvImporterComponent | UnknownComponent;

// ── Pages ─────────────────────────────────────────────────────────────────────

export type LayoutType = 'dashboard' | 'blank' | 'centered';

export interface Page {
  id: string;
  path: string;
  title: string;
  requiresAuth?: boolean;
  layout?: LayoutType;
  components: AppComponent[];
}

// ── Navigation ────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  path?: string;
  icon?: string;
  children?: NavItem[];
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthConfig {
  enabled?: boolean;
  methods?: Array<'email' | 'google' | 'magic-link'>;
  ui?: {
    logo?: string;
    primaryColor?: string;
    title?: string;
    subtitle?: string;
  };
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export interface ThemeConfig {
  primaryColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  darkMode?: boolean;
}

// ── Locale ────────────────────────────────────────────────────────────────────

export interface LocaleConfig {
  default?: string;
  supported?: string[];
  strings?: Record<string, Record<string, string>>;
}

// ── App Config (root) ─────────────────────────────────────────────────────────

export interface AppConfig {
  id?: string;
  name: string;
  version?: string;
  description?: string;
  locale?: LocaleConfig;
  auth?: AuthConfig;
  theme?: ThemeConfig;
  entities: Entity[];
  pages: Page[];
  navigation?: NavItem[];
}

// ── API Types ─────────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
  code?: string;
}
