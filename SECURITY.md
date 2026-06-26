# Security Policy

## Supported Versions

Only the latest release on `main` is actively supported with security updates. Previous release tags are not backported unless a critical vulnerability is found.

| Version | Supported          |
|---------|--------------------|
| Latest on `main` | :white_check_mark: |
| Older tags       | :x:                |

## Reporting a Vulnerability

**Please do not open public issues for security bugs.**

Report vulnerabilities privately to the maintainers at **[INSERT SECURITY EMAIL]**. Include:

- A description of the vulnerability.
- Steps to reproduce (or a proof of concept, if one is safe to share).
- The affected version or commit SHA.
- Any suggested mitigation, if you have one.

### What to expect

| Step                     | Timeline                            |
|--------------------------|-------------------------------------|
| Acknowledgment           | Within **48 hours** of receipt      |
| Initial assessment       | Within **7 days**                   |
| Fix or mitigation plan   | Within **90 days** of acknowledgment |

We coordinate disclosure with you before any public announcement. If you have a preferred disclosure timeline or need, tell us in the report and we will accommodate it where possible.

## Scope

In scope for this policy:

- The application code in `apps/`, `packages/`, and `tooling/`.
- CI/CD workflows in `.github/workflows/`.
- Any secrets, tokens, or credentials referenced in the repository.

Out of scope:

- Issues already reported or publicly known (we will confirm when you report).
- Social engineering attacks against maintainers or infrastructure operators.
- Attacks requiring physical access to a user's device.
- Third-party services we integrate with — report those directly to the vendor:
  - **Stripe:** https://stripe.com/docs/security/stripe-security/contact
  - **Cloudflare:** https://www.cloudflare.com/disclosure/
  - **Upstash:** https://upstash.com/contact
  - **Neon (Postgres):** https://neon.tech/docs/security
  - **Vercel:** https://vercel.com/security

## Security posture

This project follows defense-in-depth practices appropriate to its stage:

- **Dependencies:** kept up to date; CI runs `pnpm install --frozen-lockfile` to prevent unaudited changes.
- **Secrets:** never stored in code. Local development uses `.env.local` (gitignored); CI uses GitHub Actions secrets.
- **Authentication:** Auth.js v5 with secure session handling; OAuth credentials stored only in environment variables.
- **Payments:** Stripe handles card data — the application never touches raw payment details.
- **Video:** Cloudflare Stream signed URLs with short-lived tokens.
- **Input validation:** all user input is validated at the API boundary (Zod or equivalent).
- **Headers:** security headers (CSP, HSTS, X-Content-Type-Options, etc.) are set at the edge (Vercel + Cloudflare).

## Responsible disclosure

We consider security research conducted in good faith — within the scope above and without destruction or privacy violation — to be welcomed activity, not abuse. We will not take legal action against researchers who:

1. Report vulnerabilities privately via the channel above.
2. Do not access, modify, or delete data belonging to other users.
3. Do not degrade service for other users.
4. Provide us reasonable time to address the issue before any public disclosure.

## Changelog

Security fixes are noted in [CHANGELOG.md](CHANGELOG.md) under the `Security` section once disclosed.
