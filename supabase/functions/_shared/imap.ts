// Tiny read-only IMAP client: just enough to read address headers.
// (imapflow doesn't run in the Supabase edge runtime, so this talks IMAP
// directly over Deno's TLS socket.)

export type Address = { email: string; name: string };

class Conn {
  private buf = "";
  private tag = 0;
  private dec = new TextDecoder();
  private enc = new TextEncoder();
  constructor(private sock: Deno.TlsConn) {}

  private async fill() {
    const chunk = new Uint8Array(65536);
    const n = await this.sock.read(chunk);
    if (n === null) throw new Error("connection closed");
    this.buf += this.dec.decode(chunk.subarray(0, n), { stream: true });
  }

  async greeting() {
    while (!this.buf.includes("\r\n")) await this.fill();
    this.buf = this.buf.slice(this.buf.indexOf("\r\n") + 2);
  }

  // Sends a command and returns everything up to its tagged completion.
  async cmd(line: string): Promise<string> {
    const t = "a" + (++this.tag);
    await this.sock.write(this.enc.encode(`${t} ${line}\r\n`));
    const re = new RegExp(`(^|\\r\\n)${t} (OK|NO|BAD)[^\\r\\n]*\\r\\n`);
    for (;;) {
      const m = this.buf.match(re);
      if (m && m.index !== undefined) {
        const end = m.index + m[0].length;
        const out = this.buf.slice(0, end);
        this.buf = this.buf.slice(end);
        if (m[2] !== "OK") throw new Error(`${line.split(" ")[0]} failed: ${m[0].trim()}`);
        return out;
      }
      await this.fill();
    }
  }
}

const quote = (s: string) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';

// RFC 2047 encoded words (=?utf-8?B?...?=) -> text.
function decodeWords(s: string) {
  return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, cs, enc, data) => {
    try {
      const bytes = enc.toUpperCase() === "B"
        ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
        : Uint8Array.from(data.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16))), (c: string) => c.charCodeAt(0));
      return new TextDecoder(cs).decode(bytes);
    } catch { return data; }
  });
}

function parseAddresses(value: string): Address[] {
  const out: Address[] = [];
  // split on commas that are not inside quotes or angle brackets
  let cur = "", q = false, a = false;
  const parts: string[] = [];
  for (const ch of value) {
    if (ch === '"') q = !q;
    else if (ch === "<") a = true;
    else if (ch === ">") a = false;
    if (ch === "," && !q && !a) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  for (const p of parts) {
    const m = p.match(/<([^>]+)>/);
    const email = (m ? m[1] : p).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const name = m ? decodeWords(p.slice(0, p.indexOf("<"))).replace(/["']/g, "").trim() : "";
    out.push({ email, name });
  }
  return out;
}

// Returns From/To/Cc addresses from the newest `scan` messages of Inbox and Sent.
export async function readAddresses(host: string, user: string, pass: string, scan = 400): Promise<Address[]> {
  const sock = await Deno.connectTls({ hostname: host, port: 993 });
  const c = new Conn(sock);
  const found: Address[] = [];
  try {
    await c.greeting();
    await c.cmd(`LOGIN ${quote(user)} ${quote(pass)}`);
    const list = await c.cmd('LIST "" "*"');
    const folders = ["INBOX"];
    for (const line of list.split("\r\n")) {
      const m = line.match(/^\* LIST \(([^)]*)\) "[^"]*" (.+)$/i);
      if (!m) continue;
      const path = m[2].replace(/^"|"$/g, "");
      if (/\\Sent/i.test(m[1]) || /^(inbox[./])?sent( items| messages)?$/i.test(path)) folders.push(path);
    }
    for (const f of [...new Set(folders)]) {
      let sel: string;
      try { sel = await c.cmd(`EXAMINE ${quote(f)}`); } catch { continue; }
      const exists = Number((sel.match(/\* (\d+) EXISTS/i) || [])[1] || 0);
      if (!exists) continue;
      const from = Math.max(1, exists - scan + 1);
      const res = await c.cmd(`FETCH ${from}:${exists} (BODY.PEEK[HEADER.FIELDS (FROM TO CC)])`);
      // Unfold headers, then read each address line.
      const text = res.replace(/\r\n[ \t]+/g, " ");
      for (const line of text.split("\r\n")) {
        const m = line.match(/^(from|to|cc):\s*(.*)$/i);
        if (m) found.push(...parseAddresses(m[2]));
      }
    }
    await c.cmd("LOGOUT").catch(() => "");
  } finally {
    try { sock.close(); } catch { /* already closed */ }
  }
  return found;
}
