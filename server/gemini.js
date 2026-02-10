import { GoogleGenAI, Type } from '@google/genai';

/**
 * Server-side Gemini analysis via Vertex AI.
 * @param {string} id - Dataset/location id
 * @param {string} restaurantName - Location name
 * @param {string} csvData - CSV content
 * @param {'table'|'item'} [context='item'] - 'table' = batch comparison; 'item' = single location
 */
export async function analyzeReviews(id, restaurantName, csvData, context = 'item') {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const serviceAccountPath = process.env.VERTEX_AI_SERVICE_ACCOUNT_PATH;
  const modelName = process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash';

  if (!project || !location) {
    throw new Error('Vertex AI requires: GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION');
  }
  if (serviceAccountPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
  }

  const ai = new GoogleGenAI({ vertexai: true, project, location });

  const sentimentPointSchema = {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'Concisely summarized point in Vietnamese. Max 12 words.' },
      type: { type: Type.STRING, enum: ['positive', 'negative'] },
    },
    required: ['text', 'type'],
  };

  const categorySchema = {
    type: Type.OBJECT,
    properties: {
      points: { type: Type.ARRAY, items: sentimentPointSchema },
      summary: {
        type: Type.STRING,
        description: 'One sentence key takeaway in Vietnamese. Max 12–15 words. Required.',
      },
    },
    required: ['points', 'summary'],
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      service: categorySchema,
      food: categorySchema,
      value: categorySchema,
      atmosphere: categorySchema,
      overallRating: { type: Type.NUMBER, description: 'Average rating from 1.0 to 5.0' },
      keyTakeaway: {
        type: Type.STRING,
        description: 'Optional: one sentence overall strength or weakness for this location. Max 20 words. Leave empty if no dominant theme.',
      },
    },
    required: ['service', 'food', 'value', 'atmosphere', 'overallRating'],
  };

  const isTable = context === 'table';
  const contextInstruction = isTable
    ? `Comparison table mode: concise, max 3 points/category, summary in Vietnamese (12–15 words).`
    : `Single-location: max 3–4 points/category, optional keyTakeaway if dominant theme.`;

  const prompt = `Analyze CSV reviews for "${restaurantName}". Identify trends per category.
${contextInstruction}
Rules: Summary = main takeaway (Vietnamese, 12–15 words). Points = short bullets, max 12 words each. Consolidate similar comments. No duplicates.
Categories: 1) Service (staff, speed, parking). 2) Food/Products (taste, quality, dishes). 3) Value (price, promotions). 4) Atmosphere (cleanliness, decor, facilities).
Output JSON per schema.

CSV:
${csvData.substring(0, 22000)}`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      temperature: 0.1,
    },
  });

  const resultText = response.text;
  if (!resultText) throw new Error('No response from AI');

  const analysis = JSON.parse(resultText);
  return {
    id,
    location: restaurantName,
    ...analysis,
  };
}
