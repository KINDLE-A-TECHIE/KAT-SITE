/*
 * Copy and structure for the landing page. NOT colour.
 *
 * This file used to export a DESIGN_TOKENS object that components applied as an inline
 * style. That made it a SECOND source of truth for the palette, and the two drifted:
 * the schools landing was written against warm tokens this file never defined, so it
 * rendered with invalid colours and looked like nothing had changed. The palette now
 * lives in exactly one place, `:root` in src/app/globals.css. Do not reintroduce a
 * token object here.
 */

/*
 * THE PRIMARY CALL-TO-ACTION BUTTON, one definition, both landing surfaces.
 *
 * The "stamped" clay button (square, a hard offset shadow, presses in on hover) is the
 * shared primary CTA for the whole marketing surface, the B2C kid site AND the B2B
 * schools site. It lived inline in three spots on the schools page and nowhere on the
 * kid site, so the two pages had visibly different buttons. Defining it ONCE here means
 * they stay identical and cannot drift, the same lesson as the palette.
 *
 * Two grounds, because an ink-coloured offset shadow is invisible on a dark section:
 *   STAMP_CTA        , on paper / light backgrounds (shadow = ink)
 *   STAMP_CTA_DARK   , on ink / pine dark backgrounds (shadow = sun)
 *   STAMP_CTA_SM     , compact header variant (smaller offset)
 *
 * Pass as `className` to a shadcn <Button> (twMerge lets bg-[var(--kat-clay)] win over
 * the default variant) or to a plain <Link>. These are class strings, not colour, the
 * hexes all resolve through the :root tokens guarded by the design-tokens test.
 */
const STAMP_BASE =
  "rounded-none bg-[var(--kat-clay)] font-semibold text-[var(--kat-paper)] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-[var(--kat-clay-deep)]";

export const STAMP_CTA =
  `${STAMP_BASE} shadow-[4px_4px_0_0_var(--kat-ink)] hover:shadow-[2px_2px_0_0_var(--kat-ink)]`;

export const STAMP_CTA_DARK =
  `${STAMP_BASE} shadow-[4px_4px_0_0_var(--kat-sun)] hover:shadow-[2px_2px_0_0_var(--kat-sun)]`;

export const STAMP_CTA_SM =
  `${STAMP_BASE} shadow-[3px_3px_0_0_var(--kat-ink)] hover:shadow-[1px_1px_0_0_var(--kat-ink)]`;

export const NAV_ITEMS = [
  { href: "#features", label: "Features" },
  { href: "#tracks", label: "Tracks" },
  { href: "#fellowship", label: "Fellowship" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "/schools", label: "For Schools" },
  { href: "/partners", label: "Partner with Us" },
];

export type TrackId = "explorers" | "builders" | "innovators";

export type ProgramTrack = {
  id: TrackId;
  label: string;
  ages: string;
  summary: string;
  modules: Array<{ title: string; progress: number }>;
  project: string;
};

export const PROGRAM_TRACKS: ProgramTrack[] = [
  {
    id: "explorers",
    label: "Junior Explorers",
    ages: "Ages 8–11",
    summary: "Your child starts from day one, building games, animations, and early robotics projects. We cover block coding, game development and creative technology. No experience needed.",
    modules: [
      { title: "Block Coding and Logic", progress: 92 },
      { title: "Game Design & Story Projects", progress: 80 },
      { title: "Early Web & Robotics Basics", progress: 63 },
    ],
    project: "Create and share an original interactive game or animated story, their very first real build.",
  },
  {
    id: "builders",
    label: "Teen Builders",
    ages: "Ages 12–15",
    summary: "Real skills across multiple disciplines: HTML, CSS, JavaScript, Python, UI/UX design, and game development. Every module ends with something they can actually show off to friends and family.",
    modules: [
      { title: "Frontend & UI/UX Fundamentals", progress: 85 },
      { title: "Python & Game Development", progress: 74 },
      { title: "API and Team Projects", progress: 59 },
    ],
    project: "Ship a live portfolio site, one API-powered app, and a designed UI prototype, all built from scratch.",
  },
  {
    id: "innovators",
    label: "Future Innovators",
    ages: "Ages 16–19",
    summary: "Fullstack engineering, artificial intelligence, computer science, and product leadership. For teens who want to build things that matter, and lead others doing the same.",
    modules: [
      { title: "Fullstack Engineering & AI", progress: 71 },
      { title: "Leadership and Mentorship", progress: 62 },
      { title: "Computer Science & Startup Thinking", progress: 49 },
    ],
    project: "Ship a community-impact product powered by real technology, present it publicly, and mentor younger students along the way.",
  },
];

