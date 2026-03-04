import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

interface PromptItem {
  code: string;
  product: string;
  prompt: string;
}

interface ProgressEntry {
  status: "done" | "error";
  file?: string;
  error?: string;
  timestamp: string;
}

type ProgressMap = Record<string, ProgressEntry>;

const MODEL = "gemini-2.5-flash-image";
const PROJECTS_DIR = path.join(import.meta.dirname!, "projects");

function loadProgress(progressPath: string): ProgressMap {
  if (fs.existsSync(progressPath)) {
    return JSON.parse(fs.readFileSync(progressPath, "utf-8"));
  }
  return {};
}

function saveProgress(progressPath: string, progress: ProgressMap) {
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

async function generateImage(
  ai: GoogleGenAI,
  item: PromptItem,
  outputDir: string
): Promise<{ file: string } | { error: string }> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: item.prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  for (const part of response.candidates![0].content!.parts!) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data!, "base64");
      const ext = part.inlineData.mimeType === "image/png" ? "png" : "png";
      const filename = `${item.code}.${ext}`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, buffer);
      return { file: filepath };
    }
  }

  return { error: "No image data in response" };
}

async function main() {
  const project = process.argv[2];
  const limit = process.argv[3] ? parseInt(process.argv[3], 10) : Infinity;
  if (!project) {
    console.error("Usage: npx tsx generate.ts <project> [limit]");
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY in .env");
    process.exit(1);
  }

  const projectDir = path.join(PROJECTS_DIR, project);
  const inputDir = path.join(projectDir, "input");
  const outputDir = path.join(projectDir, "output");
  const inputPath = path.join(inputDir, "prompts.json");
  const progressPath = path.join(projectDir, "progress.json");

  if (!fs.existsSync(inputPath)) {
    console.error(`Not found: ${inputPath}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const prompts: PromptItem[] = JSON.parse(
    fs.readFileSync(inputPath, "utf-8")
  );
  const progress = loadProgress(progressPath);
  const ai = new GoogleGenAI({ apiKey });

  const pending = prompts.filter((p) => progress[p.code]?.status !== "done");
  const batch = pending.slice(0, limit);
  console.log(
    `[${project}] ${prompts.length} total | ${prompts.length - pending.length} done | ${pending.length} remaining | processing ${batch.length}`
  );

  for (const item of batch) {
    console.log(`[${item.code}] ${item.product} ...`);
    try {
      const result = await generateImage(ai, item, outputDir);
      if ("file" in result) {
        progress[item.code] = {
          status: "done",
          file: result.file,
          timestamp: new Date().toISOString(),
        };
        console.log(`  -> saved ${result.file}`);
      } else {
        progress[item.code] = {
          status: "error",
          error: result.error,
          timestamp: new Date().toISOString(),
        };
        console.error(`  -> error: ${result.error}`);
      }
    } catch (err: any) {
      progress[item.code] = {
        status: "error",
        error: err.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`  -> error: ${err.message}`);
    }
    saveProgress(progressPath, progress);
  }

  const doneCount = Object.values(progress).filter(
    (e) => e.status === "done"
  ).length;
  console.log(`\nComplete: ${doneCount}/${prompts.length}`);
}

main();
