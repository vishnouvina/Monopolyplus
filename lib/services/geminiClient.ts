import { GoogleGenerativeAI } from "@google/generative-ai";

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

export class GeminiClient {
  private readonly apiKey?: string;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    this.apiKey = apiKey;
  }

  isEnabled() {
    return Boolean(this.apiKey);
  }

  async parseImagesToJson(input: {
    prompt: string;
    images: Array<{ mimeType: string; bytes: Buffer }>;
    model?: string;
  }) {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const ai = new GoogleGenerativeAI(this.apiKey);
    const model = ai.getGenerativeModel({ model: input.model ?? "gemini-flash-lite-latest" });

    const parts = [
      { text: `${input.prompt}\nReturn strict JSON only.` },
      ...input.images.map((img) => ({
        inlineData: {
          data: img.bytes.toString("base64"),
          mimeType: img.mimeType
        }
      }))
    ];

    const result = await model.generateContent({
      contents: [{ role: "user", parts }]
    });

    const text = result.response.text();
    return extractJson(text);
  }
}
