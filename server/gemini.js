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
        description: 'One sentence key takeaway in Vietnamese for this category. Max 15–20 words. Required.',
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

  const contextInstruction =
    context === 'table'
      ? `You are analyzing one of several locations for a comparison table. Keep output very concise and consistent so it can be compared side-by-side. Emphasize summary; use minimal points (max 3 per category).`
      : `You are doing a single-location analysis. Use one short keyTakeaway if there is a dominant theme; otherwise keep the same concise format. Max 3–4 points per category.`;

  const prompt = `
    Analyze the provided CSV review data for "${restaurantName}".
    Your task is to identify the most significant trends and insights for each category.

    ${contextInstruction}

    Guidelines:
    1. **Summary is the main takeaway**: For each category, output a required "summary" (one sentence in Vietnamese, max 15–20 words). The summary is the primary insight; points are short supporting bullets. Prefer a strong summary over adding more points.
    2. **Limit points**: Maximum 3–4 distinct insights per category; each point under 12 words. Prioritize the most repeated and impactful themes.
    3. **Consolidate**: Group similar comments into a single, concise insight. Do not list every individual review.
    4. **No Duplicates**: Ensure points are distinct.
    5. **keyTakeaway**: If the data suggests one dominant strength or weakness across categories, set keyTakeaway to that (max 20 words); otherwise omit or leave brief.

    Categories:
    1. Service (Dịch vụ): Staff attitude, speed, security, parking staff.
    2. Food/Products (Sản phẩm/Dịch vụ): Taste, variety, freshness, quality, specific dishes.
    3. Value (Giá trị): Price vs quality, promotions, hidden costs (parking).
    4. Atmosphere (Không gian/Tiện ích): Vibe, cleanliness, decor, noise, facilities (AC, Wifi, seats).

    Output Schema matches the JSON structure provided.

    CSV Data:
    ${csvData.substring(0, 30000)}
  `;

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
