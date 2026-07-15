/**
 * KAT × NERDC crosswalk. THE single source of truth.
 *
 * Transcribed from KAT-NERDC-Crosswalk.md, which was itself built from the real
 * KAT schemes of work. Two things read this file and nothing else:
 *
 *   1. prisma/seed-nerdc.ts, seeds the SCHOOL-audience courses, their terms
 *      (as Modules, carrying the strand) and their topics (as Lessons).
 *   2. the /schools compliance table, so the marketing claim and the actual
 *      seeded curriculum can never drift apart.
 *
 * Keep it dependency-free (no prisma, no "server-only"): it is imported by both a
 * Node seed script and a client component.
 *
 * If a scheme of work changes, change it HERE, re-seeding updates the same
 * records in place (keys are derived from course slug + unit order + topic order).
 */

export type Strand = "CODING" | "DIGLIT";
export type NerdcLevel = "PRIMARY_1_3" | "PRIMARY_4_6" | "JSS" | "SSS";

export type NerdcUnit = {
  /** 1-based position within the course. For most courses this IS the term number. */
  order: number;
  /** "Term 1", or "Primary 1" for the embedded P1–3 ICT strand, which has no terms. */
  label: string;
  theme: string;
  strand: Strand;
  /** The scheme's topics for this unit; each becomes a Lesson. */
  topics: string[];
  /**
   * Playground language for CODING units.
   *
   * NOTE: the schemes specify Scratch/Blockly for the block-coding units, and the
   * platform has no Scratch runtime. Those units use Python instead, the
   * playground ships turtle/pygame shims, which suit "thinking like a coder".
   * Scratch itself stays off-platform.
   */
  playgroundLanguage?: "python" | "html" | "sql";
  /** On the coding spine, the deep-build units KAT owns (crosswalk §7). */
  spine?: boolean;
};

export type NerdcCourse = {
  slug: string;
  name: string;
  nerdcLevel: NerdcLevel;
  classYear: string;
  subject: string;
  /** Dominant strand for the course as a whole. Units carry their own. */
  strand: Strand;
  units: NerdcUnit[];
};

/** Level metadata, drives the /schools compliance table (crosswalk §1). */
export type NerdcLevelInfo = {
  level: NerdcLevel;
  label: string;
  subject: string;
  badge: "Compliant" | "Compulsory core";
  /** Public, coverage-only description. No internal build backlog. */
  covers: string;
};

export const NERDC_LEVEL_INFO: NerdcLevelInfo[] = [
  {
    level: "PRIMARY_1_3",
    label: "Primary 1–3",
    subject: "Basic Science. ICT strand (embedded)",
    badge: "Compliant",
    covers:
      "The NERDC ICT strand embedded in Basic Science, parts of a computer, common ICT devices and safe use, delivered as a light insert a Basic Science teacher slots straight into the existing lesson.",
  },
  {
    level: "PRIMARY_4_6",
    label: "Primary 4–6",
    subject: "Basic Digital Literacy (core subject)",
    badge: "Compliant",
    covers:
      "Files, documents, the internet, online safety and spreadsheets, plus block coding entering from Primary 5, ending in a capstone showcase.",
  },
  {
    level: "JSS",
    label: "JSS 1–3",
    subject: "Digital Technologies (core subject)",
    badge: "Compliant",
    covers:
      "Hardware, operating systems, networks, the web, cloud and digital ethics, plus visual coding (Scratch/Blockly) in JSS 3, into the BECE capstone.",
  },
  {
    level: "SSS",
    label: "SSS 1–3",
    subject: "Digital Technologies (compulsory core)",
    badge: "Compulsory core",
    covers:
      "Python, web (HTML/CSS), databases & SQL, AI & robotics logic, cybersecurity and tech entrepreneurship, ending in a WASSCE/NECO project defence.",
  },
];

/**
 * The courses. One per class year (plus the embedded P1–3 insert), because a
 * class is taught one year's scheme, and because strand varies BY TERM, which
 * only works if a term is its own unit.
 */
