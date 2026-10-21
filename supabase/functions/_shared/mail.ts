// Bits shared by the enquiry and reply functions.

export const SITE = "https://zayanandahmed-bit.github.io/daysback-3d";

export const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Signed link token: only someone who received the team email can open the
// reply page for that enquiry. HMAC of the enquiry id keyed with the REPLY_SECRET secret.
export async function sign(id: string): Promise<string> {
  const secret = Deno.env.get("REPLY_SECRET") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("reply:" + id));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

// Branded email wrapper (table layout + inline styles for Gmail/Outlook/Apple Mail).
export function shell(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f2ff;padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="height:6px;background:linear-gradient(90deg,#6c3cff,#e0307e 55%,#ff6a1a);font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:32px 36px 8px;font:800 22px Arial,sans-serif;color:#17123a;letter-spacing:.5px">DaysBack</td></tr>
${inner}
<tr><td style="padding:18px 36px;background:#f4f2ff;font:12px/1.6 Arial,sans-serif;color:#5f5b7e">DaysBack builds custom AI that finds where your business leaks money and gets your days back.<br><a href="mailto:contact@daysback.si" style="color:#6c3cff;text-decoration:none">contact@daysback.si</a> &nbsp;|&nbsp; <a href="https://daysback.si" style="color:#6c3cff;text-decoration:none">daysback.si</a></td></tr>
</table></td></tr></table></body></html>`;
}
