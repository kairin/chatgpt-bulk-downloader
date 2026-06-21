<!--
Sync Impact Report
- Version change: 1.0 → 1.1 (MINOR)
- Modified principles/sections: None renamed. Enhanced "Additional Constraints" (added NFRs bullet) and "Development Workflow & Quality Gates" (added NFR + Dependencies call-outs and explicit plan gate expectations) to better support feature-level specs such as 001-harden-downloader (resilience, non-blocking UX, packaging, MV3 constraints).
- Added sections: "Non-Functional Requirements (NFRs)" guidance (responsiveness/non-blocking on large sets, resilience via retries+validation+partials, name/output safety at scale); "Dependencies and External Factors" subsection (service data sources + best-effort tolerance, browser/MV3 downloads + messaging constraints, CWS/distribution guidelines + assets + review considerations).
- Removed sections: None.
- Templates requiring updates:
  - .specify/templates/plan-template.md (Constitution Check section): ✅ updated (replaced generic placeholder with directive language that gates must be derived from the 5 principles + NFRs + Dependencies/External Factors; added reference to the violations table).
  - .specify/templates/spec-template.md: ✅ compatible (no direct refs; user stories/FRs/NFRs/SCs model is now reinforced).
  - .specify/templates/tasks-template.md: ✅ compatible (user-story organization supports SDD principle III).
  - .specify/extensions/agent-context/commands/speckit.agent-context.update.md: ✅ compatible (illustrative "e.g." list of agent files; project uses AGENTS.md — no hard-coded outdated assumption).
  - .specify/templates/constitution-template.md: ✅ source, no changes.
- Follow-up TODOs: None. All prior placeholders were resolved. Re-run speckit-analyze (or speckit-plan on 001-harden-downloader) to confirm Constitution Check gates in the plan align with the expanded NFR/Dependencies content. AGENTS.md will be auto-refreshed by the after_plan hook once plan.md exists.
-->

# ChatGPT Bulk Downloader Constitution

## Core Principles

### I. Client-Only Privacy & Least Privilege
Every feature and change must preserve the strict client-side, no-exfiltration contract. The extension may only call the exact same authenticated internal endpoints that the ChatGPT web UI itself calls on the user's existing session. No telemetry, no external servers, no storage of user data beyond the explicit local Downloads artifacts the user triggers. Permissions must remain minimal (host_permissions scoped to chatgpt.com, downloads permission only). Any broadening requires explicit justification and is subject to governance review.

### II. Resilience to External UI/API Churn (NON-NEGOTIABLE)
The ChatGPT web UI and its internal APIs can and will change. All collection, scraping, naming, and metadata logic must be built with multiple fallback strategies, observable error reporting, structured partial-result handling, and clear documentation of scope/limitations. "It worked on the snapshot at release" is not acceptable. Detection heuristics, selectors, and response assumptions must be versioned or easily updatable, and the tool must degrade gracefully (still produce useful metadata JSON even when image collection is incomplete).

### III. Spec-Driven Development with Measurable Quality Gates
All material work follows the Spec Kit workflow: specify (user-value focused, testable scenarios) → plan → tasks → implement with review gates. No implementation details leak into specs. Every feature increment must define prioritized, independently testable user stories, functional requirements, measurable success criteria (technology-agnostic), and edge cases. Changes that affect claims in user-facing documentation (README, button behavior, output locations, metadata shape) require corresponding spec and doc updates in the same increment.

### IV. Documentation Accuracy as a First-Class Deliverable
Public claims about what the extension does (features, usage, metadata contents, download locations and fallbacks, privacy, limitations, Cloudflare interaction) must be true at the time of any release or PR that touches behavior. "README will be updated later" is not permitted. When behavior is best-effort, partial, or has known limits (e.g., recent 100 conversations, DOM-dependent discovery for virtualized views), the documentation must say so explicitly.

### V. Minimalism, Observability, and Small Surface Area
The implementation must stay small and auditable (single content script + small background worker when required for platform APIs). Magic numbers, hardcoded assumptions, and complex control flow must be minimized and accompanied by constants + diagnostics. Error states must never strand the UI or swallow information that belongs in the exported JSON or user-visible status. Console logging is for development; production paths surface structured outcomes to the user and the metadata artifact.

## Additional Constraints

- **No data exfiltration or tracking by design**: Confirmed at every review. The only network is same-origin authenticated fetches + the user's own browser download of files they explicitly requested.
- **Manifest V3 purity**: Pure MV3 patterns only. Direct `chrome.downloads` calls from content scripts are not permitted for subfolder organization; platform APIs that require a background context must be used via proper messaging.
- **Icon and store assets**: Must meet official Chrome Web Store sizing, padding, and quality rules before any packaging or submission. Placeholder or undersized icons are forbidden in distributed artifacts.
- **Packaging hygiene**: Release artifacts must never contain .git, .specify tooling, specs/, dev scripts, or other non-runtime files. A repeatable clean packaging step is mandatory for distribution readiness.
- **Unofficial status**: The project must always carry a clear disclaimer that it is not affiliated with OpenAI and that ChatGPT's UI/APIs can change at any time. The tool is best-effort.
- **Non-Functional Requirements (NFRs)**: Every feature spec and plan must explicitly address relevant NFRs derived from the core principles (e.g., non-blocking responsiveness on large result sets, bounded retries + validation for resilience, reliable name/output safety across scale/unicode/repeated runs). These are non-negotiable for hardening and distribution work.

## Dependencies and External Factors

Feature plans and implementation must treat the following as first-class inputs (documented in the spec/plan and checked in Constitution Check gates):
- The ChatGPT service's internal data sources (library directories/nodes, conversations, uploads, etc.) and their best-effort availability, rate limits, response shapes, and authentication model via the user's session.
- Browser extension platform rules (MV3 service worker/background requirements for certain APIs like downloads, permission warnings, subfolder semantics, messaging patterns between content and background).
- Target distribution channel requirements (Chrome Web Store or equivalent): icon specifications, description length, privacy policy statements, store listing assets (screenshots, promo), and review considerations for bulk actions or use of service-internal endpoints.
- User-visible browser behaviors for downloads (collision handling, prompts for multiple files) and extension lifecycle.

## Development Workflow & Quality Gates

- Speckit SDD is the required process for any feature work (see .specify/workflows/speckit).
- Constitution compliance is checked on every PR that touches behavior, docs, or packaging. Use of codacy-preflight (or equivalent) before commits/pushes that affect main or release branches.
- Changes that would make README claims inaccurate, or that re-introduce silent failure modes for metadata/images, require spec updates + reviewer sign-off against the relevant user stories and success criteria.
- For hardening/resilience work, measurable criteria (e.g., "metadata JSON produced on 100% of activations even on partial failure", "subfolder delivered when platform API available", non-blocking behavior on 200+ item sets) are non-negotiable.
- The AGENTS.md file must always point to a current concrete plan (via the agent-context extension) so that future agents and humans have the right context.
- Plans must include a "Constitution Check" section (per plan-template) that explicitly gates on the principles above before research/design proceeds, with a violations table if any complexity is justified against them.

## Governance

This constitution supersedes ad-hoc development practices. Amendments require an update to this file, a note in the relevant spec or plan, and agreement from maintainers. The spirit is "make the documented experience real and keep it trustworthy as the external site evolves."

When in doubt, prefer:
- More visible partial results + clear limitations over silent "best effort".
- Smaller, auditable changes over clever one-liners.
- Updating docs and specs together with code.

**Version**: 1.1 | **Ratified**: 2026-06-22 | **Last Amended**: 2026-06-22