/*
 * No per-card `color`. The six-hue icon-chip grid was the most template-like thing on
 * the page; the grid is now flat and monochrome, and the palette's energy is spent in
 * one place (the build-log marquee).
 */
export const FEATURES = [
  {
    title: "Live Tech Classes",
    description: "1-on-1 live sessions with a dedicated mentor in coding, robotics, AI, UI/UX design, and game development. No recorded videos. Your child builds something in every session.",
    iconName: "Code2" as const,
  },
  {
    title: "Parent Visibility",
    description: "See your child's attendance, current project, and mentor feedback, without having to ask them. It is all on one dashboard.",
    iconName: "Shield" as const,
  },
  {
    title: "Build Real Projects",
    description: "No textbook exercises. Students build games, apps, websites, robots, and UI designs, Real work they can show anyone.",
    iconName: "Layers3" as const,
  },
  {
    title: "Mastery-Based Learning",
    description: "Students advance by demonstrating real understanding through assessments, projects and instructor reviews. Attendance alone does not advance them.",
    iconName: "Brain" as const,
  },
  {
    title: "Weekly Challenges",
    description: "Coding missions, friendly leaderboards, and peer shoutouts give students something to aim for each week.",
    iconName: "Flame" as const,
  },
  {
    title: "Path to Fellowship",
    description: "The best learners go on to become KAT Fellows. They mentor juniors, lead impact projects and build something of their own.",
    iconName: "Compass" as const,
  },
];

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Sign Up & Pick a Track",
    description: "Create a parent account in minutes, choose the age-matched track for your child, and complete enrollment. They get access the same day.",
  },
  {
    step: "02",
    title: "Learn Live with Expert Mentors",
    description: "1-on-1 live sessions with a dedicated mentor. Hands-on training in coding, robotics, AI, design, or game development, 2 sessions every week.",
  },
  {
    step: "03",
    title: "Build, Ship & Show Off",
    description: "Every module ends with a real project. Students grow their portfolio, earn badges, and can become leaders who mentor others.",
  },
];

/*
 * The invented TESTIMONIALS / SCHEDULE_ROWS / SIDEBAR_ITEMS arrays that used to live
 * here are deleted, not commented out. "Adaeze O., Lagos" was never a real parent, and
 * a fabricated quote on a page selling a service to parents of children is exactly the
 * generic-template failure this redesign exists to fix. Every human on this page now
 * comes from the database or the section hides itself. See getRealBuilds() in
 * src/app/page.tsx and the APPROVED-testimonial query beside it.
 */

export type PricingTier = {
  id: string;
  label: string;
  ages: string;
  monthlyLabel: string;
  billingNote: string;
  highlight: boolean;
  includes: string[];
  cta: string;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "explorers",
    label: "Junior Explorers",
    ages: "Ages 8–11",
    monthlyLabel: "Register to see pricing",
    billingNote: "Billed monthly",
    highlight: false,
    includes: [
      "2 live 1-on-1 classes per week",
      "Block coding, game development & robotics basics",
      "Weekly project assignments",
      "Parent progress dashboard",
      "Mentor feedback on every submission",
      "Certificate on track completion",
    ],
    cta: "Enroll My Child",
  },
  {
    id: "builders",
    label: "Teen Builders",
    ages: "Ages 12–15",
    monthlyLabel: "Register to see pricing",
    billingNote: "Billed monthly",
    highlight: true,
    includes: [
      "2 live 1-on-1 classes per week",
      "HTML, CSS, JavaScript, Python & UI/UX design",
      "Game development & portfolio capstone",
      "Parent progress dashboard",
      "1-on-1 mentor review sessions",
      "Fellowship application eligibility",
      "Certificate on track completion",
    ],
    cta: "Enroll My Child",
  },
  {
    id: "innovators",
    label: "Future Innovators",
    ages: "Ages 16–19",
    monthlyLabel: "Register to see pricing",
    billingNote: "Billed monthly",
    highlight: false,
    includes: [
      "2 live 1-on-1 classes per week",
      "Fullstack engineering, AI & computer science",
      "Community-impact capstone project",
      "Parent progress dashboard",
      "Priority mentor pairing",
      "Fellowship track access",
      "LinkedIn-ready portfolio review",
      "Certificate on track completion",
    ],
    cta: "Enroll My Child",
  },
];

