import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult, Currency, ExpenseCategory } from "../types";

// Helper to get API Key safely at runtime
const getApiKey = () => import.meta.env?.VITE_API_KEY || '';

/**
 * Helper function to retry operations on 503 (Overloaded) errors
 */
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isOverloaded = error.status === 503 || 
                         error.message?.includes('503') || 
                         error.message?.includes('overloaded') || 
                         error.message?.includes('UNAVAILABLE');

    if (isOverloaded && retries > 0) {
      console.warn(`Model overloaded (503). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2); // Exponential backoff
    }
    throw error;
  }
}

/**
 * Static map for common countries to ensure instant response and offline capability.
 * This prevents "USD" default when API fails or key is missing.
 */
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    // Europe (Euro)
    "france": "EUR", "frança": "EUR",
    "germany": "EUR", "alemanha": "EUR",
    "italy": "EUR", "itália": "EUR", "italia": "EUR",
    "spain": "EUR", "espanha": "EUR",
    "portugal": "EUR",
    "netherlands": "EUR", "holanda": "EUR",
    "belgium": "EUR", "bélgica": "EUR",
    "ireland": "EUR", "irlanda": "EUR",
    "austria": "EUR", "áustria": "EUR",
    "greece": "EUR", "grécia": "EUR",
    "finland": "EUR", "finlândia": "EUR",
    // Americas
    "united states": "USD", "usa": "USD", "us": "USD", "eua": "USD", "estados unidos": "USD",
    "canada": "CAD", "canadá": "CAD",
    "brazil": "BRL", "brasil": "BRL",
    "mexico": "MXN", "méxico": "MXN",
    "argentina": "ARS",
    "colombia": "COP", "colômbia": "COP",
    "chile": "CLP",
    "peru": "PEN",
    "uruguay": "UYU", "uruguai": "UYU",
    // Asia/Pacific
    "japan": "JPY", "japão": "JPY", "japao": "JPY",
    "china": "CNY",
    "india": "INR", "índia": "INR",
    "australia": "AUD", "austrália": "AUD",
    "new zealand": "NZD", "nova zelândia": "NZD",
    "south korea": "KRW", "coreia do sul": "KRW",
    "thailand": "THB", "tailândia": "THB",
    "singapore": "SGD", "cingapura": "SGD",
    // Europe (Non-Euro)
    "united kingdom": "GBP", "uk": "GBP", "reino unido": "GBP", "england": "GBP", "inglaterra": "GBP",
    "switzerland": "CHF", "suíça": "CHF",
    "sweden": "SEK", "suécia": "SEK",
    "norway": "NOK", "noruega": "NOK",
    "denmark": "DKK", "dinamarca": "DKK"
};

/**
 * Uses Gemini 2.5 Flash to extract structured data from a receipt image.
 */
export const analyzeReceipt = async (base64Image: string): Promise<OCRResult> => {
  return retryOperation(async () => {
      try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error("API Key missing. Please check VITE_API_KEY in your .env file or settings.");

        const ai = new GoogleGenAI({ apiKey });

        // Clean base64 string if it includes the data prefix
        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64
                }
              },
              {
                text: `Analyze this receipt image. Extract the following fields into a JSON object:
                - date (YYYY-MM-DD format, if not found use today's date)
                - merchant (Name of the establishment)
                - amount (Total amount as a number)
                - currency (ISO code like USD, EUR, JPY. Infer from symbol if necessary. Default to USD if unknown)
                - category (Best guess from: Meal, Transport, Lodging, Flight, Supplies, Entertainment, Other)
                `
              }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                merchant: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                category: { type: Type.STRING }
              }
            }
          }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        
        // Sanitize markdown blocks if present (e.g. ```json ... ```)
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let data;
        try {
            data = JSON.parse(cleanText);
        } catch (e) {
            console.error("JSON Parse Error on AI response:", text);
            throw new Error("AI response was not valid JSON. Please enter manually.");
        }
        
        // Map string category to Enum if possible, else Other
        let category = ExpenseCategory.OTHER;
        const catUpper = data.category?.toUpperCase();
        if (Object.values(ExpenseCategory).map(c => c.toUpperCase()).includes(catUpper)) {
            // Find the matching enum value
            const entry = Object.entries(ExpenseCategory).find(([key, val]) => val.toUpperCase() === catUpper);
            if (entry) category = entry[1];
        }

        return {
          date: data.date,
          merchant: data.merchant,
          amount: data.amount,
          currency: data.currency,
          category: category
        };

      } catch (error: any) {
        console.error("OCR Error details:", error);
        
        // Handle Quota Exceeded (429) specifically
        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
            throw new Error("Daily AI Quota Exceeded. Please enter expense details manually.");
        }

        // Rethrow 503 to be caught by retryOperation
        if (error.status === 503 || error.message?.includes('503') || error.message?.includes('overloaded')) {
            throw error; 
        }

        if (error.message) {
             // If it's a custom error from above, rethrow it
             if (error.message.includes("Quota") || error.message.includes("valid JSON") || error.message.includes("API Key")) {
                 throw error;
             }
             throw new Error(`AI Analysis failed: ${error.message}`);
        }

        throw new Error("Failed to analyze receipt. Please try again or enter manually.");
      }
  });
};

/**
 * Uses Gemini 2.5 Flash to estimate/fetch historical exchange rate.
 */
export const getEstimatedExchangeRate = async (fromCurrency: string, toCurrency: string, date: string): Promise<number> => {
  if (fromCurrency === toCurrency) return 1;
  
  const apiKey = getApiKey();

  // Simple static fallback for common pairs if API fails or Key is missing
  if (!apiKey) {
      const pair = `${fromCurrency}-${toCurrency}`;
      if (pair === 'USD-BRL') return 5.0;
      if (pair === 'BRL-USD') return 0.2;
      if (pair === 'EUR-BRL') return 5.5;
      if (pair === 'BRL-EUR') return 0.18;
      if (pair === 'USD-EUR') return 0.92;
      if (pair === 'EUR-USD') return 1.09;
      return 1.0;
  }

  return retryOperation(async () => {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `What was the exchange rate from ${fromCurrency} to ${toCurrency} on ${date}? 
          If exact date data is missing, give the closest estimate. 
          Return ONLY the numeric rate. Example: 1.23`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    rate: { type: Type.NUMBER }
                }
            }
          }
        });

        const data = JSON.parse(response.text || "{}");
        return data.rate || 1.0;
      } catch (error: any) {
        console.error("Exchange Rate Error:", error);
        // If 503, throw to retry
        if (error.status === 503 || error.message?.includes('503')) throw error;
        return 1.0; 
      }
  });
};

/**
 * Determine appropriate local currency based on country name
 */
export const suggestCurrencyForCountry = async (country: string): Promise<string> => {
    // 1. Check static map first (fastest & offline support)
    const normalizedCountry = country.toLowerCase().trim();
    if (COUNTRY_CURRENCY_MAP[normalizedCountry]) {
        return COUNTRY_CURRENCY_MAP[normalizedCountry];
    }

    // 2. If not in map, try Gemini API
    return retryOperation(async () => {
        try {
            const apiKey = getApiKey();
            if (!apiKey) throw new Error("No API Key");

            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `What is the 3-letter ISO currency code for ${country}? Return JSON { "currency": "CODE" }`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            currency: { type: Type.STRING }
                        }
                    }
                }
            });
            const data = JSON.parse(response.text || "{}");
            return data.currency || "USD";
        } catch (e: any) {
            // If 503, throw to retry
            if (e.status === 503 || e.message?.includes('503')) throw e;
            
            console.warn("Currency detection failed, defaulting to USD", e);
            return "USD";
        }
    });
}
