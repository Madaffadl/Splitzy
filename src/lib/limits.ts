// Caps that BOTH the input UI and the server validators have to agree on.
//
// These used to be declared separately in validation.ts, shared-summary.ts and
// nowhere at all in the components — so the forms happily let you add a 51st fee
// and only the share-link request failed, with an error the user never asked
// for and couldn't act on. One definition means the form can disable itself at
// exactly the point the server would start rejecting.

/** Extra fees (delivery, platform, packaging) per receipt. */
export const MAX_FEES_PER_RECEIPT = 50;

/** Discounts/vouchers per receipt, across all scopes. */
export const MAX_DISCOUNTS_PER_RECEIPT = 100;

/** Ceiling for any single monetary field (1 billion rupiah). */
export const MAX_AMOUNT = 1_000_000_000;
