declare module 'pg' {
  export class Pool {
    constructor(config?: Record<string, unknown>);
  }

  const pg: {
    Pool: typeof Pool;
  };

  export default pg;
}

declare module 'drizzle-orm' {
  export function relations(table: unknown, builder: (helpers: { one: (...args: unknown[]) => unknown; many: (...args: unknown[]) => unknown }) => unknown): unknown;
  export function sql(strings: TemplateStringsArray, ...values: unknown[]): unknown;
}

declare module 'drizzle-orm/node-postgres' {
  export function drizzle(pool: unknown, options?: Record<string, unknown>): unknown;
}

declare module 'drizzle-orm/pg-core' {
  export function check(name: string, expression: unknown): unknown;
  export function index(name: string): { on: (...columns: unknown[]) => unknown };
  export function uniqueIndex(name: string): { on: (...columns: unknown[]) => unknown };
  export function primaryKey(config: { columns: unknown[] }): unknown;

  type ColumnBuilder = {
    default(value: unknown): ColumnBuilder;
    defaultRandom(): ColumnBuilder;
    defaultNow(): ColumnBuilder;
    notNull(): ColumnBuilder;
    primaryKey(): ColumnBuilder;
    references(callback: () => unknown, options?: Record<string, unknown>): ColumnBuilder;
    unique(): ColumnBuilder;
  };

  export function jsonb(name: string): ColumnBuilder;
  export function numeric(name: string, config?: Record<string, unknown>): ColumnBuilder;
  export function text(name: string): ColumnBuilder;
  export function timestamp(name: string, config?: Record<string, unknown>): ColumnBuilder;
  export function uuid(name: string): ColumnBuilder;
  export function pgTable(name: string, columns: Record<string, unknown>, extraConfig?: (table: Record<string, unknown>) => Record<string, unknown>): Record<string, unknown>;
}
