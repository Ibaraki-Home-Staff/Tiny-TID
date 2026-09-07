// Shared env knobs. Same names as wrangler.jsonc vars so both backends
// behave alike; SORAHOST passes them via process env (PteWorker env config).

const str = (key, fallback) => {
  const v = process.env[key];
  return v === undefined || v === null || String(v).trim() === '' ? fallback : String(v).trim();
};

const list = (key, fallback) =>
  str(key, fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  host: str('HOST', '127.0.0.1'),
  port: Number(str('PORT', '8787')) || 8787,
  origin: str('UPSTREAM_ORIGIN', 'https://www.train-guide.westjr.co.jp'),
  fixedStation: str('FIXED_STATION', '茨木'),
  fixedLine: str('FIXED_LINE', 'kyoto'),
  fixedArea: str('FIXED_AREA', 'kinki'),
  scopeLines: list('LINE_SCOPE', 'kyoto,kobesanyo,hokurikubiwako,ako,kosei,takarazuka'),
  dataDir: str('DATA_DIR', 'data'),
  vapidPrivateKey: str('VAPID_PRIVATE_KEY', ''),
  vapidSubject: str('VAPID_SUBJECT', ''),
  vapidPublicKey: str('VAPID_PUBLIC_KEY', ''),
};

export const AREAS = ['hokuriku', 'kinki', 'okayama', 'hiroshima', 'sanin'];
export const SUPPRESS_MS = 3 * 60 * 1000;
export const TRAINS_TTL_MS = 5_000;
export const TRAFFIC_TTL_MS = 30_000;
export const MASTER_TTL_MS = 24 * 60 * 60 * 1000;