export const FAQ_ITEMS = [
  {
    question: "My child has never coded before. Will they keep up?",
    answer:
      "Absolutely. Junior Explorers and Teen Builders are built from zero, no prior experience needed. Our mentors are trained to make the first few sessions fun and pressure-free. Most kids are building something they're proud of within the first two weeks.",
  },
  {
    question: "What subjects does KAT teach?",
    answer:
      "KAT covers coding, robotics, artificial intelligence, UI/UX design, game development, and computer science. Subjects are introduced progressively, younger students explore block coding, game design, and creative technology; teens move into web development, Python, and UI/UX; older students tackle fullstack engineering, AI, and computer science leadership.",
  },
  {
    question: "What ages do you accept?",
    answer:
      "KAT welcomes students aged 8 to 19 across Africa. Three age-matched tracks: Junior Explorers (8–11), Teen Builders (12–15), and Future Innovators (16–19). Each track is paced around the learning style and energy of that age group.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Enrollment is billed monthly per track. A parent registers, selects the right track, and pays to activate their child's access. Exact pricing is shown at registration. Scholarship spots are available every cohort, apply and mention financial support needs.",
  },
  {
    question: "How many kids are in each class?",
    answer:
      "Every session is 1-on-1, your child and their dedicated mentor, no one else. That means full attention, real-time feedback on their work, and a pace that's matched entirely to them.",
  },
  {
    question: "Can I see what my child is learning?",
    answer:
      "Yes, every parent account includes a full dashboard: class attendance, project submissions, assessment scores, and what their mentor said. You'll always know exactly how your child is progressing.",
  },
  {
    question: "What device does my child need?",
    answer:
      "Any laptop or desktop with a modern browser (Chrome, Firefox, Edge, or Safari) works great. A stable internet connection is required for live classes. Tablets can be used for viewing, but a physical keyboard is strongly recommended for writing code.",
  },
  {
    question: "What happens when they finish a track?",
    answer:
      "Younger students move up to the next track when they're ready. Students who complete Future Innovators are eligible for the KAT Fellowship, transitioning from learner to mentor, leading real community-impact projects.",
  },
  {
    question: "Does KAT run any physical or in-person events?",
    answer:
      "Yes. While the core learning programme is online, KAT also runs bootcamps, hackathons, and school partnership programmes that can be delivered physically, virtually, or in a hybrid format depending on the partner and location. These events complement the online curriculum with hands-on, real-world experiences.",
  },
];

export const EVENTS = [
  {
    title: "Bootcamps",
    description:
      "Intensive multi-day sprints where students build and ship real projects under close mentor guidance. Ideal for students ready to accelerate fast.",
    modes: ["Physical", "Virtual", "Hybrid"] as const,
    iconName: "Rocket" as const,
  },
  {
    title: "Hackathons",
    description:
      "Team-based competitions where students tackle real-world challenges, present solutions, and compete for recognition across schools and regions.",
    modes: ["Physical", "Virtual", "Hybrid"] as const,
    iconName: "Trophy" as const,
  },
  {
    title: "School Programmes",
    description:
      "Coding clubs, tech labs, and after-school programmes delivered inside partner schools, with KAT mentors, curriculum, and tools included.",
    modes: ["Physical", "Hybrid"] as const,
    iconName: "School" as const,
  },
];


/**
 * A real, APPROVED student build, shown in the landing marquee.
 *
 * Real records only. If there are none, the band does not render. Nothing is ever invented.
 */
export type Build = {
  id: string;
  firstName: string;
  title: string;
  program?: string | null;
  /** Real cover image of the shipped project (R2 URL). Null when the student uploaded none. */
  imageUrl?: string | null;
};
