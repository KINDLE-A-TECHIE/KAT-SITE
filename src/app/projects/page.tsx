import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink, FileText, FolderOpen } from "lucide-react";

export const revalidate = 300;

export const metadata = {
  title: "Student Projects | KAT Learning",
  description: "See what KAT students have built — real projects from real learners.",
};

type ShowcaseProject = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  deployedUrl: string | null;
  coverImageUrl: string | null;
  updatedAt: string;
  student: { firstName: string; lastName: string };
  program: { name: string } | null;
  files: { id: string; name: string; mimeType: string; url: string }[];
  _count: { files: number };
};

async function getShowcaseProjects(): Promise<ShowcaseProject[]> {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/projects/showcase`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { projects: ShowcaseProject[] };
    return data.projects ?? [];
  } catch {
    return [];
  }
}

function ProjectCard({ project }: { project: ShowcaseProject }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex-1">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {project.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600"
            >
              {tag}
            </span>
          ))}
        </div>
        <h3 className="font-semibold text-slate-900">{project.title}</h3>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
        )}
        {project.program && (
          <p className="mt-2 text-xs text-slate-400">{project.program.name}</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div>
          <p className="text-xs font-medium text-slate-700">
            {project.student.firstName} {project.student.lastName}
          </p>
          <p className="text-xs text-slate-400">
            {project._count.files} file{project._count.files !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {project.files[0] && (
            <a
              href={project.files[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
            >
              <FileText className="size-3" /> View
            </a>
          )}
          {project.deployedUrl && (
            <a
              href={project.deployedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg bg-[#0D1F45] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-900"
            >
              <ExternalLink className="size-3" /> Live
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

async function ShowcaseGrid() {
  const projects = await getShowcaseProjects();

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <FolderOpen className="size-12 text-slate-300" />
        <div>
          <p className="font-semibold text-slate-700">No projects showcased yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Check back soon as students complete their work!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}

export default function ProjectsShowcasePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-[#0D1F45] py-16 text-center text-white">
        <h1 className="[font-family:var(--font-space-grotesk)] text-4xl font-bold">
          Student Projects
        </h1>
        <p className="mt-3 text-blue-200">Real projects built by real KAT learners</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm transition hover:bg-white/20"
        >
          ← Back to KAT Learning
        </Link>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          }
        >
          <ShowcaseGrid />
        </Suspense>
      </div>
    </main>
  );
}
