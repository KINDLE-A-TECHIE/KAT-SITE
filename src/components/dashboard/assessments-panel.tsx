"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, CheckCircle2, Eye, GripVertical, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ASSESSMENT_TYPES,
  type AssessmentTypeValue,
  type AssessmentVerificationStatusValue,
  type QuestionTypeValue,
  type UserRoleValue,
} from "@/lib/enums";

type Program = {
  id: string;
  name: string;
};

type Assessment = {
  id: string;
  title: string;
  description: string | null;
  type: AssessmentTypeValue;
  totalPoints: number;
  passScore: number;
  published: boolean;
  verificationStatus: AssessmentVerificationStatusValue;
  verificationNote?: string | null;
  createdBy?: { id: string; firstName: string; lastName: string; role: UserRoleValue } | null;
  verifiedBy?: { id: string; firstName: string; lastName: string; role: UserRoleValue } | null;
  verifiedAt?: string | null;
  dueDate: string | null;
  program: Program;
  module?: { id: string; title: string } | null;
  questions: {
    id: string;
    prompt: string;
    type: QuestionTypeValue;
    points: number;
    answerKey?: string | null;
    options: { id: string; label: string; value: string; isCorrect?: boolean }[];
  }[];
  submissions?: { id: string; status: string; totalScore: number; submittedAt: string; attemptNumber: number }[];
  retakeGrants?: { id: string }[];
};

type Submission = {
  id: string;
  status: string;
  totalScore: number;
  autoScore: number;
  manualScore: number;
  submittedAt: string;
  feedback: string | null;
  student: { id: string; firstName: string; lastName: string } | null;
  assessment: { id: string; title: string; totalPoints: number; passScore: number };
  answers: {
    id: string;
    responseText: string | null;
    autoScore: number;
    manualScore: number;
    question: {
      id: string;
      prompt: string;
      type: QuestionTypeValue;
      points: number;
    };
  }[];
};

type AnswersDraft = Record<string, { questionId: string; selectedOptionId?: string; responseText?: string }[]>;
type GradeDraft = Record<string, Record<string, number>>;

type QuestionDraftOption = {
  id: string;
  label: string;
  value: string;
  isCorrect: boolean;
};

type QuestionDraft = {
  id: string;
  prompt: string;
  type: QuestionTypeValue;
  points: string;
  options: QuestionDraftOption[];
};

type AssessmentsPanelProps = {
  role: UserRoleValue;
};

const CREATOR_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];
const LEARNER_ROLES: UserRoleValue[] = ["STUDENT", "FELLOW"];
const KAT_DROPDOWN_TRIGGER_CLASS =
  "h-10 w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-200";
const KAT_DROPDOWN_CONTENT_CLASS = "max-h-56 overflow-y-auto";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createMultipleChoiceOptions(): QuestionDraftOption[] {
  return [
    { id: createId("opt"), label: "Option A", value: "option_a", isCorrect: true },
    { id: createId("opt"), label: "Option B", value: "option_b", isCorrect: false },
  ];
}

function createTrueFalseOptions(): QuestionDraftOption[] {
  return [
    { id: createId("opt"), label: "True", value: "true", isCorrect: true },
    { id: createId("opt"), label: "False", value: "false", isCorrect: false },
  ];
}

function createQuestionDraft(type: QuestionTypeValue): QuestionDraft {
  return {
    id: createId("q"),
    prompt: "",
    type,
    points: "5",
    options:
      type === "MULTIPLE_CHOICE"
        ? createMultipleChoiceOptions()
        : type === "TRUE_FALSE"
          ? createTrueFalseOptions()
          : [],
  };
}

