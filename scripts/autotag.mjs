/* Provisional persona tagging for concepts that have no hand-written annotation yet.
 *
 * This is deliberately a WEAK classifier and its output is labelled `auto` in the UI and
 * listed on the review page. Naming a persona properly means looking at the creative; a
 * keyword rule can only put a marker down so a new ad is not blank until someone reads it.
 * Rules were derived from the 145 hand-read ads in the first census. */
const R = [
  [/glp-?1|ozempic|semaglutide|appetite (vanished|disappeared|killed)|on a glp/i,
   'The GLP-1 Patient Mid-Protocol',
   'Treats their own body as a compliance problem the drug created; wants the gap the injection left handled without being shamed for taking it.'],
  [/peri-?menopause|menopaus|menobelly|hot flash/i,
   'The Woman Told She Just Let Herself Go',
   'Has been misdiagnosed as lazy when the cause is hormonal; relief at being told she is not broken is the buying emotion.'],
  [/cortisol|hormone (harmony|support|balance)|hormonal weight/i,
   'The Cortisol Explainer',
   'Has adopted one hormone as the single villain unifying her sleep, fog, fatigue and bloat; wants a symptom checklist that confirms it.'],
  [/testosterone|trt|moobs|t-?levels|low t\b/i,
   'The Man Reading His Body as a Hormone Failure',
   'Wants an explanation for his physique that is biological rather than behavioural, and a fix that is not a needle.'],
  [/joint pain|cartilage|inflammation|stiffness/i,
   'The Pain Sufferer Whose Doctor Ran Out of Options',
   'Has exhausted the standard protocol and now trusts a credentialed dissenter over their own physician.'],
  [/acne|pimple|breakout|blemish/i,
   'The Long-Term Acne Veteran',
   'Has tried everything and expects failure; only a specific, short, falsifiable timeline breaks that learned hopelessness.'],
  [/ipl|laser hair|hair removal|shaving|razor|wax|ingrown|bikini|pubic/i,
   'The Shaving-Fatigued Body Groomer',
   'Reads the daily razor as a losing chore and wants permanence; explicitness about the body part is the trust signal.'],
  [/pheromone|cologne|fragrance|perfume|scent|eau de|baccarat/i,
   'The Scent-as-Social-Outcome Buyer',
   'Buys the compliment rather than the product; being asked what they are wearing is the specific fantasy.'],
  [/nootropic|adderall|focus|brain fog|neuroplasticity|dopamine/i,
   'The Focus-Deprived Self-Optimiser',
   'Believes their attention has been chemically degraded and wants a prescription-grade result without the prescription.'],
  [/mushroom coffee|adaptogen|lion.s mane|chaga|cordyceps|jitters/i,
   'The Coffee Swapper Avoiding the Crash',
   'Believes the morning cup is the hidden cause of their afternoon; swapping one input is the lowest-effort intervention they will accept.'],
  [/collagen|bone broth|hair.{0,6}skin.{0,6}nails/i,
   'The Week-by-Week Progress Tracker',
   'Needs a dated timeline to sustain a daily habit, because the benefit is otherwise invisible.'],
  [/protein|\d+\s?g protein|macro|calorie/i,
   'The Macro Spec-Sheet Buyer',
   'Reads food like hardware; a small set of numbers is more persuasive than any lifestyle image.'],
  [/vaginal|ph balance|uti|urinary|libido|sex life|dryness/i,
   'The Woman Whose Intimate Health Became a Health Problem',
   'Treats a private, embarrassing symptom as fixable biology rather than a personal failing; frankness is the permission.'],
  [/scalp|shampoo|conditioner|curl|frizz|bond|split end|hair (loss|thinning)/i,
   'The Damage-Aware Hair Rebuilder',
   'Believes their hair is structurally damaged and needs professional-grade chemistry rather than cosmetics.'],
  [/whiten|teeth|mouthwash|stain|enamel/i,
   'The Visible-Smile Self-Auditor',
   'Judges themselves on a feature other people see first; wants a fast, checkable before/after.'],
  [/sleep|mattress|pillow|duvet|sheet|bedding|insomnia/i,
   'The Poor Sleeper Blaming Their Setup',
   'Believes the room and the bedding, not their behaviour, are what is costing them the night.'],
  [/sweat|antiperspirant|deodorant|odor|odour/i,
   'The Sweat-Anxious Self-Monitor',
   'Experiences an involuntary body process as a social threat and wants it controlled, not managed.'],
  [/free (shipping|gift|kit|spoon|bundle)|bogo|% off|\$\d+ off|save \$|discount|code [A-Z]{3,}/i,
   'The Stacked-Offer Arithmetician',
   'Computes the free-gift dollar value as the real price; the product is close to incidental to the maths.'],
  [/try before|due today|\$0|risk.?free|money.?back|only pay if/i,
   'The Zero-Risk Trialist',
   'Will not pay before proof; removing the gamble is worth more to them than a discount.'],
  [/at (target|walmart|costco|ulta|sprouts|kroger)|now at|find .* near you|in stores|amazon/i,
   'The Retail-Shelf Verifier',
   'Needs to see it in a store they already walk through; physical availability retires the is-this-a-scam question.'],
];


