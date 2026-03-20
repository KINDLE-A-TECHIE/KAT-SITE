import type { CSSProperties } from "react";

export const DESIGN_TOKENS = {
  "--kat-deep-navy": "#132B5E",
  "--kat-primary-blue": "#1E5FAF",
  "--kat-accent-sky": "#4DB3E6",
  "--kat-gradient": "linear-gradient(90deg, #1E5FAF, #4DB3E6)",
  "--kat-bg": "#F5F7FA",
  "--kat-surface": "#FFFFFF",
  "--kat-text-primary": "#0F172A",
  "--kat-text-secondary": "#64748B",
  "--kat-border": "#E2E8F0",
  "--kat-success": "#16A34A",
  "--kat-warning": "#F59E0B",
  "--kat-danger": "#DC2626",
} as CSSProperties;

export const NAV_ITEMS = [
  { href: "#features", label: "Features" },
  { href: "#tracks", label: "Tracks" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
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
    summary: "Your child starts coding from day one — building games, animations, and interactive stories. Zero boredom. Maximum curiosity. No experience needed.",
    modules: [
      { title: "Block Coding and Logic", progress: 92 },
      { title: "Creative Story Projects", progress: 80 },
      { title: "Early Web Design", progress: 63 },
    ],
    project: "Create and share an original interactive story or mini game — their very first real build.",
  },
  {
    id: "builders",
    label: "Teen Builders",
    ages: "Ages 12–15",
    summary: "Real skills: HTML, CSS, JavaScript, and Python. Every module ends with something they can actually show off to friends and family.",
    modules: [
      { title: "Frontend Fundamentals", progress: 85 },
      { title: "Python Foundations", progress: 74 },
      { title: "API and Team Projects", progress: 59 },
    ],
    project: "Ship a live portfolio site and one API-powered app they built from scratch.",
  },
  {
    id: "innovators",
    label: "Future Innovators",
    ages: "Ages 16–19",
    summary: "Full-stack engineering, product thinking, and leadership. For teens who want to build things that matter — and lead others doing the same.",
    modules: [
      { title: "Fullstack Engineering", progress: 71 },
      { title: "Leadership and Mentorship", progress: 62 },
      { title: "Startup Problem Solving", progress: 49 },
    ],
    project: "Ship a community-impact product, present it publicly, and mentor younger students along the way.",
  },
];

export const FEATURES = [
  {
    title: "Live Coding Clubs",
    description: "Small groups of 6–12 kids building real games and apps with a mentor in the room. Not videos. Not passive watching. Actual code, every session.",
    iconName: "Code2" as const,
    color: "bg-blue-500",
  },
  {
    title: "Parent Visibility",
    description: "See your child's attendance, current project, and mentor feedback — without having to ask them. Full clarity, one simple dashboard.",
    iconName: "Shield" as const,
    color: "bg-indigo-500",
  },
  {
    title: "Build Real Projects",
    description: "No textbook exercises. Every module ends with something students actually shipped — games, websites, and apps they can show anyone.",
    iconName: "Layers3" as const,
    color: "bg-sky-500",
  },
  {
    title: "Personal Mentor Feedback",
    description: "After every submission, mentors leave personalised notes — what they nailed, what to fix, and exactly what to tackle next.",
    iconName: "Brain" as const,
    color: "bg-violet-500",
  },
  {
    title: "Weekly Challenges",
    description: "Coding missions, friendly leaderboards, and peer shoutouts give students something exciting to race toward every single week.",
    iconName: "Flame" as const,
    color: "bg-orange-500",
  },
  {
    title: "Path to Fellowship",
    description: "The best learners don't just graduate — they become KAT Fellows, mentoring juniors, leading impact projects, and building their own legacy.",
    iconName: "Compass" as const,
    color: "bg-emerald-500",
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
    title: "Your Child Codes Live",
    description: "Small groups of 6–12 students. A dedicated mentor every week. Real code from the very first session — no boring intro lectures.",
  },
  {
    step: "03",
    title: "Build, Ship & Show Off",
    description: "Every module ends with a real project. Students grow their portfolio, earn badges, and can become leaders who mentor others.",
  },
];

