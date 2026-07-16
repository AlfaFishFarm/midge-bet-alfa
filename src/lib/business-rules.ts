// Business rules pulled directly out of מסמך אפיון מודול תפעול בריכות so they
// can be unit tested and reused by both the close-cycle screen and its API
// route (never trust only the client-side copy of this check).

export const FISH_BALANCE_TOLERANCE = 100;

export interface FishBalanceInput {
  incoming: number;
  outgoing: number;
  mortality: number;
}

export interface FishBalanceResult {
  difference: number; // incoming - outgoing - mortality
  withinTolerance: boolean;
}

/**
 * Spec rule: when closing a growth cycle, incoming - outgoing - mortality
 * must fall within +/-100 fish, or the UI must block closing with a red
 * validation error. This function is the single source of truth for that
 * check - call it from the API route that actually closes the cycle, not
 * just from the form's client-side validation.
 */
export function checkFishBalance({
  incoming,
  outgoing,
  mortality,
}: FishBalanceInput): FishBalanceResult {
  const difference = incoming - outgoing - mortality;
  // Spec (page 9): "-100 < diff < 100" — strict, so exactly ±100 is OUT of tolerance.
  return {
    difference,
    withinTolerance: Math.abs(difference) < FISH_BALANCE_TOLERANCE,
  };
}
