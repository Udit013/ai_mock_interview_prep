"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField as UIFormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import FormField from "@/components/FormField";
import { COMPANY_MODES } from "@/constants/companies";
import { MAX_JD_CHARS, MIN_JD_CHARS } from "@/lib/interview/job-description";
import { MAX_COMPANY_CHARS, matchCompanyMode } from "@/lib/interview/company";

const schema = z.object({
  role: z.string().min(2, "Role must be at least 2 characters"),
  level: z.enum(["Junior", "Mid", "Senior"]),
  type: z.enum(["Technical", "Behavioral", "Mixed", "System Design", "Coding"]),
  techstack: z.string().optional(),
  amount: z.coerce.number().min(3).max(15),
  companyMode: z.string().optional(),
  companyName: z
    .string()
    .max(MAX_COMPANY_CHARS, `Keep the company name under ${MAX_COMPANY_CHARS} characters.`)
    .optional(),
  jobDescription: z
    .string()
    .max(MAX_JD_CHARS, `Keep it under ${MAX_JD_CHARS.toLocaleString()} characters — trim boilerplate like benefits and legal text.`)
    .optional()
    .refine(
      (v) => !v || v.trim().length === 0 || v.trim().length >= MIN_JD_CHARS,
      "Paste the full job description, or leave this empty."
    ),
});

type FormValues = z.infer<typeof schema>;

type Mode = "manual" | "resume";

// Shape returned by /api/resume/parse — mirrors ParsedResume.
interface ParsedResumeData {
  summary: string;
  skills: string[];
  projects: { name: string; description: string; technologies: string[] }[];
  experiences: { company: string; role: string; highlights: string[] }[];
  technologies: string[];
}

