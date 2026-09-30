import { db, pool } from './db';
import { organizations, seniorityBenchmarks, skillTaxonomy } from './schema';

// Official 1.0 to 5.0 engineering rubrics used by the pilot seed.
const domainRubrics: Record<string, Record<string, string>> = {
  Architecture: {
    '1': 'No separation of concerns, unclear boundaries, or framework-coupled domain logic.',
    '2': 'Recognizes common patterns but still introduces tight coupling or weak dependency direction.',
    '3': 'Designs mostly decoupled modules and applies Clean Architecture consistently.',
    '4': 'Evaluates architecture trade-offs, resilience, scaling, and operational constraints.',
    '5': 'Defines architecture standards, ADRs, and reusable guidance across multiple teams.'
  },
  Backend: {
    '1': 'Struggles with async flows, blocking queries, or missing validation.',
    '2': 'Builds basic endpoints but may miss transactions, indexes, or error boundaries.',
    '3': 'Handles concurrency, ACID transactions, query safety, and database performance deliberately.',
    '4': 'Optimizes high-concurrency bottlenecks, pooling, caching, and data ownership.',
    '5': 'Designs resilient backend platforms, streaming pipelines, partitioning, and recovery patterns.'
  },
  Quality: {
    '1': 'Little meaningful test coverage or fragile behavior under unexpected input.',
    '2': 'Writes basic unit tests but misses edge cases and regression coverage.',
    '3': 'Applies a practical test pyramid and defensive validation on critical flows.',
    '4': 'Designs deterministic integration suites, contract tests, and load-sensitive validation.',
    '5': 'Sets quality policy, coverage standards, and automated QA pipelines at organization level.'
  },
  Frontend: {
    '1': 'Rigid layout or inefficient state usage that creates unnecessary re-renders.',
    '2': 'Builds functional UI components but often couples view and business logic.',
    '3': 'Uses clean state management, accessible semantics, and responsive interaction patterns.',
    '4': 'Optimizes Core Web Vitals, UI architecture, and scalable component boundaries.',
    '5': 'Creates design-system standards and high-performance frontend guidance across teams.'
  },
  DevOps: {
    '1': 'Relies on manual deployments, local-only assumptions, or hardcoded runtime values.',
    '2': 'Uses basic Docker or scripts but with fragile configuration or heavy images.',
    '3': 'Builds automated CI/CD, multi-stage images, and structured runtime logs.',
    '4': 'Implements observability, metrics, traces, and proactive alerting.',
    '5': 'Designs IaC, GitOps, and high-availability delivery practices across environments.'
  },
  Collaboration: {
    '1': 'Provides superficial code review comments without technical reasoning.',
    '2': 'Mostly flags syntax or style issues that automation should catch.',
    '3': 'Gives constructive code reviews that identify risks and propose alternatives.',
    '4': 'Leads design reviews, mentoring, ADRs, and structured technical documentation.',
    '5': 'Builds engineering culture, facilitates decisions, and mentors technical leaders.'
  }
};

