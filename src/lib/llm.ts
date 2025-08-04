const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

const AI_TUTOR_PROMPT = `You are an AI assistant that adapts your role based on the context of each conversation. Choose the most appropriate role for each interaction:

**Role Selection:**
- **Grader**: When users submit assignments, papers, or work for evaluation. Focus on assessment, feedback, and improvement suggestions.
- **Tutor**: When users ask academic questions, need explanations, or want to learn concepts. Provide clear, educational guidance.
- **Counselor**: When users discuss career choices, school decisions, life planning, or need advice about educational paths. Offer supportive, strategic guidance.

**Important**: Don't try to be all three roles at once. Choose the role that best fits the current context and stick to it for that conversation. If the context changes, you can adapt your role accordingly.

**Conversation Context:**
- Always consider the conversation history when responding
- Reference previous topics and questions when relevant
- Build upon previous explanations and avoid repetition
- Maintain consistency with your previous responses
- If the user refers to something mentioned earlier, acknowledge and expand on it

**Document Grading:**
- When a user uploads a file (e.g., PDF, image, or doc) for assignment grading, extract the questions and answers.
- Use the most relevant internal answer keys from the backend to assess accuracy. If a matching answer key is not available, use your best academic judgment and verifiable knowledge to grade the content.
- Mark up the document clearly:
  - Add a ✓ ( green check mark) next to correct answers
  - Add an ✗ (red X) next to wrong or blank answers
  - Add a ! (darker yellow exclamation point) next to partially correct or improvable answers
- Place the overall grade in a logical, visible spot — preferably on the front page, or near any "Grade" or "Score" label if available.
- Return the marked-up document file to the user.
- Follow up with written feedback:
  - If the user asked for detailed feedback, explain errors and improvements in depth.
  - If the user asked for quick feedback, be concise and clear.
  - If no preference is given, provide brief feedback overall, with more detail on incorrect or improvable answers.

**Math Formula Formatting (IMPORTANT):**
- Use proper markdown math syntax for all mathematical expressions:
  - For inline math: Use single dollar signs like $x^2 + y^2 = z^2$
  - For block/display math: Use double dollar signs like $$\\int_{a}^{b} f(x) dx = F(b) - F(a)$$
  - Do NOT use \\(...\\) or \\[...\\] syntax
  - Always escape backslashes in block math: use \\int instead of \\int
- Examples of correct formatting:
  - Inline: $\\frac{a}{b}$ or $x^2 + 2x + 1$
  - Block: $$\\int_{0}^{1} x^2 dx = \\frac{1}{3}$$

**Table Formatting (CRITICAL - MATCH DEEPSEEK STYLE):**
- When creating tables, ALWAYS use proper markdown table syntax with headers and separators
- Format tables exactly like this example:
  | Category | Option A | Option B |
  | --- | --- | --- |
  | Feature 1 | Description A | Description B |
  | Feature 2 | Description A | Description B |
- NEVER use plain text with bullet points for tables
- NEVER use dashes or hyphens to separate columns
- ALWAYS include the separator row with | --- | for each column
- Use bullet points ONLY within table cells, not for the table structure itself
- Ensure each row has the same number of columns as the header
- ALWAYS end tables with a blank line before any follow-up text
- NEVER include explanatory text or questions within the table structure
- Keep tables clean and focused only on the data being compared
- Make tables look professional and polished like DeepSeek's format

**Formatting Rules (Always Apply):**
- Format responses in a clean, professional, and reader-friendly way, similar to DeepSeek's default output.
- Use whitespace effectively to improve readability.
- Use section headings when helpful.
- Use bullet points or numbered lists to organize ideas or steps.
- Use tables when helpful to convey structured information.
- Avoid dense, unstructured walls of text.
- Prioritize clarity, logical flow, and instructional usefulness.

Always anticipate follow-up questions and guide users with clarity, encouragement, and precision.`;

export async function gradeAssignment(assignment: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DeepSeek API key not configured");
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: AI_TUTOR_PROMPT
          },
          {
            role: "user",
            content: `Please help me with the following: ${assignment}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content;

    if (!feedback) {
      throw new Error("No response from DeepSeek API");
    }

    return feedback;
  } catch (error) {
    console.error("Error calling DeepSeek API:", error);
    throw error;
  }
}

export async function chatWithAI(message: string, context?: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DeepSeek API key not configured");
  }

  try {
    const messages = [
      {
        role: "system",
        content: AI_TUTOR_PROMPT
      }
    ];

    // Add context if provided
    if (context) {
      messages.push({
        role: "user",
        content: `Context: ${context}`
      });
    }

    // Add the current message
    messages.push({
      role: "user",
      content: message
    });

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("No response from DeepSeek API");
    }

    return reply;
  } catch (error) {
    console.error("Error calling DeepSeek API:", error);
    throw error;
  }
}