/**
 * The Genesis Journal — the agency's editorial voice on the public site.
 *
 * Three registers, deliberately distinct:
 *   - industry-news : what is moving in the business of fashion right now
 *   - insights      : how the industry actually works, from the booking table
 *   - guidance      : practical, honest advice for models and for clients
 *
 * Plus keynotes: short, dated agency positions — a sentence or two the agency
 * stands behind, shown across the site. New pieces are added here; no CMS is
 * needed until the volume justifies one.
 */

export type JournalCategory = 'industry-news' | 'insights' | 'guidance';

export interface JournalSection {
  heading?: string;
  paragraphs: string[];
}

export interface JournalArticle {
  slug: string;
  category: JournalCategory;
  title: string;
  standfirst: string;
  date: string; // ISO, shown formatted
  readMinutes: number;
  sections: JournalSection[];
  featured?: boolean;
}

export interface Keynote {
  topic: string;
  note: string;
}

export const JOURNAL_CATEGORIES: Array<{ key: JournalCategory | 'all'; label: string }> = [
  { key: 'all', label: 'Everything' },
  { key: 'industry-news', label: 'Industry news' },
  { key: 'insights', label: 'Insights' },
  { key: 'guidance', label: 'Guidance' },
];

export const categoryLabel = (key: JournalCategory): string =>
  JOURNAL_CATEGORIES.find((c) => c.key === key)?.label ?? key;

export const keynotes: Keynote[] = [
  {
    topic: 'On scouting',
    note: 'We never charge to join the board. An agency that asks a new face for money before it has earned them a penny is not an agency.',
  },
  {
    topic: 'On usage',
    note: 'A photograph is licensed, not sold. Every booking we confirm names the territories, the channels and the term — before the shutter clicks.',
  },
  {
    topic: 'On new faces',
    note: 'Development takes seasons, not weeks. We would rather place a model well in a year than badly in a fortnight.',
  },
  {
    topic: 'On clients',
    note: 'The best castings start with an honest brief. Tell us the budget and the usage on day one and we will show you the strongest board for it.',
  },
  {
    topic: 'On welfare',
    note: 'No model of ours works a set without a call sheet, agreed hours and a named contact at the agency. That is not a premium service; it is the floor.',
  },
];

