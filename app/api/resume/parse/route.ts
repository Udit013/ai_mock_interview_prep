import { extractText, getDocumentProxy } from "unpdf";
import { structureResume, ResumeTooShortError } from "@/lib/ai/resume";
import { saveResume } from "@/lib/actions/resume.action";
import { getCurrentUser } from "@/lib/actions/auth.action";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { success: false, error: "You must be signed in." },
        { status: 401 }
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

    const message =
      error instanceof Error ? error.message : "Failed to parse resume.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
