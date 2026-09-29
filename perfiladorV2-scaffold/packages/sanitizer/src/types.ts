export interface RedactionDetail {
  rule: string;
  count: number;
}

export interface SanitizationResult {
  sanitized: string;
  hasRedactions: boolean;
  redactedCount: number;
  redactions: RedactionDetail[];
}

export interface SanitizeRule {
  name: string;
  pattern: RegExp;
  replacement: string | ((substring: string, ...args: any[]) => string);
}