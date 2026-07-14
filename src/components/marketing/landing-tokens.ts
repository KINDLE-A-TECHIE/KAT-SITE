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
  { href: "#fellowship", label: "Fellowship" },
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

export const FEATURES = [
  {
    title: "Live Tech Classes",
    description: "1-on-1 live sessions with a dedicated mentor in coding, robotics, AI, UI/UX design, and game development. No recorded videos. Your child builds something in every session.",
    iconName: "Code2" as const,
    color: "bg-blue-500",
  },
  {
    title: "Parent Visibility",
    description: "See your child's attendance, current project, and mentor feedback, without having to ask them. It is all on one dashboard.",
    iconName: "Shield" as const,
    color: "bg-indigo-500",
  },
  {
    title: "Build Real Projects",
    description: "No textbook exercises. Students build games, apps, websites, robots, and UI designs, Real work they can show anyone.",
    iconName: "Layers3" as const,
    color: "bg-sky-500",
  },
  {
    title: "Mastery-Based Learning",
    description: "Students advance by demonstrating real understanding through assessments, projects and instructor reviews. Attendance alone does not advance them.",
    iconName: "Brain" as const,
    color: "bg-violet-500",
  },
  {
    title: "Weekly Challenges",
    description: "Coding missions, friendly leaderboards, and peer shoutouts give students something to aim for each week.",
    iconName: "Flame" as const,
    color: "bg-orange-500",
  },
  {
    title: "Path to Fellowship",
    description: "The best learners go on to become KAT Fellows. They mentor juniors, lead impact projects and build something of their own.",
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
    title: "Learn Live with Expert Mentors",
    description: "1-on-1 live sessions with a dedicated mentor. Hands-on training in coding, robotics, AI, design, or game development, 2 sessions every week.",
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
      "My daughter went from 'coding is boring' to building her own portfolio site in 8 weeks. The mentors genuinely care, it shows.",
    stars: 5,
  },
  {
    name: "Chukwuemeka A.",
    role: "Student, Future Innovators",
    location: "Abuja, Nigeria",
    initials: "CA",
    quote:
      "KAT taught me real skills, not just theory. I shipped my first API project, built a portfolio, and got accepted into a fellowship, all in one year.",
    stars: 5,
  },
  {
    name: "Funmilayo B.",
    role: "Parent of a Junior Explorer",
    location: "Port Harcourt, Nigeria",
    initials: "FB",
    quote:
      "The parent dashboard is everything. I can see exactly what Temi is working on, how he scored, and what his mentor said, every single week.",
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
    color: "bg-violet-500",
  },
  {
    title: "Hackathons",
    description:
      "Team-based competitions where students tackle real-world challenges, present solutions, and compete for recognition across schools and regions.",
    modes: ["Physical", "Virtual", "Hybrid"] as const,
    iconName: "Trophy" as const,
    color: "bg-amber-500",
  },
  {
    title: "School Programmes",
    description:
      "Coding clubs, tech labs, and after-school programmes delivered inside partner schools, with KAT mentors, curriculum, and tools included.",
    modes: ["Physical", "Hybrid"] as const,
    iconName: "School" as const,
    color: "bg-emerald-500",
  },
];

export const SIDEBAR_ITEMS = ["My Classes", "Projects", "Challenges", "Messages", "Badges"];


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
};
