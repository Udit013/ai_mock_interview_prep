"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import FormField from "@/components/FormField";

const schema = z.object({
  role: z.string().min(2, "Role must be at least 2 characters"),
  level: z.enum(["Junior", "Mid", "Senior"]),
  type: z.enum(["Technical", "Behavioral", "Mixed"]),
  techstack: z.string().min(2, "Enter at least one technology"),
  amount: z.coerce.number().min(3).max(15),
});

type FormValues = z.infer<typeof schema>;

const InterviewForm = ({ userId }: { userId: string }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, userid: userId }),
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

            <FormField
              control={form.control}
              name="techstack"
              label="Tech Stack"
              placeholder="e.g. React, Node.js, PostgreSQL, AWS"
            />

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
              disabled={loading}
              className="btn-primary mt-2"
            >
              {loading ? "Generating Questions…" : "Generate Interview"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default InterviewForm;
