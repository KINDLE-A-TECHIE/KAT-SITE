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
  { href: "#schedule", label: "Schedule" },
  { href: "#faq", label: "FAQ" },
  { href: "/partners", label: "Partner with Us" },
];

export type TrackId = "explorers" | "builders" | "innovators";
export type WaitlistState = "idle" | "loading" | "success" | "error" | "offline";

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
    summary: "Playful coding basics with Scratch, animations, and simple logic games.",
    modules: [
      { title: "Block Coding and Logic", progress: 92 },
      { title: "Creative Story Projects", progress: 80 },
      { title: "Early Web Design", progress: 63 },
    ],
    project: "Build and share a mini interactive story game.",
  },
  {
    id: "builders",
    label: "Teen Builders",
    ages: "Ages 12–15",
    summary: "HTML, CSS, JavaScript, and Python projects focused on practical skills.",
    modules: [
      { title: "Frontend Fundamentals", progress: 85 },
      { title: "Python Foundations", progress: 74 },
      { title: "API and Team Projects", progress: 59 },
    ],
    project: "Launch a portfolio site and one API-powered app.",
  },
  {
    id: "innovators",
    label: "Future Innovators",
    ages: "Ages 16–19",
    summary: "Advanced engineering, product thinking, and mentorship leadership.",
    modules: [
      { title: "Fullstack Engineering", progress: 71 },
      { title: "Leadership and Mentorship", progress: 62 },
      { title: "Startup Problem Solving", progress: 49 },
    ],
    project: "Ship a community-impact product and mentor juniors.",
  },
];

export const FEATURES = [
  {
    title: "Live Coding Clubs",
    description: "Small group sessions where kids build games, apps, and websites with mentors guiding each step.",
    iconName: "Code2" as const,
    color: "bg-blue-500",
  },
  {
    title: "Safe Parent View",
    description: "Parents can track class attendance, learning streaks, and project progress from one simple view.",
    iconName: "Shield" as const,
    color: "bg-indigo-500",
  },
  {
    title: "Project-Based Learning",
    description: "Every track ships real projects so students learn by building, sharing, and improving in public.",
    iconName: "Layers3" as const,
    color: "bg-sky-500",
  },
  {
    title: "Mentor Feedback",
    description: "Instructors leave clear feedback, next steps, and motivation after each class challenge.",
    iconName: "Brain" as const,
    color: "bg-violet-500",
  },
  {
    title: "Community Challenges",
    description: "Weekly coding missions and friendly leaderboard moments keep kids and teens engaged.",
    iconName: "Flame" as const,
    color: "bg-orange-500",
  },
  {
    title: "Path to Fellowship",
    description: "Top learners move into leadership tracks where they mentor juniors and lead impact projects.",
    iconName: "Compass" as const,
    color: "bg-emerald-500",
  },
];

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Parent Registers & Enrolls",
    description: "A parent creates an account, selects the right age-matched track, and completes enrollment for their child.",
  },
  {
    step: "02",
    title: "Join Live Classes",
    description: "Your child attends small-group live sessions with dedicated mentors and builds something new every week.",
  },
  {
    step: "03",
    title: "Ship Real Projects",
    description: "Graduate each module by shipping a real project. Build a portfolio and grow into a community leader.",
  },
];

export const TESTIMONIALS = [
  {
    name: "Adaeze O.",
    role: "Parent of a Teen Builder",
    initials: "AO",
    quote:
      "My daughter went from 'coding is boring' to building her own portfolio site in 8 weeks. The mentors are phenomenal.",
    stars: 5,
  },
  {
    name: "Chukwuemeka A.",
    role: "Student, Future Innovators",
    initials: "CA",
    quote:
      "KAT gave me real skills, not just theory. I shipped my first API project and got accepted into a fellowship program.",
    stars: 5,
  },
  {
    name: "Funmilayo B.",
    role: "Parent of a Junior Explorer",
    initials: "FB",
    quote:
      "The parent dashboard is everything. I can see exactly what Temi is learning and how he's progressing each week.",
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
    question: "What age groups does KAT Learning accept?",
    answer:
      "KAT welcomes students aged 8 to 19. We have three tracks: Junior Explorers (8–11), Teen Builders (12–15), and Future Innovators (16–19). Each track is designed around the developmental stage and attention span of that age group.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Enrollment is paid on a per-cohort basis. A parent registers, selects a track, and completes payment to activate their child's access. Pricing is shown during registration. Scholarships are available — join the waitlist to hear about funded spots.",
  },
  {
    question: "What device does my child need?",
    answer:
      "Any laptop or desktop computer running a modern browser (Chrome, Firefox, Edge, or Safari) is sufficient. A stable internet connection is required for live classes. Tablets are supported for viewing but a keyboard is recommended for coding.",
  },
  {
    question: "How large are the class groups?",
    answer:
      "We keep sessions small — typically 6 to 12 students per group. This ensures every child gets individual attention from the mentor and has time to ask questions and share their work.",
  },
  {
    question: "Can parents see their child's progress?",
    answer:
      "Yes. Every parent account has a dedicated dashboard showing class attendance, submitted projects, assessment scores, and mentor feedback. You also receive a monthly progress email summary.",
  },
  {
    question: "What happens after a student completes a track?",
    answer:
      "Students who complete the Future Innovators track can apply for the KAT Fellowship Programme, where they transition from learners to mentors and lead real community-impact projects. Younger graduates move up to the next track.",
  },
];

export const SIDEBAR_ITEMS = ["My Classes", "Projects", "Challenges", "Messages", "Badges"];
