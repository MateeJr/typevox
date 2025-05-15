import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  SafetySetting,
  Content,
  GenerationConfig,
  ModelParams,
} from "@google/generative-ai";

// Promise to fetch the system prompt from the API route
const systemPromptPromise: Promise<string | null> = (async () => {
  try {
    // In a Next.js app, relative paths for fetch from client/server components to API routes are fine.
    const response = await fetch('/api/system-prompt'); 
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to fetch system prompt: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.systemPrompt) {
      console.log("System prompt loaded successfully via API.");
      return data.systemPrompt;
    }
    throw new Error("System prompt not found in API response.");
  } catch (error: any) {
    console.warn("Failed to load system prompt from API. It will not be used.", error.message);
    return null; // Return null on error, so it can be handled gracefully
  }
})();

// Ensure you have your API key stored securely, e.g., in an environment variable
const GEMINI_API_KEY = "AIzaSyC6E4Dx1hY_0y2C-XBJ7VBuOauNmwAtrc0"; // Hardcoded for testing

// Simplified check - we know the key is set now
if (!GEMINI_API_KEY) {
  console.warn("API key is not configured properly");
}

// Log to verify what key is being used
console.log("Using API key (first 5 chars):", GEMINI_API_KEY.substring(0, 5) + "...");

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Define the safety settings to turn all categories OFF
// The user specifically requested "OFF", and Vertex AI documentation confirms "OFF" as a valid threshold.
const safetySettingsFinal: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.HARM_BLOCK_THRESHOLD_UNSPECIFIED,
  },
];

export async function* getGeminiResponse(
  chatHistory: Content[], // Use the SDK's Content type
  latestPrompt: string,
  abortSignal?: AbortSignal,
  thinkingBudget?: number // Added thinkingBudget parameter
): AsyncIterable<string> {
  try {
    if (abortSignal?.aborted) {
      console.log("Gemini request cancelled before starting.");
      throw new Error("CANCELLED"); 
    }

    // Explicitly type modelParams to include systemInstruction
    const modelParams: ModelParams & { systemInstruction?: { role?: string; parts: { text: string }[] } | string } = {
      model: "gemini-2.5-flash-preview-04-17", // Corrected model name
      safetySettings: safetySettingsFinal,
    };

    // Await the system prompt before proceeding
    const currentSystemInstruction = await systemPromptPromise;

    // Add systemInstruction if content was loaded and model is the specified flash model
    if (currentSystemInstruction && modelParams.model === "gemini-2.5-flash-preview-04-17") {
        modelParams.systemInstruction = {
            role: "system", 
            parts: [{ text: currentSystemInstruction }]
        };
    }

    if (thinkingBudget !== undefined) {
      // Assuming 'thinkingConfig' is a valid, if untyped or recently added, property of GenerationConfig
      // based on API documentation. We cast to GenerationConfig to satisfy the linter.
      modelParams.generationConfig = {
        temperature: 1.0,
        topP: 0.95,
        topK: 0,
        thinkingConfig: {
          thinkingBudget: thinkingBudget,
        },
      } as GenerationConfig; 
    } else {
      modelParams.generationConfig = {
        temperature: 1.0,
        topP: 0.95,
        topK: 0,
      } as GenerationConfig;
    }

    const model = genAI.getGenerativeModel(modelParams);

    const chat = model.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessageStream(latestPrompt);

    for await (const chunk of result.stream) {
      if (abortSignal?.aborted) {
        console.log("Gemini request cancelled during streaming.");
        throw new Error("CANCELLED");
      }
      const chunkText = chunk.text();
      // Check if chunk or chunkText is null/undefined before accessing text() or yielding
      if (chunkText !== null && chunkText !== undefined) {
        yield chunkText;
      } else {
        // Optionally log or handle empty/null chunks if necessary
        // console.warn("Received an empty or null chunk from Gemini stream.");
      }
    }
  } catch (error) {
    const err = error as Error;
    // Check if it's our standardized "CANCELLED" or a common AbortError name/message from the SDK
    if (err.message === "CANCELLED" || err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('cancelled')) {
      console.log("Gemini request was cancelled (caught).");
      throw new Error("CANCELLED"); // Re-throw standardized "CANCELLED"
    }
    
    console.error("Error getting response from Gemini:", err);
    const anyError = err as any;
    if (anyError.response && anyError.response.promptFeedback) {
      console.error("Prompt Feedback:", anyError.response.promptFeedback);
    }
    if (anyError.response?.candidates?.[0]?.finishReason === 'SAFETY') {
        console.error("Response blocked due to safety settings. Safety Ratings:", anyError.response.candidates[0].safetyRatings);
    }
    throw new Error("Failed to get response from Gemini."); // Generic failure for other errors
  }
}

// Example usage (updated to show history):
async function main() {
  try {
    const initialHistory: Content[] = [
      { role: "user", parts: [{ text: "Hi there!" }] },
      { role: "model", parts: [{ text: "Hello! How can I help you today?" }] },
    ];
    const userPrompt = "Tell me a short, fun fact about the year 2025.";
    
    console.log("Initial History:", JSON.stringify(initialHistory, null, 2));
    console.log(`Sending prompt to Gemini: "${userPrompt}"`);
    
    // The full history (including the current prompt if you structure it that way)
    // or history up to the current prompt, and then the current prompt separately.
    // The current `getGeminiResponse` expects history *before* the latest prompt.
    const responseStream = getGeminiResponse(initialHistory, userPrompt);
    
    console.log("\nGemini's Response (streaming):");
    for await (const chunk of responseStream) {
      process.stdout.write(chunk);
    }
    console.log();
  } catch (e) {
    const err = e as Error;
    console.error("Main function error:", err.message);
  }
}

// Call the main function if this script is run directly
if (typeof require !== 'undefined' && require.main === module) {
   main();
} 