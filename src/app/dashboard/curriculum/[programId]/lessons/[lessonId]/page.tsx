import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { LessonViewer } from "@/components/dashboard/lesson-viewer";

interface Props { params: Promise<{ programId: string; lessonId: string }> }

export default async function LessonPage({ params }: Props) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/login");

  const { programId, lessonId } = await params;
  return <LessonViewer lessonId={lessonId} programId={programId} role={session.user.role} />;
}