async function main() {
  console.log('[1/3] Starting TechProfiler database seed...');

  await db.insert(organizations).values([
    { name: 'ueno bank', slug: 'ueno-bank' },
    { name: 'itti Digital', slug: 'itti' },
    { name: 'kaitel Paraguay', slug: 'kaitel' }
  ]).onConflictDoNothing();
  console.log('[1/3] Organizations verified: ueno bank, itti, kaitel.');

  const skillsData = [
    { skillKey: 'CLEAN_ARCHITECTURE', displayName: 'Clean Architecture & SOLID', domain: 'Architecture', description: 'Layer separation, dependency inversion, and low coupling.', rubricLevels: domainRubrics.Architecture },
    { skillKey: 'SYSTEM_DESIGN_RESILIENCE', displayName: 'System Design & Resilience', domain: 'Architecture', description: 'Circuit breakers, exponential retries, and high availability.', rubricLevels: domainRubrics.Architecture },
    { skillKey: 'MICROSERVICES_PATTERNS', displayName: 'Microservices Patterns', domain: 'Architecture', description: 'Event sourcing, CQRS, and asynchronous communication through queues.', rubricLevels: domainRubrics.Architecture },
    { skillKey: 'CONCURRENCY_ASYNC', displayName: 'Concurrency & Async', domain: 'Backend', description: 'Event loop, parallelism, deadlock prevention, and race-condition awareness.', rubricLevels: domainRubrics.Backend },
    { skillKey: 'DATABASE_OPTIMIZATION', displayName: 'Databases & ACID', domain: 'Backend', description: 'Transactions, isolation, B-tree/GIN indexes, and query tuning.', rubricLevels: domainRubrics.Backend },
    { skillKey: 'API_DESIGN_SECURITY', displayName: 'API Design & Security', domain: 'Backend', description: 'REST/gRPC contracts, OAuth2/JWT authentication, and OWASP-aware sanitization.', rubricLevels: domainRubrics.Backend },
    { skillKey: 'TESTING_STRATEGIES', displayName: 'Testing Strategies', domain: 'Quality', description: 'Test pyramid, TDD, mocks, and coverage for critical flows.', rubricLevels: domainRubrics.Quality },
    { skillKey: 'DEFENSIVE_PROGRAMMING', displayName: 'Defensive Programming', domain: 'Quality', description: 'Exhaustive input validation with schemas and explicit error handling.', rubricLevels: domainRubrics.Quality },
    { skillKey: 'CODE_SIMPLICITY', displayName: 'Simplicity & Refactoring', domain: 'Quality', description: 'KISS, DRY, technical debt reduction, and maintainability.', rubricLevels: domainRubrics.Quality },
    { skillKey: 'REACT_STATE_MANAGEMENT', displayName: 'React State Management', domain: 'Frontend', description: 'Advanced hooks, Server Components, context, and render optimization.', rubricLevels: domainRubrics.Frontend },
    { skillKey: 'ACCESSIBILITY_UX', displayName: 'Web Accessibility & UX', domain: 'Frontend', description: 'WCAG standards, semantic HTML, and responsive design.', rubricLevels: domainRubrics.Frontend },
    { skillKey: 'CI_CD_AUTOMATION', displayName: 'CI/CD & Docker Pipelines', domain: 'DevOps', description: 'Multi-stage containers, GitHub Actions, and zero-downtime delivery.', rubricLevels: domainRubrics.DevOps },
    { skillKey: 'OBSERVABILITY_MONITORING', displayName: 'Observability & Telemetry', domain: 'DevOps', description: 'Distributed tracing, metrics, structured logs, and proactive alerts.', rubricLevels: domainRubrics.DevOps },
    { skillKey: 'CODE_REVIEW_PEDAGOGY', displayName: 'Code Review Pedagogy', domain: 'Collaboration', description: 'Constructive feedback, risk detection, and mentoring through review.', rubricLevels: domainRubrics.Collaboration },
    { skillKey: 'TECHNICAL_DOCUMENTATION', displayName: 'Technical Documentation & ADRs', domain: 'Collaboration', description: 'Architectural decision records, C4 diagrams, and maintainable READMEs.', rubricLevels: domainRubrics.Collaboration }
  ];

  await db.insert(skillTaxonomy).values(skillsData).onConflictDoNothing();
  console.log('[2/3] Loaded 15 skills with 1-5 rubrics.');

  const benchmarksData = [
    { track: 'BACKEND_NODE', seniorityLevel: 'JUNIOR_2', skillKey: 'CLEAN_ARCHITECTURE', requiredScore: 2.5 },
    { track: 'BACKEND_NODE', seniorityLevel: 'JUNIOR_2', skillKey: 'CONCURRENCY_ASYNC', requiredScore: 2.5 },
    { track: 'BACKEND_NODE', seniorityLevel: 'JUNIOR_2', skillKey: 'DATABASE_OPTIMIZATION', requiredScore: 2.5 },
    { track: 'BACKEND_NODE', seniorityLevel: 'JUNIOR_2', skillKey: 'TESTING_STRATEGIES', requiredScore: 2.5 },
    { track: 'BACKEND_NODE', seniorityLevel: 'MID_2', skillKey: 'CLEAN_ARCHITECTURE', requiredScore: 3.5 },
    { track: 'BACKEND_NODE', seniorityLevel: 'MID_2', skillKey: 'CONCURRENCY_ASYNC', requiredScore: 3.8 },
    { track: 'BACKEND_NODE', seniorityLevel: 'MID_2', skillKey: 'DATABASE_OPTIMIZATION', requiredScore: 3.6 },
    { track: 'BACKEND_NODE', seniorityLevel: 'MID_2', skillKey: 'TESTING_STRATEGIES', requiredScore: 3.5 },
    { track: 'BACKEND_NODE', seniorityLevel: 'SENIOR_1', skillKey: 'CLEAN_ARCHITECTURE', requiredScore: 4.5 },
    { track: 'BACKEND_NODE', seniorityLevel: 'SENIOR_1', skillKey: 'CONCURRENCY_ASYNC', requiredScore: 4.5 },
    { track: 'BACKEND_NODE', seniorityLevel: 'SENIOR_1', skillKey: 'DATABASE_OPTIMIZATION', requiredScore: 4.3 },
    { track: 'BACKEND_NODE', seniorityLevel: 'SENIOR_1', skillKey: 'TESTING_STRATEGIES', requiredScore: 4.2 }
  ];

  await db.insert(seniorityBenchmarks).values(benchmarksData).onConflictDoNothing();
  console.log('[3/3] Seniority benchmarks initialized.');

  console.log('Seed completed successfully.');
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
