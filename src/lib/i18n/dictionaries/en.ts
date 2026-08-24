// English copy. Typed against the Indonesian dictionary, so a key added to
// id.ts without a counterpart here is a build error.
//
// This is the /en tree — it exists so non-Indonesian speakers (and the
// international "split bill app" query space) have something to land on, but
// Indonesian remains the canonical x-default.

import type { Dictionary } from "./id";

export const en: Dictionary = {
  languageName: "English",
  switchTo: "Bahasa Indonesia",

  meta: {
    home: {
      title: "Splitzy — Split Bills & Share Expenses Fairly",
      description:
        "Splitzy splits shared bills fairly. AI reads your receipt — tap who had what — see exactly who owes whom in the fewest transfers. Free, no sign-up needed.",
    },
    about: {
      title: "About Splitzy — What It Is and How It Works",
      description:
        "What Splitzy is, how it calculates each person's share, and the principles behind it: bill splitting that is fair, auditable, private, and free at its core.",
    },
    faq: {
      title: "Splitzy Frequently Asked Questions",
      description:
        "Full answers about Splitzy: whether it is free, whether you need an account, data safety, how the split is calculated, multi-currency trips, and Splitzy Pro.",
    },
    single: {
      title: "Split a Single Receipt — Itemised Bill Splitting",
      description:
        "Split one dining bill or shared expense. Add participants, scan the receipt, and Splitzy works out each person's share including tax, service, and discounts.",
    },
    multiple: {
      title: "Split Multiple Receipts — Different Payers, One Settle-Up",
      description:
        "Track several receipts with different payers, then settle everything at once. Splitzy nets all the debts down to the fewest transfers.",
    },
    travel: {
      title: "Track Trip Expenses — Multi-Currency Travel Bill Splitting",
      description:
        "Log every expense across a multi-day trip in any currency. See budget vs spent and who owes whom, at any time.",
    },
  },

  nav: {
    about: "About",
    faq: "FAQ",
    pricing: "Pricing",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    support: "Support",
    home: "Home",
  },

  og: {
    subline: "Scan the receipt · Fewest transfers · Free, no sign-up",
  },

  header: {
    tagline: "Split Bills Easily",
    howItWorks: "How it works",
    pricing: "Pricing",
  },

  preview: {
    summary: "Summary",
    context: "Dinner · 4 people",
    payer: "Payer",
    settleUp: "Settle up",
    settled: "Settled in just 2 transfers",
  },

  hero: {
    badge: "Don’t be the unpaid friend",
    titleAccent: "Split the bill.",
    titleRest: "Settle in seconds.",
    leadBefore:
      "Dining out or travelling with friends? Scan the receipt, tap who had what, and Splitzy works out exactly who owes whom — in the ",
    leadHighlight: "fewest transfers possible",
    leadAfter: ".",
    ctaPrimary: "Split a bill — free",
    ctaSecondary: "Track a trip",
    note: "Free to start · No sign-up needed · Your data stays private",
  },

  stats: {
    labels: [
      "bills split",
      "settled between friends",
      "transfers saved",
      "average rating",
    ],
  },

  problem: {
    eyebrow: "The awkward part of going out",
    heading: "“Just send me whatever” never actually works.",
    body: "Someone always covers the bill. Then come the forgotten IOUs, the group-chat math, and the friend who quietly never pays. Splitzy makes the number exact and the payback obvious — so money never gets between friends.",
  },

  features: {
    scan: {
      eyebrow: "AI receipt scanning",
      title: "Snap the receipt. Skip the typing.",
      body: "Point your camera at the receipt and Splitzy reads the items, prices, tax, and service for you.",
      points: [
        "Works with photos or uploads",
        "Auto-detects tax, service & currency",
        "Edit anything before you split",
      ],
    },
    settle: {
      eyebrow: "Smart settlement",
      title: "The fewest transfers, worked out for you.",
      body: "No more everyone-pays-everyone. Splitzy nets out the debts into the smallest set of transfers.",
      points: [
        "Nets multiple receipts & payers together",
        "Mark transfers as paid to track settle-up",
        "Every amount is auditable, down to the item",
      ],
    },
    travel: {
      eyebrow: "Travel Spend",
      title: "A whole trip, one clear balance.",
      body: "Log every expense across a multi-day trip, in any currency, and always know who owes whom.",
      points: [
        "Multi-currency with locked exchange rates",
        "Budget vs spent, per trip and per person",
        "Invite friends & share a read-only summary",
      ],
    },
  },

  featureVisuals: {
    scanning: "Scanning receipt…",
    itemsDetected: "4 items detected",
    messyTransfers: "6 messy transfers",
    tripName: "Bali Trip",
    spent: "Spent",
    budgetLeft: "Rp 760.000 left in budget",
  },

  steps: {
    eyebrow: "How it works",
    heading: "Three simple steps",
    items: [
      {
        title: "Add participants",
        body: "Enter everyone who’s splitting the bill.",
      },
      {
        title: "Scan or add items",
        body: "Snap the receipt — AI reads it — or type items in.",
      },
      {
        title: "See who owes whom",
        body: "Get the fewest transfers needed to settle up.",
      },
    ],
  },

  modes: {
    eyebrow: "Pick your flow",
    heading: "One app, three ways to split",
    badgePopular: "POPULAR",
    badgeNew: "NEW",
    items: [
      {
        title: "Single Receipt",
        body: "Split one dining bill or any shared expense with friends.",
        cta: "Start splitting",
      },
      {
        title: "Multiple Receipts",
        body: "Track several receipts with different payers and settle up together.",
        cta: "Start splitting",
      },
      {
        title: "Travel Spend",
        body: "Log expenses across a whole trip and see who owes whom, anytime.",
        cta: "Start a trip",
      },
    ],
  },

  proof: {
    eyebrow: "Why people trust it",
    heading: "Built to be fair, private, and free",
    items: [
      {
        title: "Start in seconds",
        body: "No account needed to split your first bills — just open and go.",
      },
      {
        title: "Private by default",
        body: "Split as a guest and your data stays on your device. Sign in only to sync.",
      },
      {
        title: "Math you can audit",
        body: "Every rupiah is traceable — expand any person to see exactly how their share was built.",
      },
      {
        title: "Free forever core",
        body: "Splitting bills is free, always. Pro only adds unlimited AI scans.",
      },
    ],
  },

  testimonials: {
    eyebrow: "Loved by groups",
    heading: "What people are saying",
    starLabel: "5 out of 5 stars",
    items: [
      {
        quote:
          "No more spreadsheet after every group dinner. I scan the receipt and everyone knows what they owe in seconds.",
        name: "Rani P.",
        role: "Jakarta",
        initial: "R",
      },
      {
        quote:
          "We used it for a 5-day Bali trip with 6 people and 3 currencies. It untangled everything into two transfers.",
        name: "Arif H.",
        role: "Bandung",
        initial: "A",
      },
      {
        quote:
          "Finally something that handles tax and service correctly. No more arguing about who pays what.",
        name: "Sinta W.",
        role: "Surabaya",
        initial: "S",
      },
    ],
  },

  pricing: {
    eyebrow: "Simple, honest pricing",
    heading: "Everything you need is free",
    lead: "Upgrade only if you want unlimited AI receipt scans. No subscription trap — Pro is a one-time payment you renew whenever you like.",
    freePriceLabel: "Free",
    freePriceSuffix: "forever",
    perDays: "days",
    mostPopular: "MOST POPULAR",
    freeCta: "Start splitting",
    proCta: "See pricing",
    freeFeatures: [
      "Split single & multiple receipts",
      "Travel Spend trips",
      "15 AI receipt scans per month",
      "Receipt history synced across devices",
    ],
    proFeatures: [
      "Everything in Free",
      "Unlimited AI receipt scans",
      "Priority AI processing",
      "Support the project 💚",
    ],
  },

  faq: {
    eyebrow: "Questions",
    heading: "Everything you might be wondering",
    seeAll: "See all questions",
    items: [
      {
        q: "Is Splitzy really free?",
        a: "Yes. Splitting single bills, multiple receipts, and whole trips is free forever. Pro (Rp 29.000 / 30 days) only lifts the AI-scan limit — everything else stays free.",
      },
      {
        q: "Do I need an account?",
        a: "No. You can split your first bills as a guest with nothing to sign up for. Sign in with Google only when you want your receipt history synced across devices.",
      },
      {
        q: "Is my data safe?",
        a: "As a guest, your splits live on your own device. When you sign in, your history syncs to your account and is never sold or shared. See our Privacy Policy for details.",
      },
      {
        q: "How accurate is the split?",
        a: "Each item is divided only among the people who shared it, then tax, service, and discounts are scaled proportionally. You can expand any person to audit the exact breakdown.",
      },
      {
        q: "Can it handle different payers and currencies?",
        a: "Yes. Multiple Receipts supports different payers per receipt, and Travel Spend handles multi-currency trips with locked exchange rates and minimal-transfer settlement.",
      },
    ],
  },

  finalCta: {
    badge: "Ready to settle the tab?",
    headingBefore: "Stop doing math. Start splitting ",
    headingAccent: "fairly.",
    lead: "Free to use — sign in only to save your splits & history.",
    cta: "Get started free",
  },

  footer: {
    rights: "All rights reserved.",
  },

  about: {
    heading: "About Splitzy",
    lead: "Splitzy is a web app for splitting shared bills fairly — built for how people actually eat out and travel together.",
    sections: [
      {
        heading: "The problem we solve",
        body: "Every group meal ends the same way: one person covers the bill, then everyone tries to remember who ordered what. Tax and service get split evenly even though the orders were nothing alike. Someone overpays, and someone quietly never transfers. Splitzy removes that part — you enter what was ordered, and the number becomes exact.",
      },
      {
        heading: "How Splitzy calculates",
        body: "Each item is divided only among the people who actually shared it. Tax, service, and discounts are then scaled in proportion to each person's subtotal, rather than split evenly per head. Finally, all the debts between people are netted down to the fewest possible transfers, so six messy transfers can collapse into two. Every amount can be expanded down to the item, so nobody has to take it on trust.",
      },
      {
        heading: "Three ways to use it",
        body: "Single Receipt for one dining bill. Multiple Receipts when there are several receipts with different payers to settle at once. Travel Spend for multi-day trips with multiple currencies, a budget, and members you can invite.",
      },
      {
        heading: "Our principles",
        body: "The core is free forever — splitting a bill should not cost money. Private by default: as a guest, your splits never leave your device, and we never sell anyone's data. Auditable math, not a black box. And no subscription trap: Splitzy Pro is a one-time payment for 30 days that you renew yourself only if you still need it.",
      },
      {
        heading: "The technology behind it",
        body: "Splitzy runs as a web app, so there is nothing to install — just open it in your phone or laptop browser. Receipt scanning uses an AI model to read items, prices, tax, and service from a photo, and you can always correct the result before splitting. Optional sign-in uses your Google account.",
      },
    ],
    contactHeading: "Contact us",
    contactBody: "Questions, feedback, or found a bug? Email us at",
    ctaHeading: "Try it now",
    ctaBody: "No sign-up required. Open it and split your first bill.",
    cta: "Split a bill — free",
  },

  faqPage: {
    heading: "Frequently asked questions about Splitzy",
    lead: "Everything people usually ask before and after using Splitzy. If your answer isn't here, email us.",
    groups: [
      {
        heading: "The basics",
        items: [
          {
            q: "What is Splitzy?",
            a: "Splitzy is a free web app for splitting shared bills. You enter the items from a receipt — or photograph it and let AI read it — mark who had what, and Splitzy works out each person's share and who needs to transfer to whom.",
          },
          {
            q: "Is Splitzy really free?",
            a: "Yes. Splitting single receipts, multiple receipts, and a whole trip's expenses is free forever. Splitzy Pro at Rp 29.000 for 30 days only lifts the limit on AI receipt scans — every other feature stays free and unlimited.",
          },
          {
            q: "Do I need to download an app?",
            a: "No. Splitzy runs directly in your browser, on phone or laptop. You can add it to your home screen so it behaves like a normal app, but there is nothing to install from an app store.",
          },
          {
            q: "Do I need an account?",
            a: "Not to get started. You can split bills as a guest without signing up. Signing in with Google is only needed if you want your receipt history saved and synced across devices, or want to invite friends to a trip.",
          },
        ],
      },
      {
        heading: "How the calculation works",
        items: [
          {
            q: "How accurate is Splitzy's split?",
            a: "Each item is divided only among the people who marked themselves as sharing it. Once all items are divided, tax, service charge, and discounts are scaled in proportion to each person's subtotal — not split evenly per head. You can expand any person's breakdown to see exactly how their number was built.",
          },
          {
            q: "How does Splitzy find the fewest transfers?",
            a: "Once it knows who paid what and who owes what, Splitzy cancels out debts that offset each other, then arranges the remainder into as few transfers as possible. For a group of six this often cuts a dozen transfers down to two or three.",
          },
          {
            q: "Can different people pay for different receipts?",
            a: "Yes. Multiple Receipts is built for exactly that — each receipt has its own payer, and Splitzy settles them all as one combined calculation.",
          },
          {
            q: "What about discounts, promos, or vouchers?",
            a: "Discounts can be entered and are treated proportionally, just like tax and service, so the saving lands in line with each person's share of the spend.",
          },
          {
            q: "Can it handle several currencies at once?",
            a: "Yes, in Travel Spend. Each expense is recorded in its original currency with the exchange rate locked at the time, then everything converts to the trip's base currency for the final settlement.",
          },
        ],
      },
      {
        heading: "AI receipt scanning",
        items: [
          {
            q: "How does receipt scanning work?",
            a: "You photograph the receipt or upload an image, and an AI model reads the item names, prices, tax, service, and currency. The result lands in a table you can edit completely before splitting, so anything misread is easy to fix.",
          },
          {
            q: "How many receipts can I scan?",
            a: "Free accounts get 15 AI scans per month. If you need more, Splitzy Pro removes that limit. Entering items by hand is always unlimited.",
          },
          {
            q: "Which receipts scan best?",
            a: "Bright, straight photos that include the whole receipt give the best results. Crumpled, folded, or very faded receipts may need a little manual correction.",
          },
        ],
      },
      {
        heading: "Privacy & data",
        items: [
          {
            q: "Is my data safe?",
            a: "If you use Splitzy as a guest, your splits stay on your own device and are not sent to any account. If you sign in, your history syncs to your account. In both cases we never sell or share your data with third parties.",
          },
          {
            q: "What happens to my receipt photos?",
            a: "Receipt photos are processed to extract their data, not kept as a gallery. The Privacy Policy sets out the details.",
          },
          {
            q: "Can I delete my data?",
            a: "Yes. Receipts and trips can be deleted from your history. For full account deletion, contact us at the support email.",
          },
        ],
      },
      {
        heading: "Splitzy Pro & payment",
        items: [
          {
            q: "What do I get with Splitzy Pro?",
            a: "Pro lifts the 15-scans-per-month AI limit to unlimited, gives AI processing priority, and supports Splitzy's development. All the bill-splitting features themselves are already free without Pro.",
          },
          {
            q: "Is Pro an automatic subscription?",
            a: "No. Pro is a one-time Rp 29.000 payment that grants 30 days of access. There is no automatic charge — if you want to continue, you pay again when you actually need it.",
          },
          {
            q: "How does payment work?",
            a: "Payments are processed through a third-party payment provider supporting common Indonesian payment methods. Splitzy does not store your card or bank details.",
          },
        ],
      },
    ],
    stillStuckHeading: "Still not answered?",
    stillStuckBody: "Send your question to",
  },
};
