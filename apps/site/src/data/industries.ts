// The industries the site speaks to: the header's Industries menu, the /for index, one page per industry at
// /for/<slug>, and the footer's Industries column. Each one carries the words its customers actually type, so its
// page shows a real search rather than a generic one. Add an industry by adding a row; its page exists at once.
import type { LucideIcon } from "lucide-react";
import { Briefcase, Car, HeartPulse, Network, Scissors, ShoppingBag, UtensilsCrossed, Wrench } from "lucide-react";

export type Industry = {
  slug: string;
  /** Plural, as a menu item and a heading: "Plumbers". */
  name: string;
  /** Singular, inside a sentence: "plumber". */
  one: string;
  group: GroupId;
  /** What customers type into Google Maps, most common first. The first is the page's opening search. */
  keywords: [string, string, string, string];
  /** What a customer asks an AI assistant. */
  question: string;
  /** One line on why the map matters for this trade. */
  pitch: string;
};

export type GroupId = "home" | "health" | "professional" | "food" | "beauty" | "auto" | "retail" | "agencies";

export const groups: { id: GroupId; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home services", icon: Wrench },
  { id: "health", label: "Health and care", icon: HeartPulse },
  { id: "professional", label: "Professional services", icon: Briefcase },
  { id: "food", label: "Food and drink", icon: UtensilsCrossed },
  { id: "beauty", label: "Beauty and fitness", icon: Scissors },
  { id: "auto", label: "Automotive", icon: Car },
  { id: "retail", label: "Shops", icon: ShoppingBag },
  { id: "agencies", label: "Agencies and chains", icon: Network },
];

