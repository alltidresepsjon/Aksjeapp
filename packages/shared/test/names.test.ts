import { expect, it } from 'vitest';
import { personalize } from '../src';
it('swaps in the player names, plurals included', () => {
  const s = { heroFirst: 'Tony', familyName: 'Marino' };
  expect(personalize('Nico Corrado and the Corrados. CORRADO BAKERY. Nico\'s hat.', s)).toBe("Tony Marino and the Marinos. MARINO BAKERY. Tony's hat.");
});
