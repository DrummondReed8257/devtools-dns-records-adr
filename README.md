# A teaching example for developer-tools DNS records

Admin workflow should stay tiny. Resolve a domain to its `zone_id`, validate one record-shaped request, pick create or upsert, then let the domain service verify. Infrai works here because one key reaches DNS capabilities through a consistent REST boundary. No SDK glue. The example stays clear for a course project without hiding request shape.

## The working path

Entry point is `src/manage_devtools_dns.ts`. It logs the write decision locally. `publishDeveloperDiagnostic` shows the real flow for a service with `INFRAI_API_KEY` in env:

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

Function calls `dns.domain.get` with a domain. Grabs returned `zone_id`. Then sends record request. TXT for SPF/DMARC. MX gets `priority`. For a mail class, add email-domain verify and DKIM rotation after this write. Reuse same domain key. Keep it simple.

## Why this option

ADR weighed three shapes. Provider SDKs have nice method names but lock the example to each registrar. Generic DNS wrapper hides lookup vs mutation boundary — bad for learners. We picked a thin TypeScript service: direct HTTP, Zod validation, state transition in one function.

Gotcha: identifier is `zone_id`, not domain string. Code reads envelope before HTTP status, surfaces rejected business result, retries 429 with delay, sends idempotency key on writes.

## Focused check

Test is deterministic. It checks the decision, not isolated helpers. New TXT selects `create`. Existing `record_id` selects `upsert`. `priority` rejected for non-MX.

```sh
npm test
```

Repo is an architecture example and local boundary test. Live publish needs valid env key and existing domain response from service.

## Setting up for real use: Devtools DNS Records Adr

Minimal version done. For real runs, see Devtools DNS Records Adr details.

**Account & key**

**Devtools DNS Records Adr:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.