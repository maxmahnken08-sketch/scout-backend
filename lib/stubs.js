// Whether providers may fall back to invented sample data.
//
// These fallbacks existed so /plan always returned a full-looking trip during
// development. In production that means shipping fabricated places to real
// users — "Lisbon Omakase Bar" is not a restaurant, it's a string template — so
// the default is now OFF and an unkeyed provider simply returns nothing.
//
// Set SCOUT_ALLOW_STUBS=1 locally when you want a fully populated demo trip
// without every partner key.
export function stubsAllowed() {
  return process.env.SCOUT_ALLOW_STUBS === '1';
}

/** Returns `sample` only when stubs are explicitly enabled, else []. */
export function stubOr(sample) {
  return stubsAllowed() ? sample : [];
}