export const journalArticles: JournalArticle[] = [
  {
    slug: 'how-to-brief-a-model-agency',
    category: 'guidance',
    title: 'How to brief a model agency so you get the right cast',
    standfirst:
      'Half the castings that go wrong were lost in the first email. Here is what a booking team actually needs from you, and why each piece changes what you are shown.',
    date: '2026-07-14',
    readMinutes: 6,
    featured: true,
    sections: [
      {
        paragraphs: [
          'When a brief lands at Genesis, the first thing a booker does is look for four facts: the dates, the usage, the budget and the creative direction. When all four are there, a package of models can be on its way back to you within hours. When they are not, the thread grows by five emails and a day, and the casting starts late.',
          'None of this is bureaucracy. Each fact rules models in or out before taste even enters the room.',
        ],
      },
      {
        heading: 'Dates rule out more than you think',
        paragraphs: [
          'Models travel. A face who is perfect for your campaign may be in Tokyo for the fortnight you need her, optioned to a show, or mid-exam season if she is studying. Give the shoot date and any fitting dates in the first message and the package you receive is a package of people who can actually stand on your set.',
          'If your dates are soft, say so. An option — a provisional hold, released or confirmed by an agreed deadline — exists precisely for this, and costs you nothing to place.',
        ],
      },
      {
        heading: 'Usage is the price, not a footnote',
        paragraphs: [
          'The same day on set is worth different fees depending on what the pictures will do afterwards. A season of UK e-commerce is one licence; a two-year global out-of-home campaign is quite another, and the model’s rate reflects it.',
          'Tell the agency where the images will run (channels), where in the world (territories) and for how long (term). A brief that says "usage: TBC" does not postpone the conversation — it just means the quotes you receive are guesses that will move later, usually upwards, usually at the worst moment.',
        ],
      },
      {
        heading: 'Budget honesty gets you a better board, not a worse one',
        paragraphs: [
          'Clients sometimes withhold the budget expecting a better price. What actually happens is the booker guesses, and guesses conservatively. State the range and the team can tell you immediately which of their boards fits it — and when a face you love sits above it, they can often restructure usage to close the gap.',
        ],
      },
      {
        heading: 'Creative direction: three references beat three paragraphs',
        paragraphs: [
          'A short deck, a mood board, even three images pulled from Instagram tell a casting team more than prose ever will. Send what the pictures should feel like and the board will be read with your eye, not just yours described.',
          'Put those four things in your first email and you will feel the difference in the second one you receive.',
        ],
      },
    ],
  },
  {
    slug: 'usage-and-licensing-plain-english',
    category: 'insights',
    title: 'Usage and licensing, in plain English',
    standfirst:
      'The most misunderstood line on any modelling invoice, explained the way we explain it across the booking table.',
    date: '2026-06-02',
    readMinutes: 7,
    featured: true,
    sections: [
      {
        paragraphs: [
          'A model’s fee has two parts, and the industry does itself no favours by mumbling about the second. The day rate pays for time: hours on set, the craft in front of the camera. The usage fee pays for the licence — the right to publish the resulting images in defined places, for a defined period.',
          'Everything confusing about model billing becomes simple once you hold onto that distinction.',
        ],
      },
      {
        heading: 'The three dials',
        paragraphs: [
          'Every licence is set by three dials. Channels: where the image appears — e-commerce, organic social, paid social, print, out-of-home, broadcast. Territories: where in the world — UK only, Europe, global. Term: for how long — three months, a year, two years.',
          'Turn any dial up and the licence is worth more, because the image is doing more selling. A photograph on a product page for one season is a modest licence. The same photograph on bus sides in twelve countries for two years is a major one, and the fee difference is not the agency being difficult — it is the same logic by which a photographer, an illustrator or a composer prices their work.',
        ],
      },
      {
        heading: 'Why renewals exist',
        paragraphs: [
          'When a campaign performs, clients naturally want to keep running it. A renewal re-licenses the existing images for a further term — usually at a healthy discount to reshooting, and with none of the production cost. Diarise your usage end dates. Images running past their term are the single most common cause of genuinely awkward conversations in this business, and every one of them was avoidable with a calendar reminder.',
        ],
      },
      {
        heading: 'What Genesis puts in writing',
        paragraphs: [
          'Every confirmation we issue states the channels, territories and term alongside the fee, so there is never a later argument about what was bought. If you are ever unsure what a licence covers, ask before publishing, not after. The answer is always faster and cheaper.',
        ],
      },
    ],
  },
  {
    slug: 'honest-guide-to-getting-scouted',
    category: 'guidance',
    title: 'So you want to be a model: an honest guide to getting started',
    standfirst:
      'What agencies actually look for, what a legitimate approach looks like, and the red flags that should end a conversation immediately.',
    date: '2026-05-19',
    readMinutes: 8,
    featured: true,
    sections: [
      {
        paragraphs: [
          'Most of what new applicants believe about getting signed comes from films and from people selling them something. The reality is simpler, slower and kinder than both. Here is how it works from our side of the desk.',
        ],
      },
      {
        heading: 'What we actually need from an application',
        paragraphs: [
          'Digitals — plain, unretouched photographs in simple clothing, natural light, no makeup or very little. Front, profile, full length, a smile. Taken on a phone by a friend is perfect; a paid "portfolio shoot" is not only unnecessary at this stage, it often hides exactly what we need to see.',
          'Add your height, age, location and an Instagram handle if you have one, and that is a complete application. Anyone who tells you differently is selling photography, not representation.',
        ],
      },
      {
        heading: 'The red flags, plainly',
        paragraphs: [
          'A legitimate agency earns commission on the work it books you — it makes money when you make money, and not before. Walk away from anyone who asks for an upfront joining fee, mandatory paid "test shoots" through their own photographer, or payment for a place on a website. Walk away from anyone who approaches teenagers and discourages them from telling their parents. No genuine scout ever minds a parent on the call.',
          'Check that a scout’s account follows and is followed by the agency it claims. Then contact the agency through its website and ask. We would far rather answer a suspicious email than see a name misused.',
        ],
      },
      {
        heading: 'What development really looks like',
        paragraphs: [
          'A new face is not booked onto a campaign in week one. Expect a patient stretch of test shoots to build a book, digitals refreshed as you change, castings that come to nothing, and then — sometimes quite suddenly — the ones that do. An agency’s job in this period is to develop you without pressuring you: school and exams come first for younger faces, and a model who is rushed rarely lasts.',
          'Rejection, meanwhile, is nearly never about you. Casting is matching: a face to a brand, a look to a season. The board that says no today has said no to faces who defined the following decade.',
        ],
      },
    ],
  },
  {
    slug: 'what-a-mother-agency-does',
    category: 'insights',
    title: 'What a mother agency actually does',
    standfirst:
      'Behind most international careers is a home agency doing the quiet work. An explainer on the structure that underpins the industry.',
    date: '2026-04-08',
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          'When a model signs with an agency in her home market, that agency typically becomes her mother agency: the one that discovered and developed her, and the one that manages her career globally even as she takes placements with partner agencies in Milan, Paris, New York or Tokyo.',
        ],
      },
      {
        heading: 'The division of labour',
        paragraphs: [
          'The placement agency books the local work: it knows its market’s casting directors, clients and rates. The mother agency negotiates the placement terms, watches the contracts, tracks the accounting across markets, and holds the long view of the career — which placements build a book and which merely fill a season.',
          'Commissions are shared between the two, which is why the structure survives: everyone is paid from the same work, and the model has one home number to call from any city in the world.',
        ],
      },
      {
        heading: 'Why it matters to a new face',
        paragraphs: [
          'For a young model, the mother agency is the safeguard. A placement abroad — new city, new language, an apartment of strangers — is where careers are made and where problems happen. A good mother agency vets the partner, agrees the living arrangements, caps the expenses that can be charged back, and stays on the phone. When you evaluate an agency as a new face, you are really evaluating how it will do this job.',
        ],
      },
    ],
  },
  {
    slug: 'digitals-that-actually-work',
    category: 'guidance',
    title: 'Digitals that actually work: a working guide',
    standfirst:
      'The unglamorous photographs that get more models booked than any editorial. How to shoot yours, and how often to refresh them.',
    date: '2026-03-11',
    readMinutes: 4,
    sections: [
      {
        paragraphs: [
          'Casting directors trust digitals precisely because they are plain. A book shows what a team of professionals can make of you; digitals show what walks into the fitting. Both matter, but when a client is choosing between two options at 6pm the night before a shoot, it is the digitals that get opened.',
        ],
      },
      {
        heading: 'The recipe',
        paragraphs: [
          'Daylight, near a window, no direct sun. A plain wall. Fitted, simple clothing — jeans and a vest is the industry default for a reason. Hair off the face, minimal or no makeup, no filters, no retouching of any kind.',
          'The set: front head-and-shoulders, both profiles, full length front and back, one natural smile, one walk video shot horizontally. Shoot on a recent phone at arm’s length distance — not selfie distance, which distorts.',
        ],
      },
      {
        heading: 'Keep them alive',
        paragraphs: [
          'Digitals expire. Hair changed, measurements changed, a summer of sun — refresh them. As a working rule, every eight to twelve weeks, or immediately after any visible change. A model whose digitals match the person who arrives is a model who gets rebooked; the fastest way to lose a client’s trust is a fitting surprise.',
        ],
      },
    ],
  },
  {
    slug: 'season-notes-social-casting',
    category: 'industry-news',
    title: 'Season notes: casting has moved to the phone, and it is not moving back',
    standfirst:
      'Self-tapes, digitals-first packages and Instagram as the second portfolio — how the casting process has settled after five years of change, and what it means for models and clients this season.',
    date: '2026-08-05',
    readMinutes: 6,
    featured: true,
    sections: [
      {
        paragraphs: [
          'Five years ago the industry was arguing about whether remote casting would outlast the circumstances that forced it. That argument is over. The pattern that has settled — and which we now plan around at Genesis — is a hybrid with clear rules: discovery and first-round selection happen on screens; final decisions still happen in rooms.',
        ],
      },
      {
        heading: 'What clients now do first',
        paragraphs: [
          'The first cut is made from digitals and video, not from comp cards. Briefs increasingly ask for a walk video and a short self-tape up front, and packages are reviewed on phones in minutes rather than in leisurely deck reviews. The practical consequence for models is blunt: your digitals and your sixty seconds of video are doing the job your book used to do, and they need the same discipline.',
          'In-person callbacks have not disappeared — for shows and major campaigns they remain decisive — but they now happen later, with shorter lists. Fewer, better-prepared appearances rather than days of pounding between studios. Most working models will tell you this is a trade worth making.',
        ],
      },
      {
        heading: 'Instagram as the second portfolio',
        paragraphs: [
          'Casting teams look at a model’s Instagram as routinely as her book — not for follower counts, which matter far less than the influencer economy suggests, but as evidence: how she moves, how she photographs off-duty, how she carries a brand. A tidy, honest feed genuinely books work. A neglected or heavily-filtered one genuinely costs it.',
          'Our advice to the board is unchanged season to season: post the work, credit the teams, keep the retouching invisible, and let the feed be a portfolio that happens to be social rather than the other way round.',
        ],
      },
      {
        heading: 'What has not changed',
        paragraphs: [
          'Punctuality, preparation and courtesy in the room — or on the call — still decide the margins. The technology moved; the fundamentals did not.',
        ],
      },
    ],
  },
  {
    slug: 'ai-imagery-where-we-stand',
    category: 'industry-news',
    title: 'AI imagery and model likenesses: where Genesis stands',
    standfirst:
      'Generated imagery has arrived in fashion production. Our position on consent, compensation and contracts — and the questions every model and client should be asking.',
    date: '2026-07-28',
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          'Generative imagery is now part of fashion production — in e-commerce variation, in campaign concepting, and increasingly in finished assets. We are not interested in pretending otherwise, and we are not interested in panic. We are interested in the two questions that actually matter: consent and compensation.',
        ],
      },
      {
        heading: 'The principle',
        paragraphs: [
          'A model’s face and body are her professional asset. Any use of that likeness to train a model, to generate variations, or to produce a digital twin is a licensed use — exactly like a photograph, priced by the same three dials of channel, territory and term, and requiring the same explicit, written consent. "We shot you, so we can generate you" is not a position we accept, and no Genesis contract permits it by default.',
        ],
      },
      {
        heading: 'What we ask of clients',
        paragraphs: [
          'Say in the brief whether AI processing beyond conventional retouching is contemplated. If a digital twin or synthetic variation is wanted, we will negotiate it openly — there are fair prices for these rights, and models who are happy to license them on fair terms. What sours relationships is discovery after the fact.',
          'For models, the guidance is one line: never sign a release with the words "in perpetuity, in all media, by any technology now known or hereafter devised" without your agency reading it first. That sentence was boilerplate once. It is not boilerplate any more.',
        ],
      },
    ],
  },
];

export const findArticle = (slug: string): JournalArticle | undefined =>
  journalArticles.find((a) => a.slug === slug);