export function AssessmentsPanel({ role }: AssessmentsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [answersDraft, setAnswersDraft] = useState<AnswersDraft>({});
  const [gradeDraft, setGradeDraft] = useState<GradeDraft>({});
  const [busy, setBusy] = useState(false);
  const [verifyingAssessmentId, setVerifyingAssessmentId] = useState<string | null>(null);
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>({});
  const [previewAssessment, setPreviewAssessment] = useState<Assessment | null>(null);

  const [programId, setProgramId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [modules, setModules] = useState<{ id: string; title: string }[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AssessmentTypeValue>("QUIZ");
  const [passScore, setPassScore] = useState("10");
  const [dueDate, setDueDate] = useState("");
  const [published, setPublished] = useState(true);
  const [questionDrafts, setQuestionDrafts] = useState<QuestionDraft[]>([]);

  useEffect(() => {
    setQuestionDrafts([
      { ...createQuestionDraft("MULTIPLE_CHOICE"), prompt: "What is React used for?" },
      { ...createQuestionDraft("OPEN_ENDED"), prompt: "Explain one use-case for context in React.", points: "10" },
    ]);
  }, []);
  const [builderView, setBuilderView] = useState<"EDIT" | "PREVIEW">("EDIT");
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [programResponse, assessmentsResponse, submissionsResponse] = await Promise.all([
      fetch("/api/programs"),
      fetch("/api/assessments"),
      fetch("/api/assessments/submissions"),
    ]);

    if (programResponse.ok) {
      const payload = await programResponse.json();
      setPrograms((payload.programs ?? []).map((item: { id: string; name: string }) => ({ id: item.id, name: item.name })));
      if (!programId && payload.programs?.[0]) {
        setProgramId(payload.programs[0].id);
      }
    }

    if (assessmentsResponse.ok) {
      const payload = await assessmentsResponse.json();
      setAssessments(payload.assessments ?? []);
    }

    if (submissionsResponse.ok) {
      const payload = await submissionsResponse.json();
      setSubmissions(payload.submissions ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load modules for the selected program so users can link an assessment to a module
  useEffect(() => {
    if (!programId) { setModules([]); setModuleId(""); return; }
    fetch(`/api/programs/${programId}/curriculum`)
      .then((r) => r.ok ? r.json() as Promise<{ curriculum?: { versions?: Array<{ modules?: Array<{ id: string; title: string }> }> } }> : null)
      .then((data) => {
        const mods = data?.curriculum?.versions?.[0]?.modules ?? [];
        setModules(mods.map((m) => ({ id: m.id, title: m.title })));
        setModuleId("");
      })
      .catch(() => {});
  }, [programId]);

  const roleCanCreate = CREATOR_ROLES.includes(role);
  const roleCanSubmit = LEARNER_ROLES.includes(role);
  const roleCanVerify = role === "SUPER_ADMIN";
  const pendingManual = useMemo(
    () => submissions.filter((submission) => submission.status === "IN_REVIEW"),
    [submissions],
  );
  const verificationQueue = useMemo(
    () => assessments.filter((assessment) => assessment.verificationStatus === "PENDING"),
    [assessments],
  );
  const draftTotalPoints = useMemo(
    () =>
      questionDrafts.reduce((sum, question) => {
        const points = Number(question.points);
        return Number.isInteger(points) && points > 0 ? sum + points : sum;
      }, 0),
    [questionDrafts],
  );

  const reorderQuestionDrafts = (sourceId: string, targetId: string) => {
    setQuestionDrafts((prev) => {
      const sourceIndex = prev.findIndex((question) => question.id === sourceId);
      const targetIndex = prev.findIndex((question) => question.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const addQuestion = () => {
    setQuestionDrafts((prev) => [...prev, createQuestionDraft("MULTIPLE_CHOICE")]);
  };

  const moveQuestion = (questionId: string, direction: "up" | "down") => {
    setQuestionDrafts((prev) => {
      const index = prev.findIndex((question) => question.id === questionId);
      if (index < 0) {
        return prev;
      }
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const onQuestionDragStart = (questionId: string) => {
    setDraggingQuestionId(questionId);
    setDragOverQuestionId(questionId);
  };

  const onQuestionDragOver = (event: DragEvent<HTMLDivElement>, questionId: string) => {
    event.preventDefault();
    if (!draggingQuestionId || draggingQuestionId === questionId) {
      return;
    }
    setDragOverQuestionId(questionId);
  };

  const onQuestionDrop = (questionId: string) => {
    if (!draggingQuestionId || draggingQuestionId === questionId) {
      setDraggingQuestionId(null);
      setDragOverQuestionId(null);
      return;
    }
    reorderQuestionDrafts(draggingQuestionId, questionId);
    setDraggingQuestionId(null);
    setDragOverQuestionId(null);
  };

  const onQuestionDragEnd = () => {
    setDraggingQuestionId(null);
    setDragOverQuestionId(null);
  };

  const removeQuestion = (questionId: string) => {
    setQuestionDrafts((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((question) => question.id !== questionId);
    });
  };

  const updateQuestion = (questionId: string, update: Partial<QuestionDraft>) => {
    setQuestionDrafts((prev) =>
      prev.map((question) =>
        question.id === questionId
          ? { ...question, ...update }
          : question,
      ),
    );
  };

  const updateQuestionType = (questionId: string, nextType: QuestionTypeValue) => {
    setQuestionDrafts((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) {
          return question;
        }
        if (nextType === "OPEN_ENDED") {
          return { ...question, type: nextType, options: [] };
        }
        if (nextType === "TRUE_FALSE") {
          return { ...question, type: nextType, options: createTrueFalseOptions() };
        }
        if (question.type === "MULTIPLE_CHOICE") {
          return question;
        }
        return { ...question, type: nextType, options: createMultipleChoiceOptions() };
      }),
    );
  };

  const addOption = (questionId: string) => {
    setQuestionDrafts((prev) =>
      prev.map((question) => {
        if (question.id !== questionId || question.type !== "MULTIPLE_CHOICE") {
          return question;
        }
        const nextIndex = question.options.length + 1;
        return {
          ...question,
          options: [
            ...question.options,
            {
              id: createId("opt"),
              label: `Option ${nextIndex}`,
              value: `option_${nextIndex}`,
              isCorrect: false,
            },
          ],
        };
      }),
    );
  };

  const removeOption = (questionId: string, optionId: string) => {
    setQuestionDrafts((prev) =>
      prev.map((question) => {
        if (question.id !== questionId || question.type !== "MULTIPLE_CHOICE") {
          return question;
        }
        if (question.options.length <= 2) {
          return question;
        }
        const nextOptions = question.options.filter((option) => option.id !== optionId);
        if (nextOptions.every((option) => !option.isCorrect)) {
          nextOptions[0] = { ...nextOptions[0], isCorrect: true };
        }
        return {
          ...question,
          options: nextOptions,
        };
      }),
    );
  };

  const updateOption = (
    questionId: string,
    optionId: string,
    update: Partial<QuestionDraftOption>,
  ) => {
    setQuestionDrafts((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) {
          return question;
        }
        return {
          ...question,
          options: question.options.map((option) =>
            option.id === optionId ? { ...option, ...update } : option,
          ),
        };
      }),
    );
  };

  const setCorrectOption = (questionId: string, optionId: string) => {
    setQuestionDrafts((prev) =>
      prev.map((question) => {
        if (question.id !== questionId) {
          return question;
        }
        return {
          ...question,
          options: question.options.map((option) => ({
            ...option,
            isCorrect: option.id === optionId,
          })),
        };
      }),
    );
  };

  const createAssessment = async () => {
    if (!programId || !title) {
      toast.error("Program and title are required.");
      return;
    }

    const questions: Array<{
      prompt: string;
      type: QuestionTypeValue;
      points: number;
      options?: Array<{ label: string; value: string; isCorrect: boolean }>;
      answerKey?: string;
    }> = [];
    for (let index = 0; index < questionDrafts.length; index += 1) {
      const question = questionDrafts[index];
      const prompt = question.prompt.trim();
      const points = Number(question.points);

      if (prompt.length < 5) {
        toast.error(`Question ${index + 1} prompt must be at least 5 characters.`);
        return;
      }
      if (!Number.isInteger(points) || points < 1) {
        toast.error(`Question ${index + 1} points must be a number greater than 0.`);
        return;
      }

      if (question.type === "OPEN_ENDED") {
        questions.push({
          prompt,
          type: question.type,
          points,
        });
        continue;
      }

      const options = question.options.map((option, optionIndex) => ({
        label: option.label.trim(),
        value: option.value.trim() || `option_${optionIndex + 1}`,
        isCorrect: option.isCorrect,
      }));

      if (options.length < 2) {
        toast.error(`Question ${index + 1} must have at least 2 options.`);
        return;
      }
      if (options.some((option) => option.label.length === 0)) {
        toast.error(`Question ${index + 1} has an empty option label.`);
        return;
      }

      const correctOption = options.find((option) => option.isCorrect);
      if (!correctOption) {
        toast.error(`Question ${index + 1} must have one correct option.`);
        return;
      }

      questions.push({
        prompt,
        type: question.type,
        points,
        answerKey: question.type === "TRUE_FALSE" ? correctOption.value : undefined,
        options,
      });
    }

    const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);
    if (Number(passScore) > totalPoints) {
      toast.error(`Pass score (${passScore}) cannot exceed total points (${totalPoints}).`);
      return;
    }

    setBusy(true);
    const response = await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programId,
        moduleId: moduleId || undefined,
        title,
        description,
        type,
        passScore: Number(passScore),
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59.000Z`).toISOString() : undefined,
        published,
        questions,
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Could not create assessment.");
      return;
    }

    toast.success("Assessment created.");
    setTitle("");
    setDescription("");
    setModuleId("");
    setQuestionDrafts([createQuestionDraft("MULTIPLE_CHOICE")]);
    await load();
  };

  const updateAnswerDraft = (
    assessmentId: string,
    questionId: string,
    update: { selectedOptionId?: string; responseText?: string },
  ) => {
    const currentList = [...(answersDraft[assessmentId] ?? [])];
    const index = currentList.findIndex((item) => item.questionId === questionId);
    const value =
      index >= 0
        ? { ...currentList[index], ...update }
        : { questionId, ...update };
    if (index >= 0) {
      currentList[index] = value;
    } else {
      currentList.push(value);
    }
    setAnswersDraft({ ...answersDraft, [assessmentId]: currentList });
  };

  const submitAssessment = async (assessmentId: string) => {
    const answers = answersDraft[assessmentId] ?? [];
    if (answers.length === 0) {
      toast.error("Provide at least one answer.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/assessments/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId, answers }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Submission failed.");
      return;
    }

    toast.success("Assessment submitted.");
    await load();
  };

  const setManualScore = (submissionId: string, answerId: string, value: number) => {
    setGradeDraft((prev) => ({
      ...prev,
      [submissionId]: {
        ...(prev[submissionId] ?? {}),
        [answerId]: value,
      },
    }));
  };

  const submitManualGrade = async (submission: Submission) => {
    const grades = Object.entries(gradeDraft[submission.id] ?? {}).map(([answerId, score]) => ({
      answerId,
      score,
    }));
    if (grades.length === 0) {
      toast.error("Add at least one manual score.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/assessments/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId: submission.id,
        grades,
      }),
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      toast.error(payload?.error ?? "Manual grading failed.");
      return;
    }

    toast.success("Manual grading completed.");
    await load();
  };

  const verifyAssessment = async (assessmentId: string, action: "APPROVE" | "REJECT") => {
    setVerifyingAssessmentId(assessmentId);
    try {
      const note = verificationNotes[assessmentId]?.trim();
      const response = await fetch("/api/assessments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          action,
          note: note || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error ?? "Could not update verification.");
        return;
      }
      toast.success(action === "APPROVE" ? "Assessment approved." : "Assessment rejected.");
      setVerificationNotes((prev) => ({ ...prev, [assessmentId]: "" }));
      await load();
    } catch {
      toast.error("Could not update verification.");
    } finally {
      setVerifyingAssessmentId(null);
    }
  };

  const grantRetake = async (assessmentId: string, studentId: string, studentName: string) => {
    setBusy(true);
    const response = await fetch("/api/assessments/retakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId, studentId }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      toast.error(payload?.error ?? "Could not grant retake.");
      return;
    }
    toast.success(`Retake granted to ${studentName}.`);
    await load();
  };


  const verificationBadgeClass = (status: AssessmentVerificationStatusValue) => {
    if (status === "APPROVED") {
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
    }
    if (status === "REJECTED") {
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400";
    }
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400";
  };

  return (
    <div className="space-y-4">
      {roleCanCreate ? (
        <section className="kat-card flex max-h-[78dvh] min-h-0 flex-col">
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Create Assessment</h3>
          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select value={programId || undefined} onValueChange={(value) => setProgramId(value)}>
              <SelectTrigger className={KAT_DROPDOWN_TRIGGER_CLASS}>
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent className={KAT_DROPDOWN_CONTENT_CLASS} position="popper" side="bottom" align="start" sideOffset={6}>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {modules.length > 0 && (
              <Select value={moduleId || undefined} onValueChange={setModuleId}>
                <SelectTrigger className={KAT_DROPDOWN_TRIGGER_CLASS}>
                  <SelectValue placeholder="Link to module (optional)" />
                </SelectTrigger>
                <SelectContent className={KAT_DROPDOWN_CONTENT_CLASS} position="popper" side="bottom" align="start" sideOffset={6}>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={type} onValueChange={(value) => setType(value as AssessmentTypeValue)}>
              <SelectTrigger className={KAT_DROPDOWN_TRIGGER_CLASS}>
                <SelectValue placeholder="Select assessment type" />
              </SelectTrigger>
              <SelectContent className={KAT_DROPDOWN_CONTENT_CLASS} position="popper" side="bottom" align="start" sideOffset={6}>
                {ASSESSMENT_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Assessment title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Input placeholder="Pass score" type="number" value={passScore} onChange={(event) => setPassScore(event.target.value)} />
            <Input
              className="kat-date-input"
              placeholder="Due date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
              Publish now (visible to learners only after super-admin verification)
            </label>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Question Builder</p>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <Button
                  type="button"
                  size="sm"
                  variant={builderView === "EDIT" ? "default" : "outline"}
                  className="flex-1 sm:flex-none"
                  onClick={() => setBuilderView("EDIT")}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={builderView === "PREVIEW" ? "default" : "outline"}
                  className="flex-1 sm:flex-none"
                  onClick={() => setBuilderView("PREVIEW")}
                >
                  <Eye className="size-4" />
                  Preview
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={addQuestion}
                  disabled={builderView === "PREVIEW"}
                >
                  <PlusCircle className="size-4" />
                  Add Question
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {questionDrafts.length} question(s), {draftTotalPoints} total point(s).
            </p>

            {builderView === "EDIT" ? (
              <div className="space-y-3">
                {questionDrafts.map((question, index) => (
                  <div
                    key={question.id}
                    onDragOver={(event) => onQuestionDragOver(event, question.id)}
                    onDrop={() => onQuestionDrop(question.id)}
                    className={`rounded-lg border bg-white p-3 transition dark:bg-slate-900 ${
                      dragOverQuestionId === question.id && draggingQuestionId !== question.id
                        ? "border-cyan-300 shadow-sm"
                        : "border-slate-200 dark:border-slate-700"
                    } ${draggingQuestionId === question.id ? "opacity-80" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex size-8 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          draggable
                          onDragStart={() => onQuestionDragStart(question.id)}
                          onDragEnd={onQuestionDragEnd}
                          aria-label={`Drag question ${index + 1}`}
                        >
                          <GripVertical className="size-4" />
                        </button>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Question {index + 1}</p>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          disabled={index === 0}
                          onClick={() => moveQuestion(question.id, "up")}
                          aria-label={`Move question ${index + 1} up`}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          disabled={index === questionDrafts.length - 1}
                          onClick={() => moveQuestion(question.id, "down")}
                          aria-label={`Move question ${index + 1} down`}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={questionDrafts.length <= 1}
                          onClick={() => removeQuestion(question.id)}
                        >
                          <Trash2 className="size-4" />
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Select
                        value={question.type}
                        onValueChange={(value) => updateQuestionType(question.id, value as QuestionTypeValue)}
                      >
                        <SelectTrigger className={KAT_DROPDOWN_TRIGGER_CLASS}>
                          <SelectValue placeholder="Select question type" />
                        </SelectTrigger>
                        <SelectContent className={KAT_DROPDOWN_CONTENT_CLASS} position="popper" side="bottom" align="start" sideOffset={6}>
                          <SelectItem value="MULTIPLE_CHOICE">MULTIPLE_CHOICE</SelectItem>
                          <SelectItem value="TRUE_FALSE">TRUE_FALSE</SelectItem>
                          <SelectItem value="OPEN_ENDED">OPEN_ENDED</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Points"
                        value={question.points}
                        onChange={(event) =>
                          updateQuestion(question.id, { points: event.target.value })
                        }
                      />
                    </div>

                    <textarea
                      className="mt-3 min-h-[80px] w-full rounded-md border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      placeholder="Question prompt"
                      value={question.prompt}
                      onChange={(event) =>
                        updateQuestion(question.id, { prompt: event.target.value })
                      }
                    />

                    {question.type === "OPEN_ENDED" ? (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        Open-ended questions are graded manually.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Options</p>
                        {question.options.map((option) => (
                          <div
                            key={option.id}
                            className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[auto_1fr_1fr_auto] dark:border-slate-700"
                          >
                            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                              <input
                                type="radio"
                                name={`correct-${question.id}`}
                                checked={option.isCorrect}
                                onChange={() => setCorrectOption(question.id, option.id)}
                              />
                              Correct
                            </label>
                            <Input
                              placeholder="Label"
                              value={option.label}
                              disabled={question.type === "TRUE_FALSE"}
                              onChange={(event) =>
                                updateOption(question.id, option.id, { label: event.target.value })
                              }
                            />
                            <Input
                              placeholder="Value"
                              value={option.value}
                              disabled={question.type === "TRUE_FALSE"}
                              onChange={(event) =>
                                updateOption(question.id, option.id, { value: event.target.value })
                              }
                            />
                            {question.type === "MULTIPLE_CHOICE" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={question.options.length <= 2}
                                onClick={() => removeOption(question.id, option.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : (
                              <span />
                            )}
                          </div>
                        ))}
                        {question.type === "MULTIPLE_CHOICE" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(question.id)}
                          >
                            <PlusCircle className="size-4" />
                            Add Option
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Preview uses your current draft settings and question order.
                </p>
                {questionDrafts.map((question, index) => (
                  <div key={question.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {index + 1}. {question.prompt.trim() || "Untitled question"}
                      </p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {question.points || "0"} pt - {question.type}
                      </span>
                    </div>
                    {question.type === "OPEN_ENDED" ? (
                      <textarea
                        className="mt-2 min-h-[80px] w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                        placeholder="Student response..."
                        disabled
                      />
                    ) : (
                      <div className="mt-2 space-y-1">
                        {question.options.map((option) => (
                          <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <input type="radio" disabled />
                            {option.label || option.value || "Untitled option"}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              placeholder="Description (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Button className="w-full sm:w-auto" disabled={busy} onClick={() => void createAssessment()}>
              {busy ? "Saving..." : "Create Assessment"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="kat-card flex max-h-[70dvh] min-h-0 flex-col">
        <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Assessments</h3>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {assessments.map((assessment, index) => (
                <motion.div
                  key={assessment.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{assessment.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {assessment.program?.name}
                      {assessment.module && <span className="text-slate-400 dark:text-slate-500"> · {assessment.module.title}</span>}
                      {" "}— Pass: {assessment.passScore}/{assessment.totalPoints}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {assessment.type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${verificationBadgeClass(assessment.verificationStatus)}`}
                    >
                      {assessment.verificationStatus}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        assessment.published ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {assessment.published ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>

                {roleCanSubmit ? (() => {
                  const latestSub = assessment.submissions?.[0]; // ordered by attemptNumber desc
                  const hasRetakeGrant = (assessment.retakeGrants?.length ?? 0) > 0;
                  const isLocked = !!latestSub && !hasRetakeGrant;

                  if (isLocked) {
                    const passed = latestSub.totalScore >= assessment.passScore;
                    return (
                      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                        <p className={`text-sm font-semibold ${passed ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                          {passed ? "✓ Passed" : "✗ Not passed"} — Attempt #{latestSub.attemptNumber}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Score: {latestSub.totalScore}/{assessment.totalPoints} · {latestSub.status === "IN_REVIEW" ? "Awaiting manual review" : "Graded"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          Contact your instructor if you need a retake.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {hasRetakeGrant && (
                        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          Retake available — Attempt #{(latestSub?.attemptNumber ?? 0) + 1}
                        </div>
                      )}
                      {assessment.questions.map((question) => (
                        <div key={question.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{question.prompt}</p>
                          {question.type === "OPEN_ENDED" ? (
                            <textarea
                              className="mt-2 min-h-[80px] w-full rounded-md border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              onChange={(event) =>
                                updateAnswerDraft(assessment.id, question.id, { responseText: event.target.value })
                              }
                            />
                          ) : (
                            <div className="mt-2 space-y-1">
                              {question.options.map((option) => (
                                <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                  <input
                                    type="radio"
                                    name={`${assessment.id}-${question.id}`}
                                    value={option.id}
                                    onChange={() =>
                                      updateAnswerDraft(assessment.id, question.id, { selectedOptionId: option.id })
                                    }
                                  />
                                  {option.label}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <Button className="w-full sm:w-auto" disabled={busy} onClick={() => void submitAssessment(assessment.id)}>
                        {busy ? "Submitting..." : hasRetakeGrant ? "Submit Retake" : "Submit Assessment"}
                      </Button>
                    </div>
                  );
                })() : null}

                {roleCanCreate ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <p>Submissions: {assessment.submissions?.length ?? 0}</p>
                    <p>
                      Verification: {assessment.verificationStatus}
                      {assessment.verifiedBy
                        ? ` by ${assessment.verifiedBy.firstName} ${assessment.verifiedBy.lastName}`
                        : ""}
                    </p>
                    {assessment.verificationNote ? <p>Review note: {assessment.verificationNote}</p> : null}
                  </div>
                ) : null}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {roleCanVerify ? (
        <section className="kat-card flex max-h-[70dvh] min-h-0 flex-col">
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Assessment Verification Queue</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {verificationQueue.length} assessment(s) require super-admin review before learners can access them.
          </p>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-3">
              {verificationQueue.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  No pending verification tasks.
                </div>
              ) : (
                verificationQueue.map((assessment) => (
                  <div key={assessment.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{assessment.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {assessment.program?.name} - {assessment.type} - {assessment.passScore}/{assessment.totalPoints}
                      </p>
                      {assessment.createdBy ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Created by {assessment.createdBy.firstName} {assessment.createdBy.lastName} ({assessment.createdBy.role})
                        </p>
                      ) : null}
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${verificationBadgeClass(assessment.verificationStatus)}`}>
                      {assessment.verificationStatus}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => setPreviewAssessment(assessment)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                  </div>
                  <Input
                    className="mt-3"
                    placeholder="Optional verification note"
                    value={verificationNotes[assessment.id] ?? ""}
                    onChange={(event) =>
                      setVerificationNotes((prev) => ({
                        ...prev,
                        [assessment.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={verifyingAssessmentId === assessment.id}
                      onClick={() => void verifyAssessment(assessment.id, "APPROVE")}
                    >
                      {verifyingAssessmentId === assessment.id ? "Saving..." : "Approve"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/30"
                      disabled={verifyingAssessmentId === assessment.id}
                      onClick={() => void verifyAssessment(assessment.id, "REJECT")}
                    >
                      {verifyingAssessmentId === assessment.id ? "Saving..." : "Reject"}
                    </Button>
                  </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Assessment Preview Dialog */}
      <Dialog open={!!previewAssessment} onOpenChange={(open) => { if (!open) setPreviewAssessment(null); }}>
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          {previewAssessment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{previewAssessment.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400">
                      <span>{previewAssessment.program?.name}</span>
                      {previewAssessment.module && <span>{previewAssessment.module.title}</span>}
                      <span>{previewAssessment.type}</span>
                      <span>Pass: {previewAssessment.passScore}/{previewAssessment.totalPoints} pts</span>
                      {previewAssessment.dueDate && (
                        <span>Due: {new Date(previewAssessment.dueDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                    </div>
                    {previewAssessment.createdBy && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        By {previewAssessment.createdBy.firstName} {previewAssessment.createdBy.lastName} · {previewAssessment.createdBy.role}
                      </p>
                    )}
                    {previewAssessment.description && (
                      <p className="mt-2 text-slate-600 dark:text-slate-300">{previewAssessment.description}</p>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-2 space-y-3">
                {previewAssessment.questions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
                    No questions added yet.
                  </p>
                ) : (
                  previewAssessment.questions.map((q, i) => (
                    <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {i + 1}. {q.prompt}
                        </p>
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                          {q.points} pt{q.points !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {q.type === "OPEN_ENDED" ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            disabled
                            placeholder="Student writes their answer here…"
                            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900"
                            rows={3}
                          />
                          {q.answerKey && (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              <span className="font-semibold">Answer key:</span> {q.answerKey}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 space-y-1.5">
                          {q.options.map((opt) => (
                            <div
                              key={opt.id}
                              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${
                                opt.isCorrect
                                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30"
                                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                              }`}
                            >
                              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                                opt.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-slate-300 dark:border-slate-600"
                              }`}>
                                {opt.isCorrect && <CheckCircle2 className="h-3 w-3 text-white" />}
                              </div>
                              <span className={opt.isCorrect ? "font-medium text-emerald-800 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"}>
                                {opt.label}
                              </span>
                              {opt.isCorrect && (
                                <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400">Correct</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {roleCanCreate ? (
        <section className="kat-card flex max-h-[70dvh] min-h-0 flex-col">
          <h3 className="[font-family:var(--font-space-grotesk)] text-lg font-semibold">Manual Grading Queue</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{pendingManual.length} submission(s) awaiting manual review.</p>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-3">
              {pendingManual.map((submission) => (
                <div key={submission.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {submission.assessment.title}
                  {submission.student ? ` - ${submission.student.firstName} ${submission.student.lastName}` : ""}
                </p>
                <div className="mt-3 space-y-2">
                  {submission.answers
                    .filter((answer) => answer.question.type === "OPEN_ENDED")
                    .map((answer) => (
                      <div key={answer.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                        <p className="text-sm font-medium dark:text-slate-100">{answer.question.prompt}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{answer.responseText || "No response provided."}</p>
                        <Input
                          className="mt-2"
                          type="number"
                          min={0}
                          max={answer.question.points}
                          placeholder={`Score (max ${answer.question.points})`}
                          onChange={(event) =>
                            setManualScore(
                              submission.id,
                              answer.id,
                              Number(event.target.value || 0),
                            )
                          }
                        />
                      </div>
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="w-full sm:w-auto" disabled={busy} onClick={() => void submitManualGrade(submission)}>
                    {busy ? "Saving..." : "Apply Manual Grade"}
                  </Button>
                  {submission.student && (
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={busy}
                      onClick={() => void grantRetake(
                        submission.assessment.id,
                        submission.student!.id,
                        `${submission.student!.firstName} ${submission.student!.lastName}`,
                      )}
                    >
                      Grant Retake
                    </Button>
                  )}
                </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
