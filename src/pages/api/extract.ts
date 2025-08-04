import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { File as FormidableFile } from "formidable";
import fs from "fs";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req: NextApiRequest): Promise<{ files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ files });
    });
  });
}

async function extractDocxTextFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (err) {
    console.error("[DOCX] Extraction error:", err);
    throw err;
  }
}

async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (err) {
    console.error("[PDF] Extraction error:", err);
    throw err;
  }
}

async function extractImageTextFromBuffer(buffer: Buffer): Promise<string> {
  try {
    const { data: { text } } = await Tesseract.recognize(buffer, "eng");
    return text;
  } catch (err) {
    console.error("[IMG] Extraction error:", err);
    throw err;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ text: "Method Not Allowed" });
    return;
  }
  try {
    const { files } = await parseForm(req);
    let extractedText = "";
    const fileArray = Array.isArray(files.files) ? files.files : [files.files];
    for (const file of fileArray) {
      if (!file) continue;
      const f = file as FormidableFile;
      const filePath = f.filepath;
      const buffer = fs.readFileSync(filePath);
      const fileName = f.originalFilename || "unknown";
      const mimeType = f.mimetype || "";
      console.log(`[INFO] Processing file: ${fileName}, type: ${mimeType}`);
      if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
        extractedText += buffer.toString("utf-8") + "\n";
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".docx")
      ) {
        try {
          extractedText += await extractDocxTextFromBuffer(buffer) + "\n";
        } catch (e) {
          extractedText += `[Failed to extract DOCX: ${fileName}]\n`;
        }
      } else if (
        mimeType === "application/pdf" || fileName.endsWith(".pdf")
      ) {
        try {
          extractedText += await extractPdfTextFromBuffer(buffer) + "\n";
        } catch (e) {
          extractedText += `[Failed to extract PDF: ${fileName}]\n`;
        }
      } else if (
        mimeType.startsWith("image/") ||
        [".png", ".jpg", ".jpeg", ".webp", ".bmp"].some(ext => fileName.toLowerCase().endsWith(ext))
      ) {
        try {
          extractedText += await extractImageTextFromBuffer(buffer) + "\n";
        } catch (e) {
          extractedText += `[Failed to extract image text: ${fileName}]\n`;
        }
      } else {
        extractedText += `[Unsupported file type: ${fileName}]\n`;
      }
    }
    res.status(200).json({ text: extractedText.trim() });
  } catch (err) {
    console.error("[FATAL] Extraction route error:", err);
    res.status(500).json({ text: "[Fatal error in extraction]" });
  }
} 