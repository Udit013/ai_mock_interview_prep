"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import FormField from "@/components/FormField";
import { cn } from "@/lib/utils";

const schema = z.object({
  role: z.string().min(2, "Role must be at least 2 characters"),
  level: z.enum(["Junior", "Mid", "Senior"]),
  type: z.enum(["Technical", "Behavioral", "Mixed"]),
  techstack: z.string().optional(),
  amount: z.coerce.number().min(3).max(15),
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

const InterviewForm = ({ userId }: { userId: string }) => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("manual");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [resume, setResume] = useState<ParsedResumeData | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: "",
      level: "Mid",
      type: "Mixed",
      techstack: "",
      amount: 5,
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
    if (mode === "manual" && (!values.techstack || values.techstack.length < 2)) {
      form.setError("techstack", { message: "Enter at least one technology" });
      return;
    }
    if (mode === "resume" && !resume) {
      toast.error("Upload and parse a resume first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          userid: userId,
          source: mode,
          resumeContext: mode === "resume" ? resume : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Generation failed");
      toast.success("Interview created! Starting now…");
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-border w-full max-w-2xl mx-auto">
      <div className="card flex flex-col gap-6 py-10 px-8">
        <div className="flex flex-col gap-1">
          <h3>Create Your Interview</h3>
          <p className="text-light-400">
            Fill in the details below and we&apos;ll generate tailored
            questions for you.
          </p>
        </div>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Interview source"
          className="flex gap-2 rounded-lg bg-dark-200 p-1"
        >
          {(["manual", "resume"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                mode === m
                  ? "bg-primary-200 text-dark-100"
                  : "text-light-400 hover:text-white"
              )}
            >
              {m === "manual" ? "Manual setup" : "From résumé"}
            </button>
          ))}
        </div>

        {/* Résumé upload + preview */}
        {mode === "resume" && (
          <div className="flex flex-col gap-3">
            <label className="label">Upload résumé (PDF)</label>
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
            className="flex flex-col gap-5"
          >
            <FormField
              control={form.control}
              name="role"
              label="Job Role"
              placeholder="e.g. Frontend Developer, ML Engineer…"
            />

            <div className="flex gap-4 max-sm:flex-col">
              <div className="flex flex-col gap-2 flex-1">
                <label className="label">Experience Level</label>
                <select
                  {...form.register("level")}
                  className="input bg-dark-200 text-white border border-dark-300 rounded-lg px-3 py-2"
                >
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid-level</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <label className="label">Interview Type</label>
                <select
                  {...form.register("type")}
                  className="input bg-dark-200 text-white border border-dark-300 rounded-lg px-3 py-2"
                >
                  <option value="Technical">Technical</option>
                  <option value="Behavioral">Behavioral</option>
                  <option value="Mixed">Mixed</option>
                </select>
              </div>
            </div>

            {mode === "manual" && (
              <FormField
                control={form.control}
                name="techstack"
                label="Tech Stack"
                placeholder="e.g. React, Node.js, PostgreSQL, AWS"
              />
            )}

            <div className="flex flex-col gap-2">
              <label className="label">
                Number of Questions:{" "}
                <span className="text-primary-100 font-bold">
                  {form.watch("amount")}
                </span>
              </label>
              <input
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

            <Button
              type="submit"
              disabled={loading || (mode === "resume" && !resume)}
              className="btn-primary mt-2"
            >
              {loading
                ? "Generating Questions…"
                : mode === "resume"
                ? "Generate Interview From Résumé"
                : "Generate Interview"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default InterviewForm;
