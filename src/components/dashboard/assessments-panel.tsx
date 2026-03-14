"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Eye, GripVertical, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  questions: {
    id: string;
    prompt: string;
    type: QuestionTypeValue;
    points: number;
    answerKey?: string | null;
    options: { id: string; label: string; value: string; isCorrect?: boolean }[];
  }[];
  submissions?: { id: string; status: string; totalScore: number; submittedAt: string }[];
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
  const [expandedVerificationAssessmentIds, setExpandedVerificationAssessmentIds] = useState<string[]>([]);

  const [programId, setProgramId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AssessmentTypeValue>("QUIZ");
  const [passScore, setPassScore] = useState("10");
  const [dueDate, setDueDate] = useState("");
  const [published, setPublished] = useState(true);
  const [questionDrafts, setQuestionDrafts] = useState<QuestionDraft[]>([
    {
      ...createQuestionDraft("MULTIPLE_CHOICE"),
      prompt: "What is React used for?",
    },
    {
      ...createQuestionDraft("OPEN_ENDED"),
      prompt: "Explain one use-case for context in React.",
      points: "10",
    },
  ]);
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

  const roleCanCreate = CREATOR_ROLES.includes(role);
  const roleCanSubmit = LEARNER_ROLES.includes(role);
  const roleCanVerify = role === "SUPER_ADMIN";
  const pendingManual = useMemo(
    () => submissions.filter((submission) => submission.status === "IN_REVIEW"),
    [submissions],
  );
  const verificationQueue = useMemo(
    () => assessments.filter((assessment) => assessment.verificationStatus !== "APPROVED"),
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

  const toggleVerificationPreview = (assessmentId: string) => {
    setExpandedVerificationAssessmentIds((previous) =>
      previous.includes(assessmentId)
        ? previous.filter((id) => id !== assessmentId)
        : [...previous, assessmentId],
    );
  };

  const verificationBadgeClass = (status: AssessmentVerificationStatusValue) => {
    if (status === "APPROVED") {
      return "bg-emerald-100 text-emerald-700";
    }
    if (status === "REJECTED") {
      return "bg-rose-100 text-rose-700";
    }
    return "bg-amber-100 text-amber-800";
  };

  return (
    <div className="space-y-4">
      {roleCanCreate ? (
        <section className="kat-card flex max-h-[78dvh] min-h-0 flex-col">
          <h3 className="font-[var(--font-space-grotesk)] text-lg font-semibold">Create Assessment</h3>
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
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
              Publish now (visible to learners only after super-admin verification)
            </label>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Question Builder</p>
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
            <p className="text-xs text-slate-600">
              {questionDrafts.length} question(s), {draftTotalPoints} total point(s).
            </p>

            {builderView === "EDIT" ? (
              <div className="space-y-3">
                {questionDrafts.map((question, index) => (
                  <div
                    key={question.id}
                    onDragOver={(event) => onQuestionDragOver(event, question.id)}
                    onDrop={() => onQuestionDrop(question.id)}
                    className={`rounded-lg border bg-white p-3 transition ${
                      dragOverQuestionId === question.id && draggingQuestionId !== question.id
                        ? "border-cyan-300 shadow-sm"
                        : "border-slate-200"
                    } ${draggingQuestionId === question.id ? "opacity-80" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex size-8 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 active:cursor-grabbing"
                          draggable
                          onDragStart={() => onQuestionDragStart(question.id)}
                          onDragEnd={onQuestionDragEnd}
                          aria-label={`Drag question ${index + 1}`}
                        >
                          <GripVertical className="size-4" />
                        </button>
                        <p className="text-sm font-semibold text-slate-900">Question {index + 1}</p>
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
                      className="mt-3 min-h-[80px] w-full rounded-md border border-slate-200 bg-white p-2 text-sm"
                      placeholder="Question prompt"
                      value={question.prompt}
                      onChange={(event) =>
                        updateQuestion(question.id, { prompt: event.target.value })
                      }
                    />

                    {question.type === "OPEN_ENDED" ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Open-ended questions are graded manually.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Options</p>
                        {question.options.map((option) => (
                          <div
                            key={option.id}
                            className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 p-2 sm:grid-cols-[auto_1fr_1fr_auto]"
                          >
                            <label className="flex items-center gap-2 text-xs text-slate-600">
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
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-600">
                  Preview uses your current draft settings and question order.
                </p>
                {questionDrafts.map((question, index) => (
                  <div key={question.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {index + 1}. {question.prompt.trim() || "Untitled question"}
                      </p>
                      <span className="text-xs text-slate-500">
                        {question.points || "0"} pt - {question.type}
                      </span>
                    </div>
                    {question.type === "OPEN_ENDED" ? (
                      <textarea
                        className="mt-2 min-h-[80px] w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-sm"
                        placeholder="Student response..."
                        disabled
                      />
                    ) : (
                      <div className="mt-2 space-y-1">
                        {question.options.map((option) => (
                          <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
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
              className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white p-3 text-sm"
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
        <h3 className="font-[var(--font-space-grotesk)] text-lg font-semibold">Assessments</h3>
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
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{assessment.title}</p>
                    <p className="text-xs text-slate-600">
                      {assessment.program?.name} - Pass score: {assessment.passScore}/{assessment.totalPoints}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {assessment.type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${verificationBadgeClass(assessment.verificationStatus)}`}
                    >
                      {assessment.verificationStatus}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        assessment.published ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {assessment.published ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>

                {roleCanSubmit ? (
                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    {assessment.questions.map((question) => (
                      <div key={question.id} className="rounded-lg border border-slate-100 p-3">
                        <p className="text-sm font-medium text-slate-900">{question.prompt}</p>
                        {question.type === "OPEN_ENDED" ? (
                          <textarea
                            className="mt-2 min-h-[80px] w-full rounded-md border border-slate-200 p-2 text-sm"
                            onChange={(event) =>
                              updateAnswerDraft(assessment.id, question.id, { responseText: event.target.value })
                            }
                          />
                        ) : (
                          <div className="mt-2 space-y-1">
                            {question.options.map((option) => (
                              <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
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
                      {busy ? "Submitting..." : "Submit Assessment"}
                    </Button>
                  </div>
                ) : null}

                {roleCanCreate ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
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
          <h3 className="font-[var(--font-space-grotesk)] text-lg font-semibold">Assessment Verification Queue</h3>
          <p className="text-sm text-slate-600">
            {verificationQueue.length} assessment(s) require super-admin review before learners can access them.
          </p>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-3">
              {verificationQueue.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  No pending verification tasks.
                </div>
              ) : (
                verificationQueue.map((assessment) => (
                  <div key={assessment.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{assessment.title}</p>
                      <p className="text-xs text-slate-600">
                        {assessment.program?.name} - {assessment.type} - {assessment.passScore}/{assessment.totalPoints}
                      </p>
                      {assessment.createdBy ? (
                        <p className="text-xs text-slate-500">
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
                      variant="ghost"
                      onClick={() => toggleVerificationPreview(assessment.id)}
                    >
                      {expandedVerificationAssessmentIds.includes(assessment.id) ? "Hide Assessment" : "View Assessment"}
                    </Button>
                  </div>
                  {expandedVerificationAssessmentIds.includes(assessment.id) ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      {assessment.description ? <p className="text-sm text-slate-700">{assessment.description}</p> : null}
                      <p className="text-xs text-slate-500">
                        Due: {assessment.dueDate ? new Date(assessment.dueDate).toLocaleString() : "No due date"}
                      </p>
                      <div className="space-y-2">
                        {assessment.questions.length === 0 ? (
                          <p className="text-xs text-slate-500">No questions found on this assessment.</p>
                        ) : (
                          assessment.questions.map((question, index) => (
                            <div key={question.id} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-slate-900">
                                  {index + 1}. {question.prompt}
                                </p>
                                <span className="text-xs text-slate-500">
                                  {question.type} - {question.points} point(s)
                                </span>
                              </div>
                              {question.type === "OPEN_ENDED" ? (
                                <p className="mt-2 text-xs text-slate-600">
                                  Manual grading required.
                                  {question.answerKey ? ` Suggested key: ${question.answerKey}` : ""}
                                </p>
                              ) : (
                                <div className="mt-2 space-y-1">
                                  {question.options.map((option) => (
                                    <div
                                      key={option.id}
                                      className={`flex items-center justify-between rounded-md border px-2 py-1 text-xs ${
                                        option.isCorrect
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : "border-slate-200 bg-white text-slate-700"
                                      }`}
                                    >
                                      <span>{option.label}</span>
                                      {option.isCorrect ? <span className="font-semibold">Correct</span> : null}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
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
                      className="border-rose-200 text-rose-700 hover:bg-rose-50"
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

      {roleCanCreate ? (
        <section className="kat-card flex max-h-[70dvh] min-h-0 flex-col">
          <h3 className="font-[var(--font-space-grotesk)] text-lg font-semibold">Manual Grading Queue</h3>
          <p className="text-sm text-slate-600">{pendingManual.length} submission(s) awaiting manual review.</p>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-3">
              {pendingManual.map((submission) => (
                <div key={submission.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-medium text-slate-900">
                  {submission.assessment.title}
                  {submission.student ? ` - ${submission.student.firstName} ${submission.student.lastName}` : ""}
                </p>
                <div className="mt-3 space-y-2">
                  {submission.answers
                    .filter((answer) => answer.question.type === "OPEN_ENDED")
                    .map((answer) => (
                      <div key={answer.id} className="rounded-lg border border-slate-100 p-3">
                        <p className="text-sm font-medium">{answer.question.prompt}</p>
                        <p className="mt-1 text-sm text-slate-700">{answer.responseText || "No response provided."}</p>
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
                <Button className="mt-3 w-full sm:w-auto" disabled={busy} onClick={() => void submitManualGrade(submission)}>
                  {busy ? "Saving..." : "Apply Manual Grade"}
                </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
