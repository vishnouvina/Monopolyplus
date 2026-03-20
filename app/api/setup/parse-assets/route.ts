import { NextResponse } from "next/server";
import { parseAssetsToDraft } from "@/lib/ingestion/assetParsingService";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form
      .getAll("assets")
      .filter((item): item is File => item instanceof File)
      .filter((file) => file.size > 0);

    const configName = String(form.get("configName") ?? "Uploaded Board");
    const allowGemini = String(form.get("allowGemini") ?? "true") !== "false";

    if (files.length === 0) {
      return NextResponse.json({ error: "Upload at least one asset file." }, { status: 400 });
    }

    const assets = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        bytes: Buffer.from(await file.arrayBuffer())
      }))
    );

    const parsed = await parseAssetsToDraft({
      assets,
      configName,
      allowGemini
    });

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset parsing failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