/* Second tier: DCO ads carry no readable copy at all ({{product.brand}}), but the LANDING
 * PATH the advertiser chose is a direct statement of who they think is clicking. Matched
 * against the URL path only, after the copy rules above have had their chance. */
const P = [
  [/first-order|starter|welcome-kit|try-|trial|free-sample|get-started/,
   'The First-Order Trialist',
   'Has not bought the category before and treats the first box as an experiment; the offer is doing the persuading, not the product.'],
  [/subscribe|subscription|auto-?ship|save-and-subscribe/,
   'The Subscriber Being Locked In',
   'Already convinced by the product and is being sold the commitment; convenience and per-unit price are what close it.'],
  [/weight-?loss|slim|lean|fat-?loss|metabolis/,
   'The Weight-Loss Outcome Buyer',
   'Measures the product against a number on a scale; everything else in the formula is secondary to that one outcome.'],
  [/gut-?health|fiber|digest|bloat|probiotic|microbiome/,
   'The Bloat-Aware Gut Fixer',
   'Reads digestion as the hidden system behind their energy and appearance; wants the plumbing fixed before anything else.'],
  [/energy|focus|clarity|alert|crash/,
   'The Afternoon-Crash Avoider',
   'Buys against a specific hour of their day rather than a health goal; the promise is a flatter curve, not a higher peak.'],
  [/immun|defen[cs]e|wellness-support|daily-greens/,
   'The Daily-Insurance Taker',
   'Buys a routine as hedging rather than treatment; wants one product that closes several vague gaps at once.'],
  [/sleep|rest|night|calm|relax|stress|unwind/,
   'The Wound-Up Evening Self-Soother',
   'Believes the day has left a residue that has to be actively cleared before sleep will come.'],
  [/quiz|consultation|assessment|find-your|match/,
   'The Diagnostic-Quiz Completer',
   'Distrusts one-size-fits-all and wants to be told which variant is theirs before they will hand over money.'],
  [/review|testimonial|before-after|results|transformation/,
   'The Proof-Before-Purchase Holdout',
   'Will not act on a brand claim and needs another buyer visible in the frame first.'],
  [/compare|vs-|versus|alternative|switch/,
   'The Category Comparison Shopper',
   'Is already buying something adjacent and is being asked to defect, not to adopt.'],
  [/bundle|kit|value|bogo|deal|sale|discount|offer|save|% ?off|black-friday|cyber/,
   'The Stacked-Offer Arithmetician',
   'Computes the free-gift dollar value as the real price; the product is close to incidental to the maths.'],
  [/target|walmart|costco|ulta|sprouts|kroger|amazon|instacart|cvs|walgreens|store-locator|near-you/,
   'The Retail-Shelf Verifier',
   'Needs to see it in a shop they already walk through; physical availability retires the is-this-a-scam question.'],
  [/products?\/|collections?\/|flavou?r|variety|pack/,
   'The Flavour-Led SKU Picker',
   'Already sold on the category and choosing between variants; the decision is appetite, not argument.'],
];

function pathOf(link) {
  try { const u = new URL(link); return (u.pathname + u.search).toLowerCase(); } catch { return (link || '').toLowerCase(); }
}

export function autotag(ad) {
  const hay = `${ad.title || ''} ${ad.text || ''} ${ad.link || ''}`;
  for (const [re, persona, psycho] of R) if (re.test(hay)) return { persona, psycho, by: 'auto' };
  const pth = pathOf(ad.link);
  for (const [re, persona, psycho] of P) if (re.test(pth)) return { persona, psycho, by: 'auto' };
  return {
    persona: 'Unread — needs a human pass',
    psycho: 'No hand-written read yet. The rules could not place this one, which usually means the copy is pure DCO tokens and the persona is carried entirely by the image.',
    by: 'none',
  };
}
