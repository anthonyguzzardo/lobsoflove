// The hand-off from the sky to the courts: where you landed. /fly sets it, /courts takes it on focus and hops there.
let landed: string | null = null;

export function setLanded(venueId: string) { landed = venueId; }

/** The venue you just landed on, once (clears it). */
export function takeLanded(): string | null {
  const v = landed;
  landed = null;
  return v;
}