// Identity is derived server-side from the session cookie; no userId prop needed.
const InterviewForm = () => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("manual");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [resume, setResume] = useState<ParsedResumeData | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Which button submitted the form: open the interview now, or save it. */
  const intentRef = useRef<"start" | "save">("start");
  const [intent, setIntent] = useState<"start" | "save">("start");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "",
      level: "Mid",
      type: "Mixed",
      techstack: "",
      amount: 5,
      companyMode: "",
      companyName: "",
      jobDescription: "",
    },
  });

  const handleResumeUpload = async (file: File) => {
    setParsing(true);
    setResume(null);
    setResumeFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch("/api/resume/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error ?? "Failed to read resume.");
      }

      setResume(data.resume as ParsedResumeData);
      toast.success("Resume parsed! Review the details below, then generate.");
    } catch (e) {
      setResumeFileName("");
      toast.error(e instanceof Error ? e.message : "Failed to read resume.");
    } finally {
      setParsing(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    // Tech stack is optional: with none supplied the generator infers what the
    // role actually requires, so there's nothing to block on here.
    if (mode === "resume" && !resume) {
      toast.error("Upload a résumé first so questions can reference your work.");
      return;
    }

    // Typing a company we have an interview style for (e.g. "Google") applies
    // that style automatically unless one was picked explicitly.
    const companyName = values.companyName?.trim() || undefined;
    const companyMode =
      values.companyMode ||
      matchCompanyMode(companyName, Object.values(COMPANY_MODES))?.id ||
      "";

    setLoading(true);
    try {
      const res = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          techstack: values.techstack?.trim() ?? "",
          source: mode,
          visibility,
          resumeContext: mode === "resume" ? resume : undefined,
          jobDescription: values.jobDescription?.trim() || undefined,
          companyName,
          companyMode,
        }),
      });

      if (res.status === 401) {
        toast.error("Your session expired. Please sign in again.");
        router.push("/sign-in");
        return;
      }
      if (res.status === 429) {
        toast.error(
          "You've reached today's limit for creating interviews. Try again tomorrow."
        );
        return;
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Generation failed");

      if (intentRef.current === "start" && data.interviewId) {
        toast.success("Interview ready — starting now.");
        router.push(`/interview/${data.interviewId}?start=1`);
        return;
      }
      toast.success("Interview saved — find it on your dashboard.");
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Couldn't create the interview. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-border w-full max-w-2xl mx-auto">
      <div className="card flex flex-col gap-6 py-10 px-8 max-sm:px-5 max-sm:py-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl">Interview details</h2>
          <p className="text-light-400">
            Fill in the details below and we&apos;ll generate tailored
            questions for you.
          </p>
        </div>

        {/* Mode toggle */}
        <div role="group" aria-label="Interview source" className="segmented">
          {(["manual", "resume"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                // Résumé interviews are personal — default them to private.
                setVisibility(m === "resume" ? "private" : "public");
              }}
            >
              {m === "manual" ? "Manual setup" : "From résumé"}
            </button>
          ))}
        </div>

        {/* Résumé upload + preview */}
        {mode === "resume" && (
          <div className="flex flex-col gap-3">
            <span className="label">Upload résumé (PDF)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleResumeUpload(file);
              }}
            />
            <Button
              type="button"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary w-fit"
            >
              {parsing
                ? "Reading résumé…"
                : resumeFileName
                ? "Choose a different PDF"
                : "Choose PDF"}
            </Button>
            {resumeFileName && !parsing && (
              <p className="text-sm text-light-400">Loaded: {resumeFileName}</p>
            )}

            {resume && (
              <div className="flex flex-col gap-3 rounded-lg border border-dark-300 bg-dark-200 p-4">
                <p className="text-sm text-light-400">{resume.summary}</p>
                {resume.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {resume.skills.slice(0, 12).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-dark-300 px-3 py-1 text-xs"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {resume.projects.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold">
                      Projects we&apos;ll ask about:
                    </p>
                    <ul className="list-disc pl-5 text-sm text-light-400">
                      {resume.projects.slice(0, 4).map((p) => (
                        <li key={p.name}>{p.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="form flex flex-col gap-5"
          >
            <FormField
              control={form.control}
              name="role"
              label="Job Role"
              placeholder="e.g. Frontend Developer, ML Engineer…"
            />

            <FormField
              control={form.control}
              name="companyName"
              label="Company (optional)"
              placeholder="e.g. Stripe, Google, Deloitte"
              autoComplete="organization"
            />

            <UIFormField
              control={form.control}
              name="jobDescription"
              render={({ field }) => {
                const length = field.value?.trim().length ?? 0;
                const active = length >= MIN_JD_CHARS;
                return (
                  <FormItem>
                    <FormLabel className="label">
                      Job description (optional)
                    </FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={6}
                        placeholder="Paste the job posting — responsibilities, requirements, nice-to-haves…"
                        className="w-full resize-y rounded-2xl border border-white/5 bg-dark-200 px-5 py-4 text-sm leading-relaxed text-white placeholder:text-light-400 transition-colors hover:border-white/15 focus-visible:border-primary-200/60"
                      />
                    </FormControl>
                    <div className="flex items-start justify-between gap-4">
                      <FormDescription className="text-xs text-light-400">
                        {!active
                          ? "Paste a real posting and questions will target what this job actually asks for."
                          : mode === "resume" && resume
                          ? "Questions will connect your résumé to this job's requirements, probe gaps, and ask why you fit — like a real interview."
                          : mode === "resume"
                          ? "Upload your résumé too, and questions will connect your experience to this job."
                          : "Questions will target this job's responsibilities and must-have requirements."}
                      </FormDescription>
                      <span
                        aria-hidden="true"
                        className={`shrink-0 text-xs tabular-nums ${
                          (field.value?.length ?? 0) > MAX_JD_CHARS
                            ? "text-destructive-100"
                            : "text-light-400"
                        }`}
                      >
                        {(field.value?.length ?? 0).toLocaleString()} / {MAX_JD_CHARS.toLocaleString()}
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="flex gap-4 max-sm:flex-col">
              <div className="flex flex-col gap-2 flex-1">
                <label className="label" htmlFor="interview-level">Experience Level</label>
                <select
                  id="interview-level"
                  {...form.register("level")}
                  className="input bg-dark-200 text-white border border-white/5 rounded-full min-h-12 px-5 cursor-pointer transition-colors hover:border-white/15"
                >
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid-level</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <label className="label" htmlFor="interview-type">Interview Type</label>
                <select
                  id="interview-type"
                  {...form.register("type")}
                  className="input bg-dark-200 text-white border border-white/5 rounded-full min-h-12 px-5 cursor-pointer transition-colors hover:border-white/15"
                >
                  <option value="Technical">Technical</option>
                  <option value="Behavioral">Behavioral</option>
                  <option value="Mixed">Mixed</option>
                  <option value="System Design">System Design</option>
                  <option value="Coding">Coding (live editor)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="label" htmlFor="interview-company">Company Style (optional)</label>
              <select
                id="interview-company"
                aria-describedby="interview-company-hint"
                {...form.register("companyMode")}
                className="input bg-dark-200 text-white border border-white/5 rounded-full min-h-12 px-5 cursor-pointer transition-colors hover:border-white/15"
              >
                <option value="">Generic interview</option>
                <optgroup label="Software">
                  {Object.values(COMPANY_MODES)
                    .filter((c) => c.category === "software")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Consulting">
                  {Object.values(COMPANY_MODES)
                    .filter((c) => c.category === "consulting")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </optgroup>
              </select>
              <p id="interview-company-hint" className="text-xs text-light-400">
                Tailors the interviewer&apos;s style, question emphasis, and
                evaluation criteria to that company&apos;s real process.
              </p>
            </div>

            {mode === "manual" && (
              <div className="flex flex-col gap-1">
                <FormField
                  control={form.control}
                  name="techstack"
                  label="Tech Stack (optional)"
                  placeholder="e.g. React, Node.js, PostgreSQL, AWS"
                />
                <p className="text-xs text-light-400">
                  Leave blank and we&apos;ll infer the skills a{" "}
                  {form.watch("level").toLowerCase()}{" "}
                  {form.watch("role")?.trim() || "candidate"} is expected to know.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="label" htmlFor="interview-amount">
                Number of Questions:{" "}
                <span className="text-primary-100 font-bold">
                  {form.watch("amount")}
                </span>
              </label>
              <input
                id="interview-amount"
                type="range"
                min={3}
                max={15}
                step={1}
                {...form.register("amount")}
                className="w-full accent-primary-200"
              />
              <div className="flex justify-between text-xs text-light-400">
                <span>3</span>
                <span>15</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="label" id="interview-visibility">Visibility</span>
              <div
                role="group"
                aria-labelledby="interview-visibility"
                className="segmented"
              >
                {(["public", "private"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={visibility === v}
                    onClick={() => setVisibility(v)}
                    className="capitalize"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-xs text-light-400">
                {visibility === "private"
                  ? "Only you can see this interview. Recommended for résumé-based interviews."
                  : "Other users may see this interview in the community feed (no feedback is shared)."}
              </p>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 max-sm:flex-col">
              <Button
                type="submit"
                onClick={() => {
                  intentRef.current = "start";
                  setIntent("start");
                }}
                disabled={loading || (mode === "resume" && !resume)}
                aria-busy={loading && intent === "start"}
                className="btn-primary max-sm:w-full"
              >
                {loading && intent === "start"
                  ? "Preparing your interview…"
                  : "Start interview now"}
              </Button>
              <Button
                type="submit"
                onClick={() => {
                  intentRef.current = "save";
                  setIntent("save");
                }}
                disabled={loading || (mode === "resume" && !resume)}
                aria-busy={loading && intent === "save"}
                className="btn-secondary max-sm:w-full"
              >
                {loading && intent === "save" ? "Saving…" : "Save for later"}
              </Button>
            </div>
            <p className="text-xs text-light-400">
              Questions take a few seconds to generate.{" "}
              {mode === "resume"
                ? "They'll reference your résumé"
                : "They'll be tailored to the role"}
              {form.watch("jobDescription")?.trim() ? " and the job description" : ""}.
            </p>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default InterviewForm;
