import { extractText, getDocumentProxy } from "unpdf";
import { classifyAiError, userMessageFor } from "@/lib/ai/errors";
import { structureResume, ResumeTooShortError } from "@/lib/ai/resume";
import { saveResume } from "@/lib/data/resume.data";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const maxDuration = 60;

/** Reject absurdly large uploads before reading them into memory. */
const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { success: false, error: "You must be signed in." },
        { status: 401 }
      );
    }

    const { allowed } = await checkRateLimit(
      user.id,
      "resumeParse",
      RATE_LIMITS.resumeParse
    );
    if (!allowed) {
      return Response.json(
        { success: false, error: "Daily résumé-upload limit reached." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("resume");

    if (!(file instanceof File)) {
      return Response.json(
        { success: false, error: "No PDF file was provided." },
        { status: 400 }
      );
    }

    if (file.type && file.type !== "application/pdf") {
      return Response.json(
        { success: false, error: "Please upload a PDF file." },
        { status: 400 }
      );
    }

    if (file.size > MAX_PDF_BYTES) {
      return Response.json(
        { success: false, error: "PDF is too large (max 5 MB)." },
        { status: 413 }
      );
    }

    // Extract text from the PDF (serverless-friendly, no native bindings).
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractText(pdf, { mergePages: true });
    const rawText = Array.isArray(text) ? text.join("\n") : text;

    // Structure with Gemini (throws ResumeTooShortError for image-only PDFs).
    const parsed = await structureResume(rawText);

    await saveResume({
      userId: user.id,
      parsed,
      rawTextLength: rawText.trim().length,
    });

    return Response.json({ success: true, resume: parsed });
  } catch (error) {
    console.error("resume parse error:", error);

    if (error instanceof ResumeTooShortError) {
      return Response.json(
        { success: false, error: error.message },
        { status: 422 }
      );
    }

    // Never echo provider errors ("Failed after 2 attempts. This model is
    // currently experiencing high demand…") — map them to a clear message.
    // 503, not 429: the client reserves 429 for our own daily limit.
    const kind = classifyAiError(error);
    return Response.json(
      {
        success: false,
        error: userMessageFor(error, "Reading your résumé"),
        retryable: kind !== "unknown",
      },
      { status: kind === "unknown" ? 500 : 503 }
    );
  }
}
