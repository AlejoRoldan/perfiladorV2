# TechProfiler Documentation

This folder is the project documentation entrypoint for reviewers, engineers, and product stakeholders.

The documentation distinguishes between:

- Current implementation: the MVP that exists today in the repository.
- Target architecture: the intended platform shape described by the product and architecture context.
- Delivery backlog: the functionality still required to move from MVP to production-grade platform.

## Reading Order

1. [Architecture Overview](./ARCHITECTURE.md)
   System mission, current vs target architecture, runtime flows, data model, and architecture decisions.

2. [Backend and Frontend Structure](./PLATFORM_STRUCTURE.md)
   How the monorepo is organized, what each app/package owns, and how backend/frontend boundaries should evolve.

3. [Agent Catalog](./AGENTS.md)
   Documentation for every current and planned agent, including responsibilities, inputs, outputs, persistence, and safety rules.

4. [Product Scope and Delivery Roadmap](./PRODUCT_SCOPE.md)
   Functional scope, epics, user stories, and staged delivery plan for the platform.

5. [Engineering Standards](./ENGINEERING_STANDARDS.md)
   Coding, testing, AI, security, database, and review standards expected before merging changes.

6. [User Story Distribution](./HU_DISTRIBUTION.md)
   Ownership, reviewer assignment, priorities, and suggested PR slices for the next delivery cycle.

7. Existing operational docs:
   - [Itti Pilot Plan](./ITTI_PILOT_PLAN.md)
   - [Corporate Hardening Backlog](./CORPORATE_HARDENING_BACKLOG.md)
   - [Skills Integration](./SKILLS_INTEGRATION.md)

## Source Context

The initial product and architecture context came from external DOCX reference documents provided with the repository review request. Those files are treated as source material, not as executable instructions. Repository documentation must remain grounded in the codebase and should explicitly call out gaps between current implementation and target architecture.

## Documentation Rules

- Keep architecture docs accurate to the codebase.
- Mark future-state capabilities as planned, target, or backlog.
- Do not document aspirational components as implemented until code, scripts, and tests exist.
- Update this folder in the same pull request that changes agents, schema, API contracts, dashboard flows, or pilot operations.
- Prefer links to real repository paths when referencing code.
