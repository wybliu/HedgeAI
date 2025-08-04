import { NextRequest, NextResponse } from "next/server";
import { gradeAssignment } from "../../../lib/llm";

export async function POST(req: NextRequest) {
  const { assignment, files, chatHistory } = await req.json();
  
  if (!assignment) {
    return NextResponse.json({ error: "No assignment provided." }, { status: 400 });
  }

  try {
    // Prepare context for the AI
    let context = assignment;
    
    // If files were uploaded, add file information to context
    if (files && files.length > 0) {
      context += `\n\nUploaded files: ${files.map((f: { name: string }) => f.name).join(', ')}`;
      context += `\nPlease analyze the content from these files and provide appropriate feedback.`;
    }

    // Add chat history context if available
    if (chatHistory && chatHistory.length > 0) {
      context += `\n\nPrevious conversation context:\n`;
      // Include last 5 messages for context (to avoid token limits)
      const recentHistory = chatHistory.slice(-5);
      recentHistory.forEach((msg: { role: string; content: string }) => {
        context += `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}\n`;
      });
      context += `\nPlease consider this conversation history when responding.`;
    }

    // Call DeepSeek LLM with grading prompt
    const feedback = await gradeAssignment(context);
    return NextResponse.json({ feedback });
  } catch (e) {
    console.error("Grading error:", e);
    return NextResponse.json({ 
      error: "LLM error.", 
      details: e instanceof Error ? e.message : "Unknown error" 
    }, { status: 500 });
  }
} 