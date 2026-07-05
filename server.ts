import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Allow larger payloads (up to 50MB) since users will be uploading multiple page images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Validate API Key presence
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: API Key is not defined in the environment variables.');
}

// Initialize AI SDK with telemetry User-Agent as required by system guidelines
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * API route to extract structured fields from a single document image.
 * Uses gemini-3.5-flash for fast and highly accurate Hindi text extraction.
 */
app.post('/api/extract', async (req, res) => {
  try {
    const { image, fields } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data is required.' });
    }
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: 'At least one extraction field is required.' });
    }

    // Parse the file data. Check if it is a base64 Data URL or raw base64.
    const base64Match = image.match(/^data:([^;]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let rawBase64 = image;

    if (base64Match) {
      mimeType = base64Match[1];
      rawBase64 = base64Match[2];
    }

    // Setup the file part for Gemini multimodel input
    const imagePart = {
      inlineData: {
        mimeType,
        data: rawBase64,
      },
    };

    // Dynamically build a JSON Schema for a list of rows with the requested fields
    const rowProperties: Record<string, any> = {};
    const rowRequired: string[] = [];

    fields.forEach((field: { id: string; name: string; instruction: string }) => {
      rowProperties[field.id] = {
        type: Type.STRING,
        description: `Extract the value of column '${field.name}' in this row. Keep it EXACTLY as written in the table (Hindi Devanagari script or English). If not present or blank, return empty string "".`,
      };
      rowRequired.push(field.id);
    });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        rows: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: rowProperties,
            required: rowRequired,
          },
          description: 'A list of all data rows found in the table. Extract every single row from top to bottom precisely.',
        }
      },
      required: ['rows'],
    };

    // Construct guidance for the OCR engine
    const prompt = `You are a professional Hindi and English document OCR and structured table data extraction engine.
Your task is to identify the main data table in the provided document image and extract ALL of its rows.

CRITICAL INSTRUCTION: If there are multiple tables on this page (e.g., an upper table and a lower/second table), you MUST ONLY extract rows from the FIRST/UPPER table. Fully IGNORE the second/lower table or any other secondary tables on the page completely.

For each row of the first/upper table, extract the values corresponding to the following columns: ${fields.map((f: any) => `'${f.name}'`).join(', ')}.

Guidelines:
1. The upper table contains multiple data rows. You MUST extract EVERY row from top to bottom. Do not limit yourself to just the first row.
2. For each row, provide the cell values for the requested columns exactly as printed or written in the image.
3. Extract Hindi text EXACTLY as it appears in Devanagari script (e.g. "राम", "उत्तर प्रदेश", "₹५००"). Do not translate Hindi names, titles, or values to English, but transcribe them perfectly.
4. Extract English text or numbers in standard English/digits format.
5. If a cell is empty or a column is not present for a row, return an empty string "" for that column.
6. Make sure the rows array preserves the original tabular order from top to bottom.`;

    // Call Gemini API with automatic fallback to gemini-3.1-flash-lite if gemini-3.5-flash is rate limited (429/RESOURCE_EXHAUSTED)
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [imagePart, { text: prompt }],
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.1, // low temperature ensures high facts accuracy and strict schema adherence
        },
      });
    } catch (err: any) {
      const errStr = JSON.stringify(err);
      const isQuotaExceeded = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')));
      if (isQuotaExceeded) {
        console.warn('Primary model quota exceeded, attempting fallback engine');
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [imagePart, { text: prompt }],
          config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.1,
          },
        });
      } else {
        throw err;
      }
    }

    const responseText = response.text;
    if (!responseText) {
      throw new Error('AI API returned an empty response.');
    }

    const extractedData = JSON.parse(responseText.trim());
    return res.json({ success: true, data: extractedData });
  } catch (error: any) {
    console.error('Error in /api/extract:', error);
    return res.status(500).json({ error: error.message || 'Failed to extract data from image.' });
  }
});

/**
 * API route to analyze a document image first to find table headings and the main title.
 * This is used for the interactive user reference selection flow.
 */
