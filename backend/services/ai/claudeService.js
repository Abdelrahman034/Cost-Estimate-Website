const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Analyze a drawing image/PDF and extract duct measurements + unit schedules
 * @param {string} base64Image - Base64 encoded image
 * @param {string} mediaType - image/jpeg, image/png, image/webp, etc.
 * @returns {Object} Extracted duct data and unit schedules
 */
async function analyzeDrawing(base64Image, mediaType = 'image/jpeg') {
  const prompt = `You are an expert HVAC engineer analyzing mechanical drawings.

Carefully examine this drawing and extract ALL of the following information:

## 1. DUCT MEASUREMENTS
For every duct segment visible, extract:
- Duct size (e.g., "24x12", "18x10", "12" round)
- Estimated length in linear feet (if scale is shown, use it; otherwise estimate)
- Duct type (supply, return, exhaust, outside air)
- Shape (rectangular or round)
- Location/label if visible

## 2. UNIT SCHEDULE
For every mechanical unit visible (AHU, RTU, FCU, VAV, etc.), extract:
- Unit tag/number (e.g., AHU-1, RTU-3)
- Unit type (Air Handling Unit, Rooftop Unit, Fan Coil Unit, VAV Box, etc.)
- Capacity (CFM, tons, kW if shown)
- Model number if visible
- Any other specifications shown

## 3. DIFFUSERS & GRILLES
- Type (supply diffuser, return grille, exhaust grille)
- Size
- Quantity per zone if noted

Return your response as a JSON object with this exact structure:
{
  "ducts": [
    {
      "id": "D1",
      "size": "24x12",
      "shape": "rectangular",
      "type": "supply",
      "linearFeet": 45,
      "location": "Zone A",
      "notes": ""
    }
  ],
  "units": [
    {
      "tag": "AHU-1",
      "type": "Air Handling Unit",
      "cfm": 5000,
      "tons": 10,
      "model": "",
      "notes": ""
    }
  ],
  "diffusers": [
    {
      "type": "supply",
      "size": "24x24",
      "quantity": 8,
      "zone": "Floor 1"
    }
  ],
  "summary": {
    "totalDuctLinearFeet": 0,
    "totalDuctSqFt": 0,
    "drawingScale": "1/8 inch = 1 foot",
    "notes": "Any general observations about the drawing"
  }
}

Be thorough. If a value is not visible or cannot be determined, use null.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const text = response.content[0].text;

  // Extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      return { raw: text, error: 'Could not parse JSON response' };
    }
  }

  return { raw: text };
}

/**
 * Get current sheet metal / HVAC material prices via web search simulation
 * Returns AI-estimated current market prices with confidence levels
 */
async function getCurrentPrices() {
  const prompt = `You are an HVAC materials pricing expert. Based on your knowledge of current market conditions (as of early 2025), provide realistic current pricing for HVAC sheet metal fabrication and materials.

Return a JSON object with the following structure:
{
  "lastUpdated": "ISO date string",
  "confidence": "high|medium|low",
  "sheetMetal": {
    "galvanizedSteel": {
      "gauge26": { "pricePerSqFt": 0.0, "unit": "$/sqft", "trend": "up|down|stable" },
      "gauge24": { "pricePerSqFt": 0.0, "unit": "$/sqft", "trend": "up|down|stable" },
      "gauge22": { "pricePerSqFt": 0.0, "unit": "$/sqft", "trend": "up|down|stable" },
      "gauge20": { "pricePerSqFt": 0.0, "unit": "$/sqft", "trend": "up|down|stable" },
      "gauge18": { "pricePerSqFt": 0.0, "unit": "$/sqft", "trend": "up|down|stable" }
    },
    "stainlessSteel": {
      "gauge24": { "pricePerSqFt": 0.0, "unit": "$/sqft", "trend": "up|down|stable" }
    }
  },
  "insulation": {
    "ductWrap2inch": { "pricePerSqFt": 0.0, "unit": "$/sqft", "trend": "up|down|stable" },
    "ductWrap1inch": { "pricePerSqFt": 0.0, "unit": "$/sqft", "trend": "up|down|stable" },
    "boardInsulation": { "pricePerSqFt": 0.0, "unit": "$/sqft", "trend": "up|down|stable" }
  },
  "fittings": {
    "elbowMultiplier": 0.0,
    "teeMultiplier": 0.0,
    "reducerMultiplier": 0.0,
    "offsetMultiplier": 0.0
  },
  "labor": {
    "sheetMetalWorkerRate": 0.0,
    "foremanRate": 0.0,
    "unit": "$/hour"
  },
  "marketNotes": "Brief summary of current market conditions affecting HVAC material prices"
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      return { raw: text, error: 'Could not parse JSON' };
    }
  }
  return { raw: text };
}

