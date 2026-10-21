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

// The branded body used for every message the team sends.
export function brandedMessage(message: string, from: string) {
  const paras = message.split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 14px;font:15px/1.65 Arial,sans-serif;color:#17123a">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html = shell(`
<tr><td style="padding:12px 36px 0">${paras}</td></tr>
<tr><td style="padding:8px 36px 26px;font:15px/1.6 Arial,sans-serif;color:#17123a">Best regards,<br><strong style="font-size:17px">${esc(from)}</strong><br><span style="color:#5f5b7e;font-size:13px">DaysBack</span></td></tr>
<tr><td style="padding:0 36px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:3px;background:linear-gradient(90deg,#6c3cff,#e0307e 55%,#ff6a1a);font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding-top:10px;font:13px/1.7 Arial,sans-serif;color:#5f5b7e"><a href="mailto:contact@daysback.si" style="color:#6c3cff;text-decoration:none">contact@daysback.si</a> &nbsp;|&nbsp; <a href="https://daysback.si" style="color:#6c3cff;text-decoration:none">daysback.si</a><br>Ready to get your days back? Reply to book your free 27-minute strategy call.</td></tr></table></td></tr>`);
  const text = message + `\n\nBest regards,\n${from}\nDaysBack\ncontact@daysback.si | daysback.si\nReady to get your days back? Reply to book your free 27-minute strategy call.`;
  return { html, text };
}
