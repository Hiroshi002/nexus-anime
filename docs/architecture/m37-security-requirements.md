# M3.7 — Security Requirements

> **Scope:** เอกสารนี้กำหนดมาตรฐานความปลอดภัยทั้งหมดสำหรับ Nexus Anime ภายใต้ Milestone 3 — ครอบคลุม Password Policy, OAuth Security, CSRF Protection, XSS Protection, Rate Limiting, Brute Force Protection, Session Security, และ Cookie Policy โดยเป็นเจ้าของเดี่ยวเหนือ M2.7 / M3.3 / M3.4 / M3.5 ในหัวข้อที่เหล่านั้นกำหนดไว้

> **Status:** Draft — Pending Review
> **Date:** 2026-06-25
> **Author:** Tech Lead (Hiroshi002)
> **Milestone:** M3 (Sprints 5–6)
> **OWASP Target:** ASVS Level 1 (baseline secure-by-default — startup MVP posture)

---

## Table of Contents

1. [Scope & Scope Decisions](#1-scope--scope-decisions)
2. [Password Policy](#2-password-policy)
3. [OAuth Security](#3-oauth-security)
4. [CSRF Protection](#4-csrf-protection)
5. [XSS Protection](#5-xss-protection)
6. [Rate Limiting](#6-rate-limiting)
7. [Brute Force Protection](#7-brute-force-protection)
8. [Session Security](#8-session-security)
9. [Cookie Policy](#9-cookie-policy)
10. [Security Headers](#10-security-headers)
11. [Database Schema Additions](#11-database-schema-additions)
12. [Environment Variables](#12-environment-variables)
13. [Security Test Surface](#13-security-test-surface)
14. [Ownership Matrix](#14-ownership-matrix)
15. [Sprint Deliverables](#15-sprint-deliverables)

---

## 1. Scope & Scope Decisions

### 1.1 In scope (owned แหลกของ M3.7)

| # | หัวข้อ | คำอธิบาย |
|---|--------|----------|
| 1 | Password Policy | กำหนดความเข้มแข็ง, validation schema (zxcvbn score ≥ 2 + HIBP k-anomaly), ห้ามรหัสผ่านที่รั่วไหล |
| 2 | OAuth Security | state/nonce, scope ขั้นต่ำ, redirect URI allowlist, ห้าม wildcard, account linking แบบ verify-owner email |
| 3 | CSRF Protection | Origin allowlist check + custom CSRF token สำหรับ non-Auth.js forms (โครงสร้างหลัก owned โดย M2.7 §7.1 — M3.7 เพิ่ม constraints) |
| 4 | XSS Protection | output encoding ฝั่ง server, CSP script-src 'self', React escape อัตโนมัติ, ห้าม `dangerouslySetInnerHTML` / `eval()` |
| 5 | Rate Limiting | เพิ่ม per-route auth tier (login 5/5min, register 3/5min, forgot-password 3/10min) เหนือ M2.7 §7.3 baseline |
| 6 | Brute Force Protection | account lockout นาน 15 นาทีหลัง 5 ครั้งผิด, exponential backoff ต่อรอบ, global IP limit, login_attempts + brute_force_lockouts tables |
| 7 | Session Security | concurrent session limit (5 devices, LIFO eviction), admin force-logout endpoint, user_sessions table |
| 8 | Audit Events | ตาราง `audit_events` เก็บทุก security event, เขียน async ผ่าน Redis list แล้ว flush เป็น batch |
| 9 | Security Headers | CSP / HSTS / X-Frame-Options / Referrer-Policy / Permissions-Policy / X-Content-Type-Options ทั้งใน middleware และ `next.config.ts` |
| 10 | Cookie Policy | `__Host-` prefix, Secure / HttpOnly / SameSite=Lax, Path=/, no Domain, ไม่ prefix `NEXT_PUBLIC_` ใด ๆ |

### 1.2 Out of scope (owned by other docs — M3.7 อ้างอิงเป็นหลักฐานเท่านั้น)

| Concern | Owner | Document | ส่วนที่ |
|---------|-------|----------|--------|
| Auth flows (sign-up, login, password reset) | M2.7 | [authentication-architecture.md](authentication-architecture.md) | §3 |
| JWT claims structure & versioning | M3.3 | [session-strategy.md](session-strategy.md) | §2 |
| Token rolling refresh & Remember Me TTL | M3.3 | [session-strategy.md](session-strategy.md) | §3–§5 |
| Device tracking & fingerprinting | M3.3 | [session-strategy.md](session-strategy.md) | §6 |
| Token revocation (JTI blacklist) | M3.3 | [session-strategy.md](session-strategy.md) | §8 |
| OAuth provider selection (Google / Discord) | M3.4 | [oauth-strategy.md](oauth-strategy.md) | §2 |
| OAuth callback & account linking flow | M3.4 | [oauth-strategy.md](oauth-strategy.md) | §4–§5 |
| Role hierarchy & permission matrix | M3.5 | [m35-rbac-and-permission-strategy.md](m35-rbac-and-permission-strategy.md) | §2–§3 |
| Route → permission guard mapping | M3.5 | [m35-rbac-and-permission-strategy.md](m35-rbac-and-permission-strategy.md) | §6 |

### 1.3 Cross-references — ความสัมพันธ์แบบ authoritative + diff

เอกสารนี้ **re-statement เฉพาะในหัวข้อที่ M3.7 เป็นเจ้าของ** (ด้านบน §1.1) ส่วนหัวข้อที่เป็นเจ้าของโดย doc อื่น M3.7 จะใส่ pointer ดังทั้ง doc + section แล้วเพิ่ม constraint เฉพาะที่เพิ่มขึ้นเท่านั้น เช่น "นอกเหนือจาก §X.Y แล้ว M3.7 เพิ่มเติม…"

---

## 2. Password Policy

### 2.1 ข้อกำหนด (Requirements)

| ID | Requirement |
|----|-------------|
| PW-01 | ความยาวขั้นต่ำ 8 ตัวอักษร (แนะนำ 12+) |
| PW-02 | รองรับ Unicode ทั้งหมด (ภาษาญี่ปุ่น, ไทย, emoji ลงได้) |
| PW-03 | ห้ามใช้รหัสผ่านที่อยู่ใน common-password blocklist อย่างน้อย 10,000 หัว (ดาวน์โหลด static list) หรือ HaveIBeenPwned k-anomaly ผ่าน range API |
| PW-04 | ห้ามรหัสผ่านที่ identical กับ email / username |
| PW-05 | ห้ามรหัสผ่านที่ประกอบด้วยตัวเลขหรือตัวอักษรซ้ำล้วน (เช่น `aaaaaaaa`, `12345678`) |
| PW-06 | หมุนเวียนรหัสผ่านเฉพาะเมื่อมีข้อมูลรั่วไหล (no forced periodic rotation ตาม NIST SP 800-63B) |
| PW-07 | รหัสผ่านถูก hash ด้วย bcrypt 12 rounds ก่อนเข้าในข้อมูล (หลีกเลี่ยง argon2id ใน MVP — dependency หนักกับ Vercel Edge) |

### 2.2 Strength gate

ใช้ `zxcvbn` library ประเมิน entropy ฝั่ง client + server:

| Action | zxcvbn score (0–4) | Treatment |
|--------|-------------------|-----------|
| register | ≤ 1 | Block — force retry |
| register | 2 | Accept แต่แสดง warning "รหัสผ่านอ่อน ลองเพิ่มอักขระไม่คาดเดา" |
| register | ≥ 3 | Accept |

Library: `@zxcvbn-ts/core` (tree-shakable, ~6KB gzipped).

### 2.3 Schema (Zod — `packages/validation/src/auth.ts`)

```typescript
// packages/validation/src/auth.ts
import { z } from "zod";
import { zxcvbn } from "@zxcvbn-ts/core";
import zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import zxcvbnEnPackage from "@zxcvbn-ts/language-en";

const zxcvbnOptions = {
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
};

const COMMON_PASSWORDS = new Set<string>(
  require("./blocklists/top10k.json") as string[], // static top-10k list bundled at build
);

function checkPassword(password: string, context: { email?: string; username?: string }) {
  if (COMMON_PASSWORDS.has(password)) {
    return "รหัสผ่านนี้ถูกใช้บ่อยมาก ลองรหัสผ่านอื่น";
  }
  if (context.email && password.toLowerCase().includes(context.email.split("@")[0].toLowerCase())) {
    return "รหัสผ่านไม่สามารถมี email ของคุณได้";
  }
  const result = zxcvbn(password, zxcvbnOptions);
  if (result.score < 2) {
    return result.feedback.warning || "รหัสผ่านอ่อนเกินไป";
  }
  return null;
}

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8, "รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร")
    .max(128, "รหัสผ่านยาวเกินไป")
    .superRefine((val, ctx) => {
      const err = checkPassword(val, { email: ctx.parent.email });
      if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
    }),
  username: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[\p{L}\p{N}_-]+$/u, "ตัวอักษร ตัวเลข _ - เท่านั้น"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1), // no min-length guard — ทำให้ brute-force ป้องกันด้วย §7 แทน
  rememberMe: z.boolean().optional().default(false),
});
```

### 2.4 HaveIBeenPwned k-anomaly (ทางเลือกใช้แทน static list)

- Library: `hibp` (~8KB)
- ใช้ k-anomaly mode — ส่ง SHA-1 prefix 5 ตัวแรก → รับ suffix list → match local
- เรียกภายใน `auth.register` service method **ก่อน** bcrypt hash เพื่อให้ผู้ใช้ได้รับ feedback ทันที (hash ช้า → UX แย่ถ้ารอไป hash ก่อนแล้วค่อย reject)
- Timeout = 800ms ถ้า fails → fallback ไปใช้ static blocklist อย่างเดียว

---

## 3. OAuth Security

> โดยรวม OAuth flows (Google / Discord provider selection, callback logic) ถูกกำหนดโดย M3.4 แล้ว ส่วนนี้เป็น **constraint เพิ่มเติม** ที่ M3.7 เพิ่มขึ้นเพื่อให้ ASVS L1 ผ่าน

### 3.1 State & PKCE (เพิ่มเติมเหนือ M3.4 §3)

- ทุก provider ต้องส่ง `state` parameter ( Auth.js v5 ทำให้อัตโนมัติถ้า provider รองรับ)
- ถ้าเพิ่ม OAuth provider ใหม่ด้วยตนเอง → ต้องรองรับ PKCE เสมอ
- Session cookie ที่ถูกใช้ระหว่าง OAuth handshake ต้อง expire ภายใน 10 นาที

### 3.2 Redirect URI allowlist

- ระบบต้อง reject URL ที่อยู่นอก allowlist ทั้ง redirect URI และ post-login callback
- Allowlist เก็บใน env `OAUTH_ALLOWED_REDIRECT_URIS` (comma-separated)
- ในสภาพแวดล้อม production ต้องขึ้นต้นด้วย `https://` เท่านั้น

### 3.3 Scope ขั้นต่ำ (เพิ่มเติมเหนือ M3.4 §2.2)

| Provider | M3.4 กำหนดไว้ | M3.7 บังคับ |
|----------|--------------|------------|
| Google | `openid email profile` | **อย่างน้อย** `email` — ให้ `profile` เป็น optional |
| Discord | `identify email` | **อย่างน้อย** `identify` — ให้ `email` เป็น optional ถ้าจำเป็น |

**Why:** OWASP ASVS 4.1.2 — ลด damage ถ้า token รั่ว

### 3.4 Account linking — verify-owner

เมื่อผู้ใช้พยายาม link OAuth identity ใหม่กับบัญชีที่มีอยู่แล้ว:
- ต้อง verify ว่าผู้ใช้ logged-in อยู่แล้ว (session ถูกต้อง)
- verify ว่า OAuth email ตรงกับ account email เดิม — **หรือ** ถ้า OAuth provider ไม่ return email (rare) → ต้อง verify ด้วย TOTP challenge
- ถ้าไม่ตรง → สร้างบัญชีใหม่ (ไม่ auto-link โดยปริยาย)

### 3.5 OAuth-only account recovery

ถ้าผู้ใช้ไม่มี credentials (สมัครผ่าน OAuth เท่านั้น):
- ห้าม trigger password reset
- ให้เลือก "unlink" provider เดิม → verify ด้วย email OTP ก่อน → ค่อย unlink
- log event `oauth_unlink` ใน audit_events

---

## 4. CSRF Protection

> โดยรวม flow ถูกกำหนดโดย M2.7 §7.1 แล้ว — M3.7 เพิ่ม constraints เฉพาะ

### 4.1 เลเยอร์ (layered)

1. **SameSite=Lax cookie** — ป้องกัน cross-origin subrequest
2. **Auth.js built-in CSRF token** — double-submit cookie pattern (`__Host-next-auth.csrf-token`)
3. **`__Host-` prefix** — ผูก cookie กับ host ไม่มี subdomain leakage
4. **Origin header check** — ตรวจสอบ `Origin` ใน middleware ว่าตรงกับ expected origin ตาม §4.2
5. **Custom CSRF token สำหรับ non-Auth.js forms** — สำหรับ forms ที่ไม่ได้ submit ผ่าน Auth.js เช่น admin panel

### 4.2 Origin allowlist

```typescript
// packages/auth/src/constants.ts
export const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim()),
);
```

Middleware ทำ origin check สำหรับ POST/PUT/PATCH/DELETE requests เท่านั้น — GET/HEAD ไม่ต้อง (safe methods)

### 4.3 ทดสอบ

ทุก test case ที่เป็น mutation ต้อง verify ว่า:
- request ที่ไม่มี CSRF token → 403
- request ที่มี CSRF token ผิด → 403
- request ที่มี origin ผิด → 403

---

## 5. XSS Protection

> **อ้างอิง** React XSS ระดับ component — React's default escape ปกป้อง 95% แล้ว M3.7 เพิ่ม server-side guard

### 5.1 Server-side output encoding

ห้าม render user-controlled string ลง HTML stream โดยไม่ encode:
- ใช้ React escape เป็นหลัก — **ห้ามใช้ `dangerouslySetInnerHTML` เด็ดขาด** ถ้าไม่จำเป็น
- ถ้าจำเป็น (เช่น user-generated review ที่ allow แท็กบางตัว) → ใช้ DOMPurify ที่มีลักษณะ strict allowlist

```typescript
// packages/validation/src/sanitize.ts
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const purify = DOMPurify(window as unknown as Window);
purify.setConfig({
  ALLOWED_TAGS: ["b","i","em","strong","br","p","ul","ol","li","a"],
  ALLOWED_ATTR: ["href","target","rel"],
});

export function sanitizeHTML(dirty: string): string {
  return purify.sanitize(dirty, { USE_PROFILES: { html: true } });
}
```

### 5.2 CSP สำหรับ script (ดู §10)

`script-src 'self'` — ห้าม inline script และ `eval()` ทุกรูปแบบ. ถ้าจำเป็นต้องมี inline script → ใช้ CSP hash หรือ nonce (สามารถเพิ่มใน Sprint หลังได้)

### 5.3 Referrer-Policy

ดู §10 — ตั้งค่า `strict-origin-when-cross-origin` เพื่อไม่ leak referral URL ไปภายนอก

### 5.4 ห้าม patterns ใน code review

```tsx
// ❌ BAN
<div dangerouslySetInnerHTML={{ __html: user.bio }} />
<div onClick={`alert(${user.id})`}></div>
<script>console.log({{ userData }})</script>

// ✅ ใช้
<div>{user.bio}</div>
<div onClick={() => alert(user.id)}></div>
```

---

## 6. Rate Limiting

> โดยรวม strategy + limit tiers ถูกกำหนดโดย M2.7 §7.3 แล้ว — M3.7 เพิ่ม enforcement details และ headers

### 6.1 ระดับ (tiers)

| Endpoint Pattern | Limit / Window | Identifier | Owner |
|-----------------|---------------|------------|-------|
| `/api/v1/*` | 100 req / 15 min | IP address | M2.7 §7.3 |
| `/api/v1/admin/*` | 30 req / 15 min | IP address | M2.7 §7.3 |
| `/api/auth/*` | 20 req / 15 min | IP address | §7.1 brute-force ช่วยป้องกันอีกชั้น |
| **POST /api/auth/login** | **5 req / 5 min** | IP + email composite | **M3.7 เพิ่ม** |
| **POST /api/auth/register** | **3 req / 5 min** | IP | **M3.7 เพิ่ม** |
| **POST /api/auth/forgot-password** | **3 req / 10 min** | IP + email | **M3.7 เพิ่ม** |
| `/api/v1/nexus/*` | 200 req / 15 min | user ID (authed) | M2.7 §7.3 |
| `/api/v1/webhooks/*` | ไม่จำกัด | — | verify ด้วย Stripe signature แทน |

### 6.2 Response headers

ทุg 4XX response ต้องแสดง headers:

| Header | Example | Meaning |
|--------|---------|---------|
| `X-RateLimit-Limit` | `100` | max |
| `X-RateLimit-Remaining` | `87` | left in current window |
| `X-RateLimit-Reset` | `1752710400` | unix timestamp ที่ window reset |
| `Retry-After` | `90` | เฉพาะ 429 — วินาทีรอ |

### 6.3 Implementation sketch (ดูรายละเอียดใน implementation plan)

- Library: `@upstash/ratelimit` ผ่าน `@nexus/cache` package
- Identifier: ถ้า user authed → `userId`, ถ้าไม่ → IP
- 429 response ใช้ API envelope เดียวกับทั้งระบบ ดู `apps/web/lib/api/envelope.ts`

---

## 7. Brute Force Protection

> **เป็นหัวข้อใหม่ทั้งหมดของ M3.7** — doc อื่นไม่ได้เป็นเจ้าของเรื่องนี้

### 7.1 Account lockout policy

| Attempt | Action |
|---------|--------|
| 1–4 failed | ไม่ทำอะไร — log ปกติ |
| 5 failed (ใน 15 นาที) | Lock account 15 นาทิ — ตอบ 423 Locked + error `ACCOUNT_LOCKED` |
| รหัส lock แล้วลองอีก | Exponential backoff: `attempt^1.5 × 10` วินาที รอ |
| unlock แล้ว | Timeout reset กลับเป็น 0 |

```json
{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "บัญชีถูกล็อกชั่วคราวเนื่องจากเข้าสู่ระบบผิดหลายครั้ง ลองอีกครั้งใน 15 นาที",
    "details": [
      { "field": "email", "message": "locked_until: 2026-06-25T10:45:00Z" }
    ]
  }
}
```

### 7.2 Brute-force ระดับ IP (นอกเหนือจาก account lockout)

- ถ้า IP เดียวมี failed login มากกว่า 50 ครั้งในช่วง 15 นาที (หลาย accounts ต่าง ๆ) → block IP ผ่าน Upstash Redis เป็นเวลา 1 ชั่วโมง
- ถ้า distributed attack (หลาย IP ต่าง ๆ มาจาก pattern เดียว) → ยังถูกจำกัดด้วย `/api/auth/*` 20 req/15min ที่ §6.1

### 7.3 Audit logging สำหรับ brute force (ดู §11)

ทุg lockout trigger ต้อง log event `brute_force_lockout` ด้วยข้อมูล:
- userId (ถ้า known)
- email attempted
- IP
- userAgent
- attempts count

### 7.4 หน้า UI ที่ lock

ส่ง email "เราตรวจพบความพยายามเข้าสู่ระบบที่ผิดหลายครั้ง" ไปที่ user ทุกครั้งที่ lock เกิดขึ้น (ใช้ Resend API ที่ถูกกำหนดใน M2.7 §8)

---

## 8. Session Security

> โดยรวม flow ถูกกำหนดโดย M3.3 แล้ว — M3.7 เพิ่ม constraints เฉพาะ

### 8.1 Token storage

- JWT ใน **HTTP-only, Secure, SameSite=Lax cookie** เท่านั้น — **ไม่** เก็บใน localStorage หรือ JS-accessible cookie (ป้องกัน XSS-based token theft)
- Cookie: `__Host-nexus-session` ตาม M2.7 §2.1
- Session decode ได้เฉพาะผ่าน `@nexus/auth/session` API

### 8.2 Validation guard (เพิ่มเติมเหนือ M3.น `packages/auth/src/guards.ts` — guard ทุก route ที่เข้าถึงด้วย session ต้อง:
- เรียก `requireAuth()` โหลด session + เช็ค `iat` อยู่ใน absolute-max window ไม่
- ถ้า absent → 401 + error `UNAUTHENTICATED`
- ถ้า expired → 401 + error `SESSION_EXPIRED`

### 8.3 Concurrent session limits (เพิ่มเติมเหนือ M3.3)

- ผู้ใช้เดียวสามารถมี active sessions ได้ 5 devices (config: `MAX_CONCURRENT_SESSIONS`)
- ถ้า > 5 → ลด้านที่เก่าที่สุด (LIFO) ถูก revoke อัตโนมัติ
- แสดง active session list ใน `/settings/sessions` ให้ user revoke รายตัวได้

### 8.4 Session cleanup (mobile, public computers)

- ถ้า browser ปิด → session ไม่หมดอายุทันที (คือ JWT บน cookie หมดอายุตามวันที่กำหนด)
- "ล็อกเอาท์จากทุกอุปกรณ์" → revoke ทุก JTI ของ user ผ่าน M3.3 §8 อัตโนมัติ

### 8.5 Admin force-logout endpoint (เพิ่มใหม่)

```
POST /api/v1/admin/users/:userId/revoke-sessions
Authorization: requireRole('admin')   // ดู M3.5 §5
Body: { "reason": "..." }            // audit-purpose
```

ลบ priorietize ไว้ใน implementation plan Sprint 5

---

## 9. Cookie Policy

### 9.1 รายการ cookies ทั้งหมด

| Cookie | Flags | TTL | Purpose |
|--------|-------|-----|---------|
| `__Host-nexus-session` | HttpOnly, Secure, SameSite=Lax, Path=/ | 7 days (30 ถ้า Remember Me) | Session JWT |
| `__Host-next-auth.csrf-token` | HttpOnly=False, Secure, SameSite=Lax, Path=/ | session | CSRF double-submit |
| `__Host-nexus-remember-me` | HttpOnly, Secure, SameSite=Lax, Path=/ | 30 days | Remember Me token |
| `nexus_consent` | HttpOnly=False, Secure, SameSite=Lax, Path=/ | 1 year | GDPR consent |
| `nexus_theme` | HttpOnly=False, Secure, SameSite=Lax, Path=/ | 1 year | theme pref |

**หมายเหตุ:** ทุก cookie ถูก prefix ด้วย `__Host-` (ยกเว้น `nexus_consent`, `nexus_theme` — ไม่ใช่ auth-sensitive) ตาม [RFC 6265bis](https://datatracker.ietf.org/doc/html/draft-rfc6265bis-endpoint-latest)

### 9.2 Consent

- ถ้า cookie ไม่ใช่ strictly necessary (session, csrf) → **ไม่ต้อง** consent
- `nexus_theme`, `nexus_consent` ไม่ใช่ strictly necessary → ต้องมี cookie banner แสดงก่อน set
- Cookie banner component อยู่ที่ `packages/ui/src/components/cookie-banner.tsx`

### 9.3 Third-party cookies

Third-party cookies ถูกบล็อกโดย policy:
- ไม่มี Facebook/Twitter tracking pixel
- มี embedded third-party content นอกเหนือจาก CDN (Cloudflare Stream iframe ถูก sandbox ด้วย CSP `frame-src 'self'`)
- `Referrer-Policy: strict-origin-when-cross-origin` ทำให้พารามิเตอร์ URL ไม่รั่ว

---

## 10. Security Headers

> เพิ่มเติมเหนือ M2.7 §8.3 — เพิ่ม `Strict-Transport-Security` และ enforce ทั้งใน middleware และ next.config.ts

### 10.1 Headers ที่ต้องมี

| Header | Value | Layer |
|--------|-------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | middleware, next.config.ts |
| `Content-Security-Policy` | (ด้านล่าง) | middleware |
| `X-Content-Type-Options` | `nosniff` | middleware |
| `X-Frame-Options` | `DENY` | middleware |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | middleware |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self)` | middleware |
| `X-Powered-By` | (removed) | next.config.ts |
| `X-DNS-Prefetch-Control` | `off` | middleware |

### 10.2 CSP string

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://cdn.nexusanime.com https://img.nexusanime.com;
font-src 'self' data:;
connect-src 'self';
frame-src 'self' https://player.cloudflare.stream;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

**หมายเหตุ:** `'unsafe-inline'` ใน `style-src` จำเป็นสำหรับ Tailwind CSS (สร้าง inline `<style>` blocks) — จะลบออกเมื่อ migrate ไปยัง CSS Modules / styled-components (Sprint หลัง)

### 10.3 แหล่งที่มาของ headers (defense in depth)

**ชั้นที่ 1:** Cloudflare (reverse proxy)
- ตั้งค่า Page Rules หรือ Transform Rules สำหรับ HSTS header
- ใช้ Cloudflare Managed Ruleset สำหรับ OWASP WAF

**ชั้นที่ 2:** Vercel Edge (Next.js config)
- `next.config.ts` ตั้งค่า `headers()` async function สำหรับ CSP, HSTS, Permissions-Policy

**ชั้นที่ 3:** Next.js middleware (apps/web/middleware.ts)
- Set ทุg headers ที่ตามมาทั้งหมด — เป็น last-line of defense

### 10.4 การทดสอบ

Security headers ถูกทดสอบด้วย:
- `https://securityheaders.com/` → ต้องได้ grade A+ อย่างน้อย
- `https://observatory.mozilla.org/` → ต้องได้ score ≥ 90

---

## 11. Database Schema Additions

> 💡 Schema ส่วนใหม่ทั้งหมดของ M3.7 — doc อื่นไม่ได้เป็นเจ้าของ

### 11.1 `login_attempts`

```sql
CREATE TABLE login_attempts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,   -- nullable ถ้า user_id ยังไม่รู้ตอน brute-force ระดับ email
    email           varchar(255) NOT NULL,
    ip_address      inet NOT NULL,
    user_agent      text,
    success         boolean NOT NULL,
    failure_reason  varchar(100),   -- 'bad_password', 'account_locked', 'mfa_failed'
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_email_time ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip_address, created_at DESC);

-- partition แยกเดือนเพื่อ query เร็ว — ใช้ pg_partman ถ้ามี, ไม่งั้น cron cleanup ทุก 90 วัน
SELECT create_parent('public.login_attempts', 'created_at', 'native', 'monthly');
```

### 11.2 `brute_force_lockouts`

```sql
CREATE TABLE brute_force_lockouts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
    email           varchar(255) NOT NULL,
    ip_address      inet NOT NULL,
    locked_at       timestamptz NOT NULL DEFAULT now(),
    locked_until    timestamptz NOT NULL,
    unlock_reason   varchar(50),    -- 'auto_expired', 'admin_override', 'email_verified'
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brute_force_lockouts_user ON brute_force_lockouts(user_id, locked_at DESC);
CREATE INDEX idx_brute_force_lockouts_email ON brute_force_lockouts(email, locked_at DESC);
CREATE INDEX idx_brute_force_lockouts_expiry ON brute_force_lockouts(locked_until) WHERE unlock_reason IS NULL;
```

### 11.3 `audit_events` (universal security event log)

```sql
CREATE TABLE audit_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
    ip_address      inet,
    user_agent      text,
    event_type      varchar(100) NOT NULL,       -- 'login_success', 'brute_force_lockout', 'password_change', 'oauth_link', 'session_revoke', 'permission_change', ...
    payload         jsonb,                        -- event-specific metadata
    created_at      timestamptz NOT NULL DEFAULT now(),
    request_id      uuid                          -- correlation ID จาก API envelope
);

CREATE INDEX idx_audit_events_user_time ON audit_events(user_id, created_at DESC);
CREATE INDEX idx_audit_events_type_time ON audit_events(event_type, created_at DESC);
CREATE INDEX idx_audit_events_request ON audit_events(request_id);
CREATE INDEX idx_audit_events_payload ON audit_events USING GIN(payload);

-- Retention: 1 ปี สำหรับ event_type ที่เกี่ยวกับ RBAC มากกว่าเดือนนี้
--           90 วัน สำหรับ auth event อื่น ๆ
--           30 วัน สำหรับเหตุการณ์พื้นฐาน (login_success จำนวนมาก)
```

### 11.4 `user_sessions` (current active view — denormalized read model)

```sql
CREATE TABLE user_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti             varchar(255) NOT NULL UNIQUE,       -- JWT ID สำหรับ revocation lookup
    device_label    varchar(255),                       -- "Chrome on macOS • กรุงเทพฯ"
    ip_address      inet,
    last_active_at  timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL,
    is_revoked      boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id, last_active_at DESC);
CREATE INDEX idx_user_sessions_jti ON user_sessions(jti);
CREATE INDEX idx_user_sessions_expiry ON user_sessions(expires_at) WHERE NOT is_revoked;
```

**Note:** เป็น read model สำหรับ `/settings/sessions` UI และตรวจ concurrent session limit — M3.3 §6 `user_device_sessions` ยังคงอยู่เป็น device-level tracking

---

## 12. Environment Variables

เพิ่มใน `apps/web/lib/env.ts` และ `.env.example` ภายใต้ comment `# ── Security (M3.7) ───`

```bash
# ── Security (M3.7) ──────────────────────────────────
ALLOWED_ORIGINS=http://localhost:3000     # comma-separated — production: https://nexusanime.com,https://www.nexusanime.com
SESSION_ABSOLUTE_MAX_DAYS=7
SESSION_REMEMBER_ME_DAYS=30
MAX_CONCURRENT_SESSIONS=5
ZXCVBN_THRESHOLD=2
HIBP_ENABLED=0                           # 1 = เปิด HaveIBeenPwned check; 0 = ใช้ static blocklist อย่างเดียว (fallback เมื่อ HIBP_ENABLED=1 แล้ว timeout 800ms ก็ใช้ static list เช่นกัน)
```

### 12.1 Validation schema (Zod ใน packages/auth/src/constants.ts)

```typescript
export const securityEnvSchema = z.object({
  ALLOWED_ORIGINS: z.string().min(1),
  SESSION_ABSOLUTE_MAX_DAYS: z.coerce.number().int().positive().max(90),
  SESSION_REMEMBER_ME_DAYS: z.coerce.number().int().positive().max(90),
  MAX_CONCURRENT_SESSIONS: z.coerce.number().int().positive().max(20),
  ZXCVBN_THRESHOLD: z.coerce.number().int().min(0).max(4),
  HIBP_ENABLED: z
    .enum(["0", "1"])
    .transform((v) => v === "1"),
});
```

---

## 13. Security Test Surface

### 13.1 Unit tests (`packages/auth/src/**/*.test.ts`)

- Password validation: valid / too-short / common-password / identical-to-email / insufficient-zxcvbn-score
- Rate limiter: under-limit / over-limit / window-reset
- Audit event writer: payload shape, jsonb serialization

### 13.2 Integration tests (`apps/web/__tests__/api/security.test.ts`)

- 401 on protected route โดยไม่มี session
- 403 on CSRF-missing mutation
- 429 on rate endpoint
- 423 on locked account login attempt
- Audit event inserted on login success / failure / lockout

### 13.3 E2E / Manual checklist (OWASP ASVS L1)

- [ ] Password field ไม่แสดงใน DOM inspector
- [ ] Cookie flags ถูกต้อง (HttpOnly, Secure, SameSite)
- [ ] CSP header บล็อก inline script
- [ ] `X-Content-Type-Options: nosniff` ทุg response
- [ ] Origin mismatch → 403
- [ ] 5 failed logins → account locked 15 นาที
- [ ] Rate limit headers แสดงทุก response
- [ ] Brute force จาก IP เดียว → ถูก block ชั่วคราว

### 13.4 Security scan (Sprint หลัง)

- [ ] Run `npx owasp-zap baseline scan` → false-positive report
- [ ] Run `npx snyk test` → known-vuln report
- [ ] Run CSP validator → strict mode feasible?
- [ ] Run `testssl.sh` ทุg domain → TLS 1.3 only, no TLS 1.0/1.1

---

## 14. Ownership Matrix (M3.7 vs others)

| Requirement | M3.7 (เจ้าของ) | M2.7 | M3.3 | M3.4 | M3.5 | อื่น ๆ |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|
| Password Policy | ✅ | | | | | |
| OAuth Security | ✅ (constraint) | | | refs §3–§5 | | |
| CSRF Protection | ✅ (constraint) | refs §7.1 | | | | |
| XSS Protection | ✅ | | | | | |
| Rate Limiting | ✅ (extension) | refs §7.3 | | | | |
| Brute Force Protection | ✅ | | | | | |
| Session Security | ✅ (extension) | | refs §6, §8 | | | |
| Audit Events | ✅ | | | | | |
| Security Headers | ✅ | refs §8.3 | | | | |
| Cookie Policy | ✅ | refs §2.1 | | | | |
| CORS Policy | | ✅ | | | | |
| Auth Flows | | ✅ | | | | |
| JWT / Token Revocation | | | ✅ | | | |
| RBAC | | | | | ✅ | |

---

## 15. Sprint Deliverables

### Sprint 5 (Security Foundation)

| # | Deliverable | File(s) |
|---|------------|--------|
| 5-1 | `@nexus/validation` package — `packages/validation/src/auth.ts` | New package |
| 5-2 | zxcvbn + HIBP integration in `@nexus/auth/services/password-service.ts` | New file |
| 5-3 | `brute-force` service + `login_attempts` / `brute_force_lockouts` tables + migrations `018_*.sql` (partitioned monthly) | New |
| 5-4 | `audit-events` service (Redis list + batch flush) + `audit_events` table + migration `019_*.sql` | New |
| 5-5 | Security headers middleware final implementation (ref M2.7 §8.3) | Modify `apps/web/middleware.ts` |
| 5-6 | CSP / HSTS in `next.config.ts` `headers()` function | Modify |
| 5-7 | Cookie consent UI (`packages/ui/src/components/cookie-banner.tsx`) | New component |
| 5-8 | Unit tests: password / rate-limiter / brute-force / audit-event-writer | New tests |

### Sprint 6 (Hardening + Polish)

| # | Deliverable | File(s) |
|---|------------|--------|
| 6-1 | `user_sessions` table + migration `020_*.sql` | New |
| 6-2 | Concurrent session limit enforcement (5-device LIFO) — depends on 6-1 | New |
| 6-3 | Active sessions UI (`/settings/sessions`) — depends on 6-1 | New page |
| 6-4 | Admin force-logout endpoint (`POST /api/v1/admin/users/:id/revoke-sessions`) — depends on 6-1 | New route |
| 6-5 | Brute-force email alert (Resend) | Modify email service |
| 6-6 | OWASP ZAP baseline scan + Snyk + `testssl.sh` และ remediation | Security report |
| 6-7 | Integration tests: CSRF / XSS / rate-limit / brute-force | New tests |
| 6-8 | Update `.env.example` ด้วย ALLOWED_ORIGINS, ZXCVBN_THRESHOLD, HIBP_ENABLED, MAX_CONCURRENT_SESSIONS, SESSION_ABSOLUTE_MAX_DAYS | Docs |

---

## 16. Changelog

| v | Date | คำอธิบาย |
|---|------|----------|
| 1.0 | 2026-06-25 | Initial M3.7 security requirements spec |
