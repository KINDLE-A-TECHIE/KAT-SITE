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
    description: "Create a parent account, pick the right age-matched track, and complete enrollment. Your child gets access the same day.",
  },
  {
    step: "02",
    title: "Your Child Joins Live Classes",
    description: "Small groups of 6–12 students. A dedicated mentor every week. Real coding, real feedback — from day one.",
  },
  {
    step: "03",
    title: "Build, Ship & Grow",
    description: "Every module ends with a real project. Students build portfolios, earn badges, and grow into community leaders.",
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
    question: "What ages does KAT Learning accept?",
    answer:
      "KAT welcomes students aged 8 to 19 across Africa. We have three age-matched tracks: Junior Explorers (8–11), Teen Builders (12–15), and Future Innovators (16–19). Each track is designed around the learning style and attention span of that age group.",
  },
  {
    question: "How is pricing structured?",
    answer:
      "Enrollment is billed monthly per track. A parent registers, selects a track for their child, and pays to activate access. Exact pricing is displayed during registration. Scholarship spots are available every cohort — join the waitlist and mention scholarships when you sign up.",
  },
  {
    question: "What device does my child need?",
    answer:
      "Any laptop or desktop with a modern browser (Chrome, Firefox, Edge, or Safari) works perfectly. A stable internet connection is required for live classes. Tablets can be used for viewing, but a physical keyboard is strongly recommended for coding exercises.",
  },
  {
    question: "How many students are in each class?",
    answer:
      "We cap each session at 6 to 12 students. This ensures every child gets direct attention from the mentor, has space to ask questions, and gets feedback on their work — not just a lecture.",
  },
  {
    question: "Can I track my child's progress as a parent?",
    answer:
      "Yes — every parent account includes a dedicated dashboard with class attendance, project submissions, assessment scores, and mentor feedback. You'll never be left guessing how your child is doing.",
  },
  {
    question: "What happens after completing a track?",
    answer:
      "Students who complete the Future Innovators track are eligible to apply for the KAT Fellowship Programme — transitioning from learners to mentors who lead real community-impact projects. Younger students simply move up to the next track when they're ready.",
  },
  {
    question: "My child has never coded before. Is KAT right for them?",
    answer:
      "Absolutely. The Junior Explorers and Teen Builders tracks are designed for complete beginners. We start from zero — no prior experience needed. Our mentors are trained to make the first few sessions fun and pressure-free.",
  },
];

export const SIDEBAR_ITEMS = ["My Classes", "Projects", "Challenges", "Messages", "Badges"];
