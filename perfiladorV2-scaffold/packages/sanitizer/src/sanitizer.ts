import { SanitizationResult, SanitizeRule, RedactionDetail } from './types';

export class SecretSanitizer {
  private static readonly RULES: SanitizeRule[] = [
    // 1. Llaves privadas PEM
    {
      name: 'PRIVATE_KEY',
      pattern: /-----BEGIN[ A-Z_-]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z_-]*PRIVATE KEY-----/gi,
      replacement: '[REDACTED_PRIVATE_KEY]'
    },
    // 2. Cadenas de conexión URI (Postgres, Mongo, Redis, etc.)
    {
      name: 'DATABASE_CONNECTION_STRING',
      pattern: /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"'`]+/gi,
      replacement: '[REDACTED_DB_CONNECTION_STRING]'
    },
   // 3. Google Gemini API Keys
    {
      name: 'GOOGLE_API_KEY',
      pattern: /AIzaSy[0-9A-Za-z_-]{30,40}/g,
      replacement: '[REDACTED_GOOGLE_API_KEY]'
    },
    // 4. OpenAI API Keys
    {
      name: 'OPENAI_API_KEY',
      pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
      replacement: '[REDACTED_OPENAI_API_KEY]'
    },
    // 5. GitHub Personal Access Tokens
    {
      name: 'GITHUB_TOKEN',
      pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{82}/g,
      replacement: '[REDACTED_GITHUB_TOKEN]'
    },
    // 6. AWS Access Keys
    {
      name: 'AWS_ACCESS_KEY',
      pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
      replacement: '[REDACTED_AWS_ACCESS_KEY]'
    },
    // 7. Tokens JWT
    {
      name: 'JWT_TOKEN',
      pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
      replacement: '[REDACTED_JWT_TOKEN]'
    },
    // 8. Bearer Auth
    {
      name: 'BEARER_AUTH',
      pattern: /Bearer\s+[A-Za-z0-9_\-\.+=]{20,}/gi,
      replacement: 'Bearer [REDACTED_BEARER_TOKEN]'
    },
    // 9. Asignaciones de contraseñas y secretos
    {
      name: 'SUPABASE_SECRET_KEY',
      pattern: /sb_secret_[A-Za-z0-9_-]{20,}/g,
      replacement: '[REDACTED_SUPABASE_SECRET_KEY]'
    },
    {
      name: 'JSON_ASSIGNED_SECRET',
      pattern: /(["'])(api[_-]?key|secret|password|passwd|auth[_-]?token|access[_-]?token|private[_-]?key)(["']\s*:\s*["'])([^"']{8,})(["'])/gi,
      replacement: '$1$2$3[REDACTED_SECRET]$5'
    },
    {
      name: 'GENERIC_ASSIGNED_SECRET',
      pattern: /(^|[\s;])([A-Z0-9_]*(?:API[_-]?KEY|SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE[_-]?KEY)[A-Z0-9_]*)(\s*=\s*)(["']?)([^\s"'`;]{8,})(["']?)/gim,
      replacement: '$1$2$3$4[REDACTED_SECRET]$6'
    }
  ];

  public static sanitize(input: string): SanitizationResult {
    if (!input || typeof input !== 'string') {
      return { sanitized: '', hasRedactions: false, redactedCount: 0, redactions: [] };
    }

    let sanitized = input;
    const redactions: RedactionDetail[] = [];

    for (const rule of this.RULES) {
      let matches = 0;
      sanitized = sanitized.replace(rule.pattern, (...args) => {
        matches++;
        if (typeof rule.replacement === 'function') {
          return rule.replacement(...args);
        }
        if (rule.replacement.includes('$')) {
          let str = rule.replacement;
          for (let i = 1; i <= 6; i++) {
            str = str.replace(`$${i}`, args[i] || '');
          }
          return str;
        }
        return rule.replacement;
      });

      if (matches > 0) {
        redactions.push({ rule: rule.name, count: matches });
      }
    }

    const totalRedacted = redactions.reduce((acc, curr) => acc + curr.count, 0);

    return {
      sanitized,
      hasRedactions: totalRedacted > 0,
      redactedCount: totalRedacted,
      redactions
    };
  }

  public static hasSecrets(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    return this.RULES.some((rule) => {
      rule.pattern.lastIndex = 0;
      return rule.pattern.test(input);
    });
  }
}