app.post('/api/analyze-headers', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const base64Match = image.match(/^data:([^;]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let rawBase64 = image;

    if (base64Match) {
      mimeType = base64Match[1];
      rawBase64 = base64Match[2];
    }

    const imagePart = {
      inlineData: {
        mimeType,
        data: rawBase64,
      },
    };

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        documentTitle: {
          type: Type.STRING,
          description: 'The main title or heading of this document/page in Hindi or English (e.g. "रसीद", "बिल", "विवरण", "प्रमाण पत्र" or the boldest top title). If not found, return empty string "".',
        },
        headings: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: 'A list of table headers / column names found in the first/upper table of the page. Examples: ["क्रमांक", "नाम", "विवरण", "मात्रा", "दर", "कुल राशि"]. Limit to the visible column headers in Devanagari script or English exactly as printed.',
        },
      },
      required: ['documentTitle', 'headings'],
    };

    const prompt = `You are an expert Devanagari/Hindi document analyzer.
Inspect the provided document image and extract:
1. The main top-level heading/title of the page or document.
2. The column headers (headings) of the first/upper table on the page ONLY. If there is a second table or lower table, fully IGNORE its headings. Ensure you extract the column names exactly as printed on the upper table header row.`;

    // Call Gemini API with automatic fallback to gemini-3.1-flash-lite if gemini-3.5-flash is rate limited (429/RESOURCE_EXHAUSTED)
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [imagePart, { text: prompt }],
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.1,
        },
      });
    } catch (err: any) {
      const errStr = JSON.stringify(err);
      const isQuotaExceeded = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || (err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')));
      if (isQuotaExceeded) {
        console.warn('Primary model quota exceeded in analyze-headers, attempting fallback engine');
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [imagePart, { text: prompt }],
          config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.1,
          },
        });
      } else {
        throw err;
      }
    }

    const responseText = response.text;
    if (!responseText) {
      throw new Error('AI API returned empty response for header analysis.');
    }

    const parsedData = JSON.parse(responseText.trim());
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error in /api/analyze-headers:', error);
    return res.status(500).json({ error: error.message || 'Failed to analyze page headers.' });
  }
});

/**
 * Proxy route to append transaction logs to a Google Sheets Apps Script Web App.
 * Helps the user track customer payments securely without exposing client credentials.
 */
app.post('/api/submit-transaction', async (req, res) => {
  try {
    const { webhookUrl, invoiceId, date, credits, amount, utr, recipient } = req.body;
    const targetUrl = webhookUrl || process.env.GOOGLE_SHEET_WEBHOOK_URL;

    if (!targetUrl) {
      console.warn('Google Sheet URL is not configured. Falling back to local receipt simulation.');
      return res.json({ success: true, localOnly: true });
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, date, credits, amount, utr, recipient })
    });

    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error('Error submitting transaction to Google Sheet:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit transaction.' });
  }
});

/**
 * Proxy route to verify a customer redeem code from the Google Sheets Web App.
 */
app.post('/api/redeem-code', async (req, res) => {
  try {
    const { webhookUrl, code } = req.body;
    const targetUrl = webhookUrl || process.env.GOOGLE_SHEET_WEBHOOK_URL;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Google Sheet webhook is not configured by the admin yet.' });
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'redeem', code })
    });

    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error('Error verifying redeem code from Google Sheet:', error);
    return res.status(500).json({ error: error.message || 'Failed to verify redeem code.' });
  }
});

// Catch-all for non-existent /api/* routes to prevent serving React index.html and throwing JSON parsing errors
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// Global Express error handler to guarantee all middleware/Express errors are returned as JSON instead of HTML
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express global error handler caught error:', err);
  res.status(err.status || err.statusCode || 500).json({
    success: false,
    error: err.message || 'An internal server error occurred on the processing backend.'
  });
});

// Configure client serving based on environment
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  // In production, serve the built dist static files
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  // In development, hook up Vite in middleware mode
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://localhost:${PORT} [${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
});