export const industries: Industry[] = [
  // Home services
  {
    slug: "plumbers",
    name: "Plumbers",
    one: "plumber",
    group: "home",
    keywords: ["plumber near me", "emergency plumber", "water heater repair", "drain cleaning"],
    question: "Who's a reliable emergency plumber near me?",
    pitch: "A burst pipe doesn't scroll. The three plumbers on the map get the call; everyone else gets nothing.",
  },
  {
    slug: "hvac",
    name: "HVAC companies",
    one: "HVAC company",
    group: "home",
    keywords: ["ac repair", "hvac near me", "furnace repair", "air conditioning installation"],
    question: "Which AC repair company near me can come today?",
    pitch: "The first hot week of summer decides your year. Be on the map in every neighbourhood you drive to.",
  },
  {
    slug: "electricians",
    name: "Electricians",
    one: "electrician",
    group: "home",
    keywords: ["electrician near me", "emergency electrician", "ev charger installation", "panel upgrade"],
    question: "Who's a licensed electrician near me for an EV charger?",
    pitch: "Customers pick from the three names Google shows them. See which streets show yours.",
  },
  {
    slug: "roofers",
    name: "Roofers",
    one: "roofer",
    group: "home",
    keywords: ["roofer near me", "roof repair", "roof replacement", "storm damage roof"],
    question: "What's the best roofing company near me after a storm?",
    pitch: "After a storm, homeowners call whoever ranks. Know where you rank before the next one.",
  },
  {
    slug: "landscapers",
    name: "Landscapers",
    one: "landscaper",
    group: "home",
    keywords: ["landscaping near me", "lawn care", "landscape design", "tree trimming"],
    question: "Who does good landscape design in my area?",
    pitch: "Your work is local by the street. Your ranking should be measured the same way.",
  },
  {
    slug: "cleaning-services",
    name: "Cleaning services",
    one: "cleaning service",
    group: "home",
    keywords: ["house cleaning", "cleaning service near me", "deep cleaning", "move out cleaning"],
    question: "What's a trustworthy house cleaning service near me?",
    pitch: "Trust is won in reviews and lost on the map. See both, for every area you clean.",
  },
  {
    slug: "pest-control",
    name: "Pest control",
    one: "pest control company",
    group: "home",
    keywords: ["pest control near me", "exterminator", "termite inspection", "bed bug treatment"],
    question: "Which exterminator near me treats termites?",
    pitch: "Nobody comparison-shops with mice in the kitchen. They call the first name on the map.",
  },
  {
    slug: "locksmiths",
    name: "Locksmiths",
    one: "locksmith",
    group: "home",
    keywords: ["locksmith near me", "emergency locksmith", "car lockout", "lock change"],
    question: "Who's a 24-hour locksmith near me?",
    pitch: "Locked out means searching from the doorstep. Rank on the streets where people get locked out.",
  },
  {
    slug: "movers",
    name: "Moving companies",
    one: "moving company",
    group: "home",
    keywords: ["movers near me", "moving company", "local movers", "piano movers"],
    question: "What's a well-reviewed local moving company?",
    pitch: "Movers are chosen on reviews and rank. Watch both, and the rivals sitting above you.",
  },
  // Health and care
  {
    slug: "dentists",
    name: "Dentists",
    one: "dentist",
    group: "health",
    keywords: ["dentist", "emergency dentist", "teeth whitening", "pediatric dentist"],
    question: "Who's a good family dentist near me taking new patients?",
    pitch: "New patients search from home and from work. See if they find you from both.",
  },
  {
    slug: "chiropractors",
    name: "Chiropractors",
    one: "chiropractor",
    group: "health",
    keywords: ["chiropractor near me", "back pain doctor", "sports chiropractor", "walk in chiropractor"],
    question: "Is there a chiropractor near me that takes walk-ins?",
    pitch: "Patients want someone close. Find out how close you need to be before Google stops showing you.",
  },
  {
    slug: "physical-therapy",
    name: "Physical therapy clinics",
    one: "physical therapy clinic",
    group: "health",
    keywords: ["physical therapy near me", "sports physio", "pelvic floor therapy", "knee rehab"],
    question: "Which physical therapy clinic near me is best for knee rehab?",
    pitch: "Referrals send people to search your name. Make sure the map agrees with the doctor.",
  },
  {
    slug: "med-spas",
    name: "Med spas",
    one: "med spa",
    group: "health",
    keywords: ["med spa near me", "botox", "lip filler", "laser hair removal"],
    question: "Where's a reputable med spa near me for Botox?",
    pitch: "Every treatment is its own search. See where you rank for each one, street by street.",
  },
  {
    slug: "veterinarians",
    name: "Veterinarians",
    one: "vet",
    group: "health",
    keywords: ["vet near me", "emergency vet", "cat vet", "pet vaccinations"],
    question: "What's the closest emergency vet open now?",
    pitch: "Pet owners drive past three vets to see the one they trust. Get found by the ones who don't know you yet.",
  },
  {
    slug: "optometrists",
    name: "Optometrists",
    one: "optometrist",
    group: "health",
    keywords: ["eye doctor near me", "optometrist", "eye exam", "contact lens exam"],
    question: "Where can I get an eye exam this week near me?",
    pitch: "An eye exam is booked from the map. See who is booked instead of you, and where.",
  },
  // Professional services
  {
    slug: "law-firms",
    name: "Law firms",
    one: "law firm",
    group: "professional",
    keywords: ["lawyer near me", "personal injury lawyer", "family lawyer", "estate planning attorney"],
    question: "Who's a good personal injury lawyer in my city?",
    pitch: "Clients ask Google and ChatGPT before they ask a friend. See what both say about your firm.",
  },
  {
    slug: "accountants",
    name: "Accountants",
    one: "accountant",
    group: "professional",
    keywords: ["accountant near me", "cpa", "tax preparation", "bookkeeper"],
    question: "Can you recommend a CPA near me for a small business?",
    pitch: "Tax season is a search season. Be on the map before it starts, not halfway through.",
  },
  {
    slug: "real-estate-agents",
    name: "Real estate agents",
    one: "real estate agent",
    group: "professional",
    keywords: ["realtor near me", "real estate agent", "homes for sale", "listing agent"],
    question: "Who are the top real estate agents in my neighbourhood?",
    pitch: "Sellers pick the agent who owns their neighbourhood. Show that you do, on the map.",
  },
  {
    slug: "insurance-agents",
    name: "Insurance agents",
    one: "insurance agent",
    group: "professional",
    keywords: ["insurance agent near me", "car insurance", "home insurance", "life insurance agent"],
    question: "Is there an independent insurance agent near me?",
    pitch: "Local agents win on being local. Prove it in every neighbourhood you serve.",
  },
  {
    slug: "financial-advisors",
    name: "Financial advisors",
    one: "financial advisor",
    group: "professional",
    keywords: ["financial advisor near me", "retirement planning", "fiduciary advisor", "wealth management"],
    question: "How do I find a fiduciary financial advisor near me?",
    pitch: "People ask AI assistants who to trust with their savings. Find out if they name you.",
  },
  // Food and drink
  {
    slug: "restaurants",
    name: "Restaurants",
    one: "restaurant",
    group: "food",
    keywords: ["restaurants near me", "brunch", "pizza delivery", "date night restaurant"],
    question: "Where should I go for brunch nearby this weekend?",
    pitch: "Diners decide in a minute, from the map. See which streets send them to you.",
  },
  {
    slug: "coffee-shops",
    name: "Coffee shops",
    one: "coffee shop",
    group: "food",
    keywords: ["coffee near me", "coffee shop", "cafe with wifi", "espresso bar"],
    question: "What's a good cafe nearby to work from?",
    pitch: "A coffee shop's customers come from five blocks. Know which five.",
  },
  {
    slug: "bakeries",
    name: "Bakeries",
    one: "bakery",
    group: "food",
    keywords: ["bakery near me", "custom cakes", "sourdough bread", "birthday cake"],
    question: "Where can I order a custom birthday cake near me?",
    pitch: "Special orders start with a search. Be the bakery it finds.",
  },
  {
    slug: "bars",
    name: "Bars and breweries",
    one: "bar",
    group: "food",
    keywords: ["bars near me", "brewery", "cocktail bar", "happy hour"],
    question: "What's a good cocktail bar nearby tonight?",
    pitch: "Tonight's plans are made on the map. Show up on it where people are heading out.",
  },
  {
    slug: "caterers",
    name: "Caterers",
    one: "caterer",
    group: "food",
    keywords: ["catering near me", "wedding catering", "corporate catering", "event catering"],
    question: "Who does corporate catering in my city?",
    pitch: "One booking is worth a week of walk-ins. Rank where the event planners search.",
  },
  // Beauty and fitness
  {
    slug: "hair-salons",
    name: "Hair salons",
    one: "hair salon",
    group: "beauty",
    keywords: ["hair salon near me", "balayage", "haircut", "hair colorist"],
    question: "Who's the best hair colorist near me?",
    pitch: "New clients pick a salon from the map and its photos. See where they pick someone else.",
  },
  {
    slug: "barbers",
    name: "Barbers",
    one: "barber",
    group: "beauty",
    keywords: ["barber near me", "barbershop", "fade haircut", "beard trim"],
    question: "Where can I get a good fade near me?",
    pitch: "A one-chair shop can beat a chain on its own street. See where you already do.",
  },
  {
    slug: "nail-salons",
    name: "Nail salons",
    one: "nail salon",
    group: "beauty",
    keywords: ["nail salon near me", "gel manicure", "pedicure", "acrylic nails"],
    question: "What's a clean, well-reviewed nail salon near me?",
    pitch: "There's a nail salon on every block. Be the one Google shows on yours.",
  },
  {
    slug: "gyms",
    name: "Gyms",
    one: "gym",
    group: "beauty",
    keywords: ["gym near me", "24 hour gym", "personal trainer", "crossfit"],
    question: "Which gym near me has the best classes?",
    pitch: "Members join the gym on their way to work. See which routes pass you on the map.",
  },
  {
    slug: "yoga-studios",
    name: "Yoga and pilates studios",
    one: "studio",
    group: "beauty",
    keywords: ["yoga near me", "hot yoga", "pilates studio", "reformer pilates"],
    question: "Is there a reformer pilates studio near me?",
    pitch: "Class-goers try the studio closest to them. Find out how far your 'closest' reaches.",
  },
  {
    slug: "spas",
    name: "Day spas",
    one: "spa",
    group: "beauty",
    keywords: ["spa near me", "massage", "facial", "couples massage"],
    question: "Where can I book a couples massage nearby?",
    pitch: "Gift bookings start with 'near me'. Be on the map where the gift-givers live.",
  },
  // Automotive
  {
    slug: "auto-repair",
    name: "Auto repair shops",
    one: "auto repair shop",
    group: "auto",
    keywords: ["auto repair near me", "mechanic", "brake repair", "oil change"],
    question: "Who's an honest mechanic near me?",
    pitch: "A breakdown is searched from wherever it happens. Rank on the roads around your bays.",
  },
  {
    slug: "car-dealerships",
    name: "Car dealerships",
    one: "dealership",
    group: "auto",
    keywords: ["car dealership near me", "used cars", "certified pre-owned", "car service center"],
    question: "Which dealership near me has the best service department?",
    pitch: "Buyers cross town for the right car. See how far across town your listing reaches.",
  },
  {
    slug: "auto-body",
    name: "Auto body shops",
    one: "body shop",
    group: "auto",
    keywords: ["auto body shop near me", "collision repair", "dent repair", "car paint"],
    question: "What's a good collision repair shop near me?",
    pitch: "Insurers suggest a shop; drivers check the map. Make sure it backs you up.",
  },
  {
    slug: "car-washes",
    name: "Car washes and detailing",
    one: "car wash",
    group: "auto",
    keywords: ["car wash near me", "car detailing", "hand car wash", "ceramic coating"],
    question: "Where's a good hand car wash near me?",
    pitch: "Drivers pick the wash on their way. Be on the map along the way.",
  },
  // Shops
  {
    slug: "florists",
    name: "Florists",
    one: "florist",
    group: "retail",
    keywords: ["florist near me", "flower delivery", "wedding flowers", "same day flowers"],
    question: "Which florist near me does same-day delivery?",
    pitch: "Flowers are searched for in a hurry. Be the first florist the hurry finds.",
  },
  {
    slug: "pet-stores",
    name: "Pet stores and groomers",
    one: "pet store",
    group: "retail",
    keywords: ["pet store near me", "dog groomer", "pet supplies", "dog daycare"],
    question: "Who's a gentle dog groomer near me?",
    pitch: "Pet owners shop where they walk. See which walks bring them to you.",
  },
  {
    slug: "bike-shops",
    name: "Bike shops",
    one: "bike shop",
    group: "retail",
    keywords: ["bike shop near me", "bike repair", "e-bike store", "bike tune up"],
    question: "Where can I get my bike repaired today?",
    pitch: "A flat tyre is a local search. Rank for it on the routes people ride.",
  },
  {
    slug: "jewelers",
    name: "Jewelers",
    one: "jeweler",
    group: "retail",
    keywords: ["jewelry store near me", "engagement rings", "watch repair", "custom jewelry"],
    question: "Which jeweler near me makes custom engagement rings?",
    pitch: "The biggest purchase of the year starts with a search. Know whether it starts with you.",
  },
  // Agencies and chains
  {
    slug: "marketing-agencies",
    name: "Marketing agencies",
    one: "agency",
    group: "agencies",
    keywords: ["dentist", "plumber near me", "hair salon", "auto repair"],
    question: "Who's the best dentist near me?",
    pitch: "Show every client their map, their AI answers and this week's fixes, under your own brand.",
  },
  {
    slug: "multi-location",
    name: "Franchises and chains",
    one: "location",
    group: "agencies",
    keywords: ["coffee near me", "gym near me", "urgent care", "oil change"],
    question: "What's the closest location open now?",
    pitch: "Every location gets its own grid, so you see the one that's slipping before its numbers do.",
  },
];

export const industryBySlug = (slug: string | undefined) => industries.find((i) => i.slug === slug);
export const inGroup = (id: GroupId) => industries.filter((i) => i.group === id);
export const groupOf = (i: Industry) => groups.find((g) => g.id === i.group)!;

/** The header menu's columns: two groups stacked in each, so the panel stays four columns wide. */
export const menuColumns: GroupId[][] = [["home"], ["health", "auto"], ["professional", "food"], ["beauty", "retail"]];

/** The footer's short list. */
export const featured = ["plumbers", "dentists", "law-firms", "restaurants", "hair-salons", "auto-repair"].map((s) => industryBySlug(s)!);