/**
 * Generate a professional supplier RFQ (Request for Quote) email
 * @param {Array} units - List of HVAC units from drawing extraction
 * @param {Object} projectInfo - Project name, location, due date, etc.
 * @returns {Object} Email subject and body
 */
async function generateSupplierRFQ(units, projectInfo) {
  const prompt = `You are an HVAC estimator writing a professional Request for Quote (RFQ) email to an equipment supplier.

Project Information:
${JSON.stringify(projectInfo, null, 2)}

Equipment Needed:
${JSON.stringify(units, null, 2)}

Write a professional, clear RFQ email that:
1. Introduces the project and company
2. Lists all equipment needed with specifications in a clear table format
3. Specifies the quote due date (use the project bid date minus 1 week)
4. Requests: unit price, lead time, warranty, and submittal data
5. Asks for any alternates they recommend
6. Provides a professional closing

Return as JSON:
{
  "subject": "RFQ: [Project Name] - HVAC Equipment",
  "body": "Full email body with proper formatting",
  "equipmentList": [
    {
      "tag": "AHU-1",
      "description": "Full description for quote request",
      "quantity": 1
    }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      return { raw: text };
    }
  }
  return { raw: text };
}

/**
 * Generate bid proposal content from estimate data
 * @param {Object} estimateData - Full estimate with all costs
 * @param {Object} projectInfo - Project details
 * @returns {Object} Structured proposal content
 */
async function generateProposalContent(estimateData, projectInfo) {
  const prompt = `You are an expert HVAC contractor writing a professional bid proposal.

Project Information:
${JSON.stringify(projectInfo, null, 2)}

Estimate Data:
${JSON.stringify(estimateData, null, 2)}

Generate a complete, professional bid proposal that includes:
1. Executive summary
2. Scope of work (detailed list of what's included)
3. Exclusions (what is NOT included)
4. Equipment and material summary
5. Labor summary
6. Payment schedule (standard 30/60/10 retainage)
7. Project timeline
8. Terms and conditions (standard HVAC contractor terms)
9. Signature block

Return as JSON:
{
  "proposalNumber": "PROP-YYYY-XXXX",
  "sections": {
    "executiveSummary": "text",
    "scopeOfWork": ["item1", "item2", ...],
    "exclusions": ["item1", "item2", ...],
    "equipmentSummary": [{"description": "", "qty": 0, "unitPrice": 0, "total": 0}],
    "laborSummary": [{"description": "", "hours": 0, "rate": 0, "total": 0}],
    "costBreakdown": {
      "material": 0,
      "labor": 0,
      "subcontractors": 0,
      "overhead": 0,
      "profit": 0,
      "total": 0
    },
    "paymentSchedule": [{"milestone": "", "percentage": 0, "amount": 0}],
    "timeline": [{"phase": "", "duration": "", "startWeek": 0}],
    "termsAndConditions": ["term1", "term2", ...],
    "validityDays": 30
  }
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      return { raw: text };
    }
  }
  return { raw: text };
}

module.exports = {
  analyzeDrawing,
  getCurrentPrices,
  generateSupplierRFQ,
  generateProposalContent,
};