export const TESTIMONIALS = [
  {
    name: "Adaeze O.",
    role: "Parent of a Teen Builder",
    location: "Lagos, Nigeria",
    initials: "AO",
    quote:
      "My daughter went from 'coding is boring' to building her own portfolio site in 8 weeks. The mentors genuinely care — it shows.",
    stars: 5,
  },
  {
    name: "Chukwuemeka A.",
    role: "Student, Future Innovators",
    location: "Abuja, Nigeria",
    initials: "CA",
    quote:
      "KAT taught me real skills, not just theory. I shipped my first API project, built a portfolio, and got accepted into a fellowship — all in one year.",
    stars: 5,
  },
  {
    name: "Funmilayo B.",
    role: "Parent of a Junior Explorer",
    location: "Port Harcourt, Nigeria",
    initials: "FB",
    quote:
      "The parent dashboard is everything. I can see exactly what Temi is working on, how he scored, and what his mentor said — every single week.",
    stars: 5,
  },
];

export const SCHEDULE_ROWS = [
  { day: "Monday", className: "Web Design Studio", level: "Builders", time: "4:00 PM WAT", status: "Open" as const },
  { day: "Wednesday", className: "Python Mission Lab", level: "Innovators", time: "5:00 PM WAT", status: "Few Seats" as const },
  { day: "Friday", className: "Game Jam for Juniors", level: "Explorers", time: "3:30 PM WAT", status: "Open" as const },
  { day: "Saturday", className: "Mentor Office Hours", level: "All Tracks", time: "10:00 AM WAT", status: "Live" as const },
];

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
    billingNote: "Billed monthly · Cancel anytime",
    highlight: false,
    includes: [
      "3 live classes per week",
      "Block coding & web design modules",
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
    billingNote: "Billed monthly · Cancel anytime",
    highlight: true,
    includes: [
      "3 live classes per week",
      "HTML, CSS, JavaScript & Python",
      "Portfolio project capstone",
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
    billingNote: "Billed monthly · Cancel anytime",
    highlight: false,
    includes: [
      "4 live classes per week",
      "Fullstack engineering & leadership",
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
      "Absolutely. Junior Explorers and Teen Builders are built from zero — no prior experience needed. Our mentors are trained to make the first few sessions fun and pressure-free. Most kids are building something they're proud of within the first two weeks.",
  },
  {
    question: "What ages do you accept?",
    answer:
      "KAT welcomes students aged 8 to 19 across Africa. Three age-matched tracks: Junior Explorers (8–11), Teen Builders (12–15), and Future Innovators (16–19). Each track is paced around the learning style and energy of that age group.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Enrollment is billed monthly per track. A parent registers, selects the right track, and pays to activate their child's access. Exact pricing is shown at registration. Scholarship spots are available every cohort — apply and mention financial support needs.",
  },
  {
    question: "How many kids are in each class?",
    answer:
      "We cap every session at 6 to 12 students. That's intentional — it means your child gets direct mentor attention, space to ask questions, and feedback on their actual work, not just a passive lecture.",
  },
  {
    question: "Can I see what my child is learning?",
    answer:
      "Yes — every parent account includes a full dashboard: class attendance, project submissions, assessment scores, and what their mentor said. You'll always know exactly how your child is progressing.",
  },
  {
    question: "What device does my child need?",
    answer:
      "Any laptop or desktop with a modern browser (Chrome, Firefox, Edge, or Safari) works great. A stable internet connection is required for live classes. Tablets can be used for viewing, but a physical keyboard is strongly recommended for writing code.",
  },
  {
    question: "What happens when they finish a track?",
    answer:
      "Younger students move up to the next track when they're ready. Students who complete Future Innovators are eligible for the KAT Fellowship — transitioning from learner to mentor, leading real community-impact projects.",
  },
];

export const SIDEBAR_ITEMS = ["My Classes", "Projects", "Challenges", "Messages", "Badges"];
