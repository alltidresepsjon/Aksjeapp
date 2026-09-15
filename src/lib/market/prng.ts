// Liten, deterministisk, avhengighetsfri hash/PRNG-verktøykasse.
//
// All prisgenerering i MockProvider MÅ være en ren funksjon av
// (seed, ticker, tickIndex) — ingen skjult tilstand, ingen iterasjon over
// historikk. Det gjør at vi kan slå opp prisen for en vilkårlig tick uten å
// måtte "spole frem" fra epoke, og at samme seed alltid gir samme kurser.

// FNV-1a 32-bit — rask, god nok fordeling for demo-formål, ikke kryptografisk.
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Slår sammen flere strenger/tall til én 32-bit hash.
export function hashKey(...parts: (string | number)[]): number {
  return fnv1a(parts.join("|"));
}

// splitmix32 — deterministisk, gitt en 32-bit seed, produserer den en
// uniform pseudo-tilfeldig verdi. Brukes til å hashe (seed, ticker, tickIndex)
// direkte til [0, 1) uten noen form for løpende tilstand.
export function hashToUnitFloat(seed: number): number {
  let z = (seed + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  return z / 0xffffffff;
}

// Standard normalfordelt støy (Box-Muller), deterministisk fra to hash-verdier.
export function hashToGaussian(seed: number): number {
  const u1 = Math.max(hashToUnitFloat(seed), Number.EPSILON);
  const u2 = hashToUnitFloat(seed ^ 0x5bd1e995);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