export const NERDC_COURSES: NerdcCourse[] = [
  // ── Primary 1–3 · Basic Science → Digital (ICT) strand (crosswalk §3) ───────
  // Not a standalone per-seat course: a 3-lesson insert per class year. Units are
  // class years, not terms.
  {
    slug: "nerdc-primary-1-3-ict",
    name: "Basic Science: ICT Strand (Primary 1–3)",
    nerdcLevel: "PRIMARY_1_3",
    classYear: "Primary 1–3",
    subject: "Basic Science. ICT strand",
    strand: "DIGLIT",
    units: [
      {
        order: 1,
        label: "Primary 1",
        theme: "Meeting the Computer",
        strand: "DIGLIT",
        topics: ["Parts of a computer", "Common ICT devices", "Uses of computers"],
      },
      {
        order: 2,
        label: "Primary 2",
        theme: "Computers Around Us",
        strand: "DIGLIT",
        topics: [
          "Computers in everyday life",
          "What the parts do",
          "Staying safe with gadgets and electricity",
        ],
      },
      {
        order: 3,
        label: "Primary 3",
        theme: "Using the Computer",
        strand: "DIGLIT",
        topics: ["Starting up and shutting down", "Input and output devices", "System unit and storage"],
      },
    ],
  },

  // ── Primary 4–6 · Basic Digital Literacy (crosswalk §4) ────────────────────
  {
    slug: "nerdc-primary-4",
    name: "Basic Digital Literacy. Primary 4",
    nerdcLevel: "PRIMARY_4_6",
    classYear: "Primary 4",
    subject: "Basic Digital Literacy",
    strand: "DIGLIT",
    units: [
      {
        order: 1,
        label: "Term 1",
        theme: "Getting Started with Computers & Digital Data",
        strand: "DIGLIT",
        topics: [
          "Digital devices",
          "Safe use of devices",
          "Digital data",
          "Files and folders",
          "Using the keyboard",
          "Mouse and touch input",
          "Basic computer tasks",
        ],
      },
      {
        order: 2,
        label: "Term 2",
        theme: "Word Processing & Creating Documents",
        strand: "DIGLIT",
        topics: [
          "Introducing the word processor",
          "Typing and editing text",
          "Formatting text",
          "Saving your work",
          "Inserting pictures",
          "Make a document",
        ],
      },
      {
        order: 3,
        label: "Term 3",
        theme: "The Internet, Communication & Staying Safe",
        strand: "DIGLIT",
        topics: [
          "What the internet is",
          "Using a browser",
          "Searching the web",
          "Digital communication",
          "Online safety I",
          "Online safety II",
          "Digital citizenship",
        ],
      },
    ],
  },
  {
    slug: "nerdc-primary-5",
    name: "Basic Digital Literacy. Primary 5",
    nerdcLevel: "PRIMARY_4_6",
    classYear: "Primary 5",
    subject: "Basic Digital Literacy",
    strand: "DIGLIT",
    units: [
      {
        order: 1,
        label: "Term 1",
        theme: "Files, Folders & the Web",
        strand: "DIGLIT",
        topics: [
          "Directory paths",
          "Organising files",
          "Browsers",
          "Search syntax",
          "Judging information online",
          "Downloading safely",
        ],
      },
      {
        order: 2,
        label: "Term 2",
        theme: "Creating Multimedia Presentations",
        strand: "DIGLIT",
        topics: [
          "Slides",
          "Working with text",
          "Formatting slides",
          "Adding media",
          "Transitions and animation",
          "Plan, build and present",
        ],
      },
      {
        order: 3,
        label: "Term 3",
        theme: "Thinking Like a Coder: Logic & Block Coding",
        strand: "CODING",
        spine: true,
        playgroundLanguage: "python",
        topics: [
          "Algorithms",
          "Sequencing",
          "Patterns and loops (unplugged)",
          "Introduction to block coding",
          "Sequencing, loops and events",
          "Mini project",
        ],
      },
    ],
  },
  {
    slug: "nerdc-primary-6",
    name: "Basic Digital Literacy. Primary 6",
    nerdcLevel: "PRIMARY_4_6",
    classYear: "Primary 6",
    subject: "Basic Digital Literacy",
    strand: "CODING",
    units: [
      {
        order: 1,
        label: "Term 1",
        theme: "Productivity & Digital Creation",
        strand: "DIGLIT",
        topics: [
          "Advanced word processing",
          "Tables and images",
          "Spreadsheets: SUM and formulas",
          "Charts",
          "Combining tools",
          "Mini report",
        ],
      },
      {
        order: 2,
        label: "Term 2",
        theme: "Coding & Computational Thinking",
        strand: "CODING",
        spine: true,
        playgroundLanguage: "python",
        topics: [
          "Block-coding review",
          "Variables",
          "Decisions (if/then)",
          "Combining loops, variables and decisions",
          "Plan and build a project",
        ],
      },
      {
        order: 3,
        label: "Term 3",
        theme: "Showcase, Consolidation & Transition",
        strand: "CODING",
        playgroundLanguage: "python",
        topics: [
          "Capstone SBA showcase",
          "Consolidation",
          "Safety recap",
          "Transition to JSS",
          "Digital portfolio",
        ],
      },
    ],
  },

  // ── JSS 1–3 · Digital Technologies (crosswalk §5) ──────────────────────────
  {
    slug: "nerdc-jss-1",
    name: "Digital Technologies. JSS 1",
    nerdcLevel: "JSS",
    classYear: "JSS 1",
    subject: "Digital Technologies",
    strand: "DIGLIT",
    units: [
      {
        order: 1,
        label: "Term 1",
        theme: "Foundations. Meaning, History & Hardware",
        strand: "DIGLIT",
        topics: [
          "The meaning of digital technology",
          "Evolution of computing",
          "Computer generations",
          "Smart vs computing devices",
          "The system unit and I/O",
          "The Internet of Things",
          "Caring for devices",
        ],
      },
      {
        order: 2,
        label: "Term 2",
        theme: "Operating Systems & Maintenance",
        strand: "DIGLIT",
        topics: [
          "Types of operating system",
          "Desktop and mobile operating systems",
          "File management",
          "Maintenance",
          "Troubleshooting",
        ],
      },
      {
        order: 3,
        label: "Term 3",
        theme: "The Web, Safety & Digital Citizenship",
        strand: "DIGLIT",
        topics: [
          "Internet vs the web",
          "Browsers",
          "Searching effectively",
          "Online safety",
          "Digital citizenship",
          "Cyberbullying",
          "Digital ethics",
        ],
      },
    ],
  },
  {
    slug: "nerdc-jss-2",
    name: "Digital Technologies. JSS 2",
    nerdcLevel: "JSS",
    classYear: "JSS 2",
    subject: "Digital Technologies",
    strand: "DIGLIT",
    units: [
      {
        order: 1,
        label: "Term 1",
        theme: "Data, Information & the System Unit",
        strand: "DIGLIT",
        topics: [
          "Data vs information",
          "Forms of data",
          "The information processing cycle",
          "Motherboard and CPU",
          "Memory and storage",
          "Ports and connectors",
        ],
      },
      {
        order: 2,
        label: "Term 2",
        theme: "Computer Networks",
        strand: "DIGLIT",
        topics: [
          "LAN, MAN and WAN",
          "Network topologies",
          "Routers, modems and switches",
          "Transmission media",
          "Network safety",
        ],
      },
      {
        order: 3,
        label: "Term 3",
        theme: "E-Commerce, Communication & Online Learning",
        strand: "DIGLIT",
        topics: [
          "Digital communication",
          "Email",
          "Social and collaboration tools",
          "E-commerce",
          "Online transactions",
          "Online learning tools",
        ],
      },
    ],
  },
  {
    slug: "nerdc-jss-3",
    name: "Digital Technologies. JSS 3",
    nerdcLevel: "JSS",
    classYear: "JSS 3",
    subject: "Digital Technologies",
    strand: "CODING",
    units: [
      {
        order: 1,
        label: "Term 1",
        theme: "Cloud Computing & Modern Communication",
        strand: "DIGLIT",
        topics: [
          "Cloud computing",
          "Cloud storage",
          "Benefits and risks",
          "Mobile and 5G",
          "Satellite communication",
          "Communication protocols",
        ],
      },
      {
        order: 2,
        label: "Term 2",
        theme: "Programming & Digital Ethics",
        strand: "CODING",
        spine: true,
        playgroundLanguage: "python",
        topics: [
          "Algorithms",
          "Flowcharts",
          "Block coding with Scratch/Blockly",
          "Loops, variables and decisions",
          "Build and debug a program",
          "Programming capstone",
          "Digital ethics, IP and copyright",
          "Data privacy",
        ],
      },
      {
        order: 3,
        label: "Term 3",
        theme: "Capstone, Revision & BECE",
        strand: "CODING",
        playgroundLanguage: "python",
        topics: [
          "Capstone SBA finalisation",
          "Structured revision",
          "Mock BECE",
          "BECE preparation",
        ],
      },
    ],
  },

  // ── SSS 1–3 · Digital Technologies, compulsory core (crosswalk §6) ─────────
  {
    slug: "nerdc-ss-1",
    name: "Digital Technologies. SS 1",
    nerdcLevel: "SSS",
    classYear: "SS 1",
    subject: "Digital Technologies",
    strand: "CODING",
    units: [
      {
        order: 1,
        label: "Term 1",
        theme: "Data Representation & Digital Logic",
        strand: "DIGLIT",
        topics: [
          "Number systems",
          "Bits and bytes",
          "Storage architecture",
          "Encoding",
          "Logic gates and truth tables",
        ],
      },
      {
        order: 2,
        label: "Term 2",
        theme: "From Blocks to Python",
        strand: "CODING",
        spine: true,
        playgroundLanguage: "python",
        topics: [
          "From blocks to text",
          "Introduction to Python",
          "Python syntax",
          "Variables",
          "Data types",
          "Input and output",
        ],
      },
      {
        order: 3,
        label: "Term 3",
        theme: "Programming Logic",
        strand: "CODING",
        spine: true,
        playgroundLanguage: "python",
        topics: [
          "Operators",
          "if / elif / else",
          "Nested decisions",
          "while and for loops",
          "Debugging",
          "Mini project",
        ],
      },
    ],
  },
  {
    slug: "nerdc-ss-2",
    name: "Digital Technologies. SS 2",
    nerdcLevel: "SSS",
    classYear: "SS 2",
    subject: "Digital Technologies",
    strand: "CODING",
    units: [
      {
        order: 1,
        label: "Term 1",
        theme: "Networking & Internet Protocols",
        strand: "DIGLIT",
        topics: [
          "Networks review",
          "Topologies",
          "Client–server model",
          "TCP/IP",
          "IP addressing",
          "HTTP, FTP and SMTP",
        ],
      },
      {
        order: 2,
        label: "Term 2",
        theme: "Web Design (HTML & CSS)",
        strand: "CODING",
        spine: true,
        playgroundLanguage: "html",
        topics: [
          "How the web works",
          "HTML structure",
          "Text, links and images",
          "Tables and forms",
          "CSS styling",
          "CSS layout",
          "Build a web page",
        ],
      },
      {
        order: 3,
        label: "Term 3",
        theme: "Databases, SQL & SDLC",
        strand: "CODING",
        spine: true,
        playgroundLanguage: "sql",
        topics: [
          "What a database is",
          "Relational concepts",
          "Database design",
          "SQL: CREATE and INSERT",
          "SQL: SELECT and WHERE",
          "The software development life cycle",
        ],
      },
    ],
  },
  {
    slug: "nerdc-ss-3",
    name: "Digital Technologies. SS 3",
    nerdcLevel: "SSS",
    classYear: "SS 3",
    subject: "Digital Technologies",
    strand: "CODING",
    units: [
      {
        order: 1,
        label: "Term 1",
        theme: "Cybersecurity & Cryptography",
        strand: "DIGLIT",
        topics: [
          "Data security (confidentiality, integrity, availability)",
          "Threats",
          "Security best practices",
          "Data protection",
          "Cryptography",
          "The Caesar cipher",
          "HTTPS",
        ],
      },
      {
        order: 2,
        label: "Term 2",
        theme: "AI, Robotics & Tech Entrepreneurship",
        strand: "CODING",
        spine: true,
        playgroundLanguage: "python",
        topics: [
          "What AI means",
          "How a machine learns",
          "AI ethics",
          "Robotics parts and control logic",
          "Tech entrepreneurship",
          "Building an MVP",
          "Pitching",
        ],
      },
      {
        order: 3,
        label: "Term 3",
        theme: "Final Project, Revision & WASSCE/NECO",
        strand: "CODING",
        playgroundLanguage: "python",
        topics: [
          "Final project completion",
          "Project defence (SBA)",
          "Structured revision",
          "Mock examination",
          "WASSCE/NECO preparation",
        ],
      },
    ],
  },
];

// ── Derivations (so nothing re-states what the data already says) ─────────────

/** The coding spine, the deep-build units KAT owns (crosswalk §7). */
export function codingSpine(): Array<{ course: string; unit: string }> {
  return NERDC_COURSES.flatMap((c) =>
    c.units.filter((u) => u.spine).map((u) => ({ course: c.classYear, unit: u.label })),
  );
}

/** Courses for one NERDC level (a class picks its class-year course from these). */
export function coursesForLevel(level: NerdcLevel): NerdcCourse[] {
  return NERDC_COURSES.filter((c) => c.nerdcLevel === level);
}

/** Which strands a level actually teaches, drives the /schools table legend. */
export function strandsForLevel(level: NerdcLevel): Strand[] {
  const strands = new Set<Strand>();
  for (const course of coursesForLevel(level)) {
    for (const unit of course.units) strands.add(unit.strand);
  }
  // CODING first so the table reads consistently.
  return (["CODING", "DIGLIT"] as Strand[]).filter((s) => strands.has(s));
}
