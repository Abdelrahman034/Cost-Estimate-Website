/**
 * AI Service — powered by Groq (free tier)
 * Models used:
 *   Text:   llama-3.3-70b-versatile  (fast, free, excellent quality)
 *   Vision: meta-llama/llama-4-scout-17b-16e-instruct  (drawing analysis)
 *
 * Get your free API key at: https://console.groq.com
 * No credit card required.
 */
const Groq = require('groq-sdk');

function getClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set in your .env file. Get a free key at https://console.groq.com');
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

const TEXT_MODEL   = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// ─── Helper: parse JSON from LLM response ────────────────────────────────────
function extractJSON(text) {
  // Try to find a JSON block (with or without ```json fences)
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw    = text.match(/\{[\s\S]*\}/);
  const source = fenced ? fenced[1] : raw ? raw[0] : null;
  if (!source) return { raw: text, error: 'No JSON found in response' };
  try { return JSON.parse(source); } catch { return { raw: text, error: 'JSON parse failed' }; }
}

// ─── 1. DRAWING ANALYSIS ─────────────────────────────────────────────────────
async function analyzeDrawing(base64Image, mediaType = 'image/jpeg') {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mediaType};base64,${base64Image}`,
            },
          },
          {
            type: 'text',
            text: `You are an expert HVAC engineer analyzing a mechanical drawing.

Extract ALL of the following and return ONLY valid JSON (no markdown, no explanation):

{
  "ducts": [
    { "id": "D1", "size": "24x12", "shape": "rectangular", "type": "supply", "linearFeet": 45, "location": "Zone A", "notes": "" }
  ],
  "units": [
    { "tag": "AHU-1", "type": "Air Handling Unit", "cfm": 5000, "tons": 10, "model": "", "notes": "" }
  ],
  "diffusers": [
    { "type": "supply", "size": "24x24", "quantity": 8, "zone": "Floor 1" }
  ],
  "summary": {
    "totalDuctLinearFeet": 0,
    "totalDuctSqFt": 0,
    "drawingScale": "1/8 inch = 1 foot",
    "notes": ""
  }
}

Rules:
- For ducts: size uses "WxH" for rectangular (e.g. "24x12"), just the number for round (e.g. "12")
- Estimate linearFeet from the drawing scale if visible, otherwise your best estimate
- If a value is not visible, use null
- Return ONLY the JSON object, nothing else`,
          },
        ],
      },
    ],
  });

  return extractJSON(response.choices[0].message.content);
}

// ─── 2. LIVE PRICE FETCH ──────────────────────────────────────────────────────
async function getCurrentPrices() {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: 'You are an HVAC materials pricing expert. Return ONLY valid JSON, no markdown.',
      },
      {
        role: 'user',
        content: `Based on current US market conditions (2025), provide realistic pricing for HVAC sheet metal and materials.

Return this exact JSON structure with real numbers filled in:

{
  "lastUpdated": "${new Date().toISOString()}",
  "confidence": "medium",
  "sheetMetal": {
    "galvanizedSteel": {
      "gauge26": { "pricePerSqFt": 1.85, "unit": "$/sqft", "trend": "stable" },
      "gauge24": { "pricePerSqFt": 2.10, "unit": "$/sqft", "trend": "stable" },
      "gauge22": { "pricePerSqFt": 2.45, "unit": "$/sqft", "trend": "up" },
      "gauge20": { "pricePerSqFt": 2.90, "unit": "$/sqft", "trend": "up" },
      "gauge18": { "pricePerSqFt": 3.60, "unit": "$/sqft", "trend": "stable" }
    }
  },
  "insulation": {
    "ductWrap2inch": { "pricePerSqFt": 0.85, "unit": "$/sqft", "trend": "stable" },
    "ductWrap1inch": { "pricePerSqFt": 0.55, "unit": "$/sqft", "trend": "stable" }
  },
  "fittings": {
    "elbowMultiplier": 1.8,
    "teeMultiplier": 2.2,
    "reducerMultiplier": 1.4,
    "offsetMultiplier": 1.6
  },
  "labor": {
    "sheetMetalWorkerRate": 68.00,
    "foremanRate": 82.00,
    "unit": "$/hour"
  },
  "marketNotes": "Brief summary of current market conditions"
}`,
      },
    ],
  });

  return extractJSON(response.choices[0].message.content);
}

// ─── 3. SUPPLIER RFQ EMAIL ────────────────────────────────────────────────────
async function generateSupplierRFQ(units, projectInfo) {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    max_tokens: 3000,
    messages: [
      {
        role: 'system',
        content: 'You are an HVAC estimator writing professional supplier emails. Return ONLY valid JSON, no markdown.',
      },
      {
        role: 'user',
        content: `Write a professional RFQ email to an HVAC equipment supplier.

Project: ${JSON.stringify(projectInfo)}
Equipment needed: ${JSON.stringify(units)}

Return this JSON:
{
  "subject": "RFQ: [Project Name] - HVAC Equipment",
  "body": "Full professional email text with equipment table",
  "equipmentList": [{ "tag": "AHU-1", "description": "Full description", "quantity": 1 }]
}

The email should:
1. Introduce the project and company
2. List all equipment in a clear table (tag | type | capacity | qty)
3. Request: unit price, lead time, warranty, submittal data
4. Request any recommended alternates
5. Set response deadline to 1 week before bid date (${projectInfo.bidDate || 'TBD'})`,
      },
    ],
  });

  return extractJSON(response.choices[0].message.content);
}

// ─── 4. BID PROPOSAL ─────────────────────────────────────────────────────────
async function generateProposalContent(estimateData, projectInfo) {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: TEXT_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: 'You are an HVAC contractor writing professional bid proposals. Return ONLY valid JSON, no markdown.',
      },
      {
        role: 'user',
        content: `Generate a complete professional bid proposal.

Project: ${JSON.stringify(projectInfo)}
Estimate: ${JSON.stringify(estimateData)}

Return this JSON:
{
  "proposalNumber": "PROP-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}",
  "sections": {
    "executiveSummary": "2-3 sentence summary",
    "scopeOfWork": ["item1", "item2", "...at least 8 specific HVAC scope items"],
    "exclusions": ["item1", "item2", "...at least 6 standard exclusions"],
    "costBreakdown": {
      "material": ${estimateData.material || 0},
      "labor": ${estimateData.labor || 0},
      "subcontractors": ${estimateData.subcontractors || 0},
      "overhead": ${estimateData.overhead || 0},
      "profit": ${estimateData.profit || 0},
      "total": ${estimateData.total || 0}
    },
    "paymentSchedule": [
      { "milestone": "Contract Execution", "percentage": 30, "amount": ${Math.round((estimateData.total || 0) * 0.30)} },
      { "milestone": "Rough-in Complete", "percentage": 40, "amount": ${Math.round((estimateData.total || 0) * 0.40)} },
      { "milestone": "System Start-up", "percentage": 20, "amount": ${Math.round((estimateData.total || 0) * 0.20)} },
      { "milestone": "Final Completion", "percentage": 10, "amount": ${Math.round((estimateData.total || 0) * 0.10)} }
    ],
    "termsAndConditions": ["term1", "term2", "...at least 6 standard HVAC contractor terms"],
    "validityDays": 30
  }
}`,
      },
    ],
  });

  return extractJSON(response.choices[0].message.content);
}

module.exports = { analyzeDrawing, getCurrentPrices, generateSupplierRFQ, generateProposalContent };
