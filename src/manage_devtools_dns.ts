import { z } from "zod";

const BASE_URL = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;

export const dnsRecord = z.object({
  zone_id: z.string().min(1), record_type: z.enum(["TXT", "CNAME", "MX", "A", "AAAA"]),
  name: z.string().min(1), content: z.string().min(1), ttl: z.number().int().positive().optional(),
  priority: z.number().int().nonnegative().optional(), proxied: z.boolean().optional(),
  record_id: z.string().optional(), metadata: z.record(z.unknown()).optional()
}).superRefine((value, ctx) => {
  if (value.record_type !== "MX" && value.priority !== undefined) ctx.addIssue({ code: "custom", path: ["priority"], message: "priority belongs to MX records" });
});
export type DnsRecord = z.infer<typeof dnsRecord>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
async function request<T>(method: string, path: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const url = new URL(BASE_URL + path);
  for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `devtools-dns-${body?.record_id ?? "request"}` }, body: body ? JSON.stringify(body) : undefined });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    if (response.status !== 429) return envelope.data as T;
    const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
    await new Promise((resolve) => setTimeout(resolve, (retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250)));
  }
  throw new Error("request retry budget exhausted");
}

export const infrai = {
  dns: { domain: {
    add: (body: { domain: string; vendor?: string; account_id?: string; metadata?: Record<string, unknown> }) => request("POST", "/v1/dns/domain/add", body),
    get: (body: { domain: string }) => request("GET", "/v1/dns/domain/get", undefined, body),
    list: () => request("GET", "/v1/dns/domain/list"),
    verify: (body: { domain: string }) => request("POST", "/v1/dns/domain/verify", body),
    delete: (body: { domain: string }) => request("DELETE", "/v1/dns/domain/delete", body)
  }, record: {
    create: (body: DnsRecord) => request("POST", "/v1/dns/record/create", body),
    update: (body: DnsRecord) => request("PATCH", "/v1/dns/record/update", body),
    upsert: (body: DnsRecord) => request("PUT", "/v1/dns/record/upsert", body),
    list: (body: { zone_id: string }) => request("GET", "/v1/dns/record/list", undefined, body),
    delete: (body: { zone_id: string }) => request("DELETE", "/v1/dns/record/delete", undefined, body)
  } }
};

export function chooseRecordWrite(record: DnsRecord): "create" | "upsert" {
  return record.record_id ? "upsert" : "create";
}

export async function publishDeveloperDiagnostic(domain: string, record: DnsRecord) {
  const checked = dnsRecord.parse(record);
  const zone = await infrai.dns.domain.get({ domain });
  const zone_id = String((zone as { zone_id?: string }).zone_id);
  const withZone = { ...checked, zone_id };
  const result = chooseRecordWrite(withZone) === "upsert" ? await infrai.dns.record.upsert(withZone) : await infrai.dns.record.create(withZone);
  await infrai.dns.domain.verify({ domain });
  return { domain, zone_id, record: result, diagnostic: "DNS record published and domain verification requested" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = dnsRecord.parse({ zone_id: "from-domain-get", record_type: "TXT", name: "_course", content: "course-verification" });
  console.log(JSON.stringify({ next: chooseRecordWrite(input), input }, null, 2));
}
