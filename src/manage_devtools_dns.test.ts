import assert from "node:assert/strict";
import { chooseRecordWrite, dnsRecord } from "./manage_devtools_dns.ts";

const txt = dnsRecord.parse({ zone_id: "zone-7", record_type: "TXT", name: "_dmarc", content: "v=DMARC1; p=none" });
assert.equal(chooseRecordWrite(txt), "create");
assert.equal(chooseRecordWrite({ ...txt, record_id: "record-9" }), "upsert");
assert.throws(() => dnsRecord.parse({ ...txt, record_type: "CNAME", priority: 10 }), /priority belongs to MX/);
console.log("record decision test passed");
