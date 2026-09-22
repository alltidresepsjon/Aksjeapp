// Liten, deterministisk, avhengighetsfri hash/PRNG-verktøykasse. All
// prisgenerering i DemoProvider er en ren funksjon av (seed, ticker,
// tickIndex) — ingen skjult tilstand, ingen iterasjon over historikk.

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hashKey(...parts: (string | number)[]): number {
  return fnv1a(parts.join("|"));
}

export function hashToUnitFloat(seed: number): number {
  let z = (seed + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  return z / 0xffffffff;
}

export function hashToGaussian(seed: number): number {
  const u1 = Math.max(hashToUnitFloat(seed), Number.EPSILON);
  const u2 = hashToUnitFloat(seed ^ 0x5bd1e995);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
