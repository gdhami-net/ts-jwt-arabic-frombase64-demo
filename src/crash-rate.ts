// How often does plain atob() actually crash on a payload segment? It throws
// only when the segment holds "-" or "_", so this counts those, over many
// generated tokens, with Arabic names and with the same names in Latin letters.

import { b64url } from './token.ts';

const GIVEN = [
  ['أحمد', 'Ahmed'], ['محمد', 'Mohamed'], ['علي', 'Ali'], ['عمر', 'Omar'], ['يوسف', 'Youssef'],
  ['إبراهيم', 'Ibrahim'], ['حسن', 'Hassan'], ['حسين', 'Hussein'], ['سعيد', 'Said'], ['سعد', 'Saad'],
  ['عبدالله', 'Abdullah'], ['عبدالرحمن', 'Abdulrahman'], ['طارق', 'Tarek'], ['ماجد', 'Majed'], ['فهد', 'Fahad'],
  ['ناصر', 'Nasser'], ['راشد', 'Rashed'], ['سلطان', 'Sultan'], ['زياد', 'Ziad'], ['وليد', 'Walid'],
  ['فاطمة', 'Fatima'], ['عائشة', 'Aisha'], ['مريم', 'Mariam'], ['نور', 'Nour'], ['ليلى', 'Layla'],
  ['هدى', 'Huda'], ['سارة', 'Sara'], ['رنا', 'Rana'], ['خديجة', 'Khadija'], ['زينب', 'Zainab'],
  ['أمل', 'Amal'], ['سلمى', 'Salma'], ['دعاء', 'Doaa'], ['هند', 'Hind'], ['لينا', 'Lina'], ['ندى', 'Nada'],
];

const FAMILY = [
  ['الأحمد', 'Al Ahmad'], ['العلي', 'Al Ali'], ['الحسن', 'Al Hassan'], ['الشمري', 'Al Shammari'],
  ['القحطاني', 'Al Qahtani'], ['العتيبي', 'Al Otaibi'], ['الغامدي', 'Al Ghamdi'], ['الزهراني', 'Al Zahrani'],
  ['الدوسري', 'Al Dosari'], ['المطيري', 'Al Mutairi'], ['الهاشمي', 'Al Hashimi'], ['التميمي', 'Al Tamimi'],
  ['النجار', 'Al Najjar'], ['الحداد', 'Al Haddad'], ['الخطيب', 'Al Khatib'], ['الصباغ', 'Al Sabbagh'],
  ['القاسم', 'Al Qasim'], ['بن علي', 'Ben Ali'], ['بن يوسف', 'Ben Youssef'], ['السعيدي', 'Al Saidi'],
  ['المنصوري', 'Al Mansouri'], ['الكعبي', 'Al Kaabi'], ['العمري', 'Al Omari'], ['الفارسي', 'Al Farsi'],
  ['الرشيدي', 'Al Rashidi'], ['البلوشي', 'Al Balushi'], ['الجابري', 'Al Jabri'], ['الشامي', 'Al Shami'],
  ['المصري', 'Al Masri'], ['التونسي', 'Al Tounsi'],
];

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function payloadFor(name: string, rnd: () => number): string {
  const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const iat = 1_770_000_000 + Math.floor(rnd() * 10_000_000);
  const claims: Record<string, unknown> = {
    sub: String(Math.floor(rnd() * 10 ** (3 + Math.floor(rnd() * 7)))),
    name,
    role: pick(['viewer', 'editor', 'admin', 'owner']),
    iat,
    exp: iat + pick([900, 3600, 28800]),
  };
  if (rnd() < 0.5) claims.email = `user${Math.floor(rnd() * 100000)}@example.com`;
  if (rnd() < 0.5) claims.iss = 'https://login.example.com/realms/main';
  if (rnd() < 0.5) claims.locale = pick(['ar', 'en', 'fr']);
  return b64url(JSON.stringify(claims));
}

export function measure(samples: number, seed = 20261108) {
  const rnd = mulberry32(seed);
  let arabic = 0;
  let latin = 0;
  let arabicWithDal = 0;
  let arabicCrashWithoutDal = 0;

  for (let i = 0; i < samples; i++) {
    const g = GIVEN[Math.floor(rnd() * GIVEN.length)];
    const f = FAMILY[Math.floor(rnd() * FAMILY.length)];
    const ar = `${g[0]} ${f[0]}`;
    const en = `${g[1]} ${f[1]}`;

    // The same random claims for both spellings, so only the name differs.
    const state = Math.floor(rnd() * 2 ** 32);
    const arPayload = payloadFor(ar, mulberry32(state));
    const enPayload = payloadFor(en, mulberry32(state));

    const hasDal = /د[ء-ي]/.test(ar);
    if (hasDal) arabicWithDal++;
    if (/[-_]/.test(arPayload)) {
      arabic++;
      if (!hasDal) arabicCrashWithoutDal++;
    }
    if (/[-_]/.test(enPayload)) latin++;
  }
  return { samples, arabic, latin, arabicWithDal, arabicCrashWithoutDal };
}

// Which letters can put "-" or "_" into the encoded text at all? Tries every
// Arabic letter followed by every other, at each of the three byte offsets
// base64 can land on, with a closing quote after so the group is complete.
export function lettersThatCrash() {
  // U+063B to U+063F are letters from other scripts and U+0640 is the kashida.
  // Arabic names don't use them, so they stay out of this count.
  const letters: string[] = [];
  for (let cp = 0x0621; cp <= 0x064a; cp++) {
    if (cp < 0x063b || cp > 0x0640) letters.push(String.fromCodePoint(cp));
  }
  const found = new Map<string, number>();
  for (const first of letters) {
    for (const second of letters) {
      for (const pad of ['', 'x', 'xx']) {
        const text = b64url(`${pad}${first}${second}"`);
        if (/[-_]/.test(text)) found.set(first, (found.get(first) ?? 0) + 1);
      }
    }
  }
  return found;
}

// Every printable ASCII three-byte group, to see which characters can put
// "-" or "_" into the encoded text.
export function asciiThatCrash(): string {
  const found = new Set<string>();
  const group = Buffer.alloc(3);
  for (let a = 0x20; a <= 0x7e; a++) {
    for (let b = 0x20; b <= 0x7e; b++) {
      for (let c = 0x20; c <= 0x7e; c++) {
        group[0] = a;
        group[1] = b;
        group[2] = c;
        const text = group.toString('base64url');
        if (text.includes('-') || text.includes('_')) found.add(String.fromCharCode(c));
      }
    }
  }
  return [...found].sort().join('');
}

if (import.meta.main) {
  const m = measure(200_000);
  const pct = (n: number) => ((100 * n) / m.samples).toFixed(1) + '%';
  console.log(`tokens generated:                     ${m.samples}`);
  console.log(`Arabic name, "-" or "_" in payload:   ${m.arabic} (${pct(m.arabic)})`);
  console.log(`Latin name,  "-" or "_" in payload:   ${m.latin} (${pct(m.latin)})`);
  console.log(`Arabic names with dal before a letter: ${m.arabicWithDal} (${pct(m.arabicWithDal)})`);
  console.log(`Arabic crashes without that dal:      ${m.arabicCrashWithoutDal}`);
  console.log();
  const found = lettersThatCrash();
  console.log(`ASCII characters that can give "-" or "_": ${asciiThatCrash()}`);
  console.log(`first letters of a pair that can give "-" or "_": ${[...found.keys()].join(' ')}`);
  for (const [letter, n] of found) {
    console.log(`  ${letter} U+${letter.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}: ${n} combinations`);
  }
}
