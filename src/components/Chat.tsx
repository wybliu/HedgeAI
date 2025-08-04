"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import Image from "next/image";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

// Message type for chat history
interface Message {
  role: "user" | "ai";
  content: string;
  files?: { name: string; type: string; size: number }[];
}

interface ChatProps {
  sessionId?: string;
}

function normalizeNewlines(text: string) {
  if (!text) return "";
  // Replace 2 or more newlines with just 1
  return text.replace(/\n{2,}/g, '\n');
}

function organizeSections(text: string) {
  // Add extra blank lines before and after horizontal lines
  let organized = text.replace(/(---)/g, '\n\n$1\n\n');
  // Add a line before major section headers (e.g., 'What You Should Do Now', 'Summary', etc.)
  organized = organized.replace(/(What You Should Do Now|Summary|Key Takeaways|Next Steps)/g, '\n\n---\n\n$1\n\n');
  // Add a line before numbered list sections
  organized = organized.replace(/\n(\d+\. )/g, '\n\n$1');
  // Add a line before markdown headings (##, ###, etc.)
  organized = organized.replace(/\n(#+ )/g, '\n\n$1');
  // Add a line before bold headings (e.g., lines starting with '**' and ending with '**')
  organized = organized.replace(/\n(\*\*[^*]+?\*\*)/g, '\n\n$1');
  // Remove lines that are just '**'
  organized = organized.replace(/^\s*\*\*\s*$/gm, '');
  // Remove excessive lines (no more than 3 in a row)
  organized = organized.replace(/\n{4,}/g, '\n\n\n');
  return organized;
}

function HedgeTypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-[#666]">
              <div className="rounded-full border-2 border-[#FFFACD] bg-white p-1">
        <Image src="/logo.png" alt="Hedge Academy Logo" width={24} height={24} />
      </div>
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-[#C1272D] rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-[#C1272D] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
        <div className="w-2 h-2 bg-[#C1272D] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
      </div>
    </div>
  );
}

// Utility: Clean up malformed markdown tables
function cleanMarkdownContent(markdown: string): string {
  let cleaned = markdown;

  // Fix malformed bold syntax - remove stray asterisks that aren't part of proper markdown
  cleaned = cleaned.replace(/\*\*["',;:!?]\*\*/g, '$1');
  cleaned = cleaned.replace(/^\s*\*\*["',;:!?]\*\*\s*/gm, '$1 ');
  
  // Remove lines that are just single hyphens
  cleaned = cleaned.replace(/^\s*-\s*$/gm, '');
  
  // Remove table rows that are just pipes
  cleaned = cleaned.replace(/^\s*\|\s*\|*\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*\|(?:\s*\|)+\s*$/gm, '');
  
  // Fix double pipes at the end of rows
  cleaned = cleaned.replace(/\|\|\s*$/gm, '|');
  
  // ULTRA-AGGRESSIVE TABLE CLEANING - Remove ALL separator artifacts
  cleaned = cleaned.replace(/^\s*\|-+\|+\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*\|[-\s]*\|\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*[-|]+\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*---\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*-+\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*\|[-\s]*\|+\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*[-|]{2,}\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*\|[-\s]*\|+\s*$/gm, '');
  
  // Remove ANY line that contains only dashes, pipes, or combinations
  cleaned = cleaned.replace(/^\s*[-|]+\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*\|[-\s]*\|+\s*$/gm, '');
  cleaned = cleaned.replace(/^\s*[-|]{1,}\s*$/gm, '');
  
  // Remove separator lines between data rows (not just after headers)
  cleaned = cleaned.replace(/\n\s*\|[-\s]*\|+\s*\n/g, '\n\n');
  
  // Fix missing separators in tables (only add if clearly missing)
  cleaned = cleaned.replace(
    /(\|[^\n]*\|\n)(?!\s*\|[-\s]*\|)/g,
    (match, headerRow) => {
      const colCount = (headerRow.match(/\|/g) || []).length - 1;
      const separator = '|' + ' --- |'.repeat(colCount);
      return headerRow + separator + '\n';
    }
  );
  
  // Remove any content that's not part of the table structure
  // Look for lines that start with words (not pipes) after a table
  cleaned = cleaned.replace(
    /(\|[^\n]*\|\n(?:\|[^\n]*\|\n)*)\n([A-Z][^\n]*\n)/g,
    '$1\n\n$2'
  );
  
  // Convert plain text tables to proper markdown tables
  // Look for patterns like "1. University Name:" followed by pros/cons
  cleaned = cleaned.replace(
    /(\d+\.\s+[^:]+:)\s*\n\s*Pros:\s*\n((?:[^\n]*\n)*?)\s*Cons:\s*\n((?:[^\n]*\n)*?)(?=\d+\.|$)/g,
    (match, title, pros, cons) => {
      const prosList = pros.split('\n').filter((line: string) => line.trim().startsWith('-')).map((line: string) => line.trim().substring(1).trim()).join(', ');
      const consList = cons.split('\n').filter((line: string) => line.trim().startsWith('-')).map((line: string) => line.trim().substring(1).trim()).join(', ');
      return `| ${title.replace(':', '')} | ${prosList} | ${consList} |\n`;
    }
  );

  return cleaned;
}

export default function Chat({ sessionId }: ChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: "Hi there! I'm Hedge's AI Tutor. How can I help you today? You can ask me about school, grading, or any academic-related questions!\n\n**Math Test:** Here's a simple formula: $x^2 + y^2 = z^2$ and a more complex one: $$\\int_{a}^{b} f(x) dx = F(b) - F(a)$$\n\n**Table Test:**\n| Feature | Test 1 | Test 2 |\n| --- | --- | --- |\n| Math | $x^2$ | $y^2$ |\n| Text | Hello | World |"
    }
  ]);
  const [pendingAI, setPendingAI] = useState<string | null>(null);
  const [showCornerTyping, setShowCornerTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const typingInterval = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load messages for a specific session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: chatMessages, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      if (chatMessages && chatMessages.length > 0) {
        const formattedMessages: Message[] = [];
        
        chatMessages.forEach(msg => {
          if (msg.role === 'user') {
            // Check if this message contains a combined user/AI response
            if (msg.content.includes('\n\n---\n\nAI Response:\n')) {
              const [userContent, aiContent] = msg.content.split('\n\n---\n\nAI Response:\n');
              
              // Add user message
              formattedMessages.push({
                role: 'user',
                content: userContent,
                files: msg.files ? JSON.parse(msg.files) : undefined
              });
              
              // Add AI response
              formattedMessages.push({
                role: 'ai',
                content: aiContent,
                files: undefined
              });
            } else {
              // Regular user message
              formattedMessages.push({
                role: msg.role as "user" | "ai",
                content: msg.content,
                files: msg.files ? JSON.parse(msg.files) : undefined
              });
            }
          } else if (msg.role === 'ai') {
            // Only add AI messages that aren't already part of a combined message
            formattedMessages.push({
              role: msg.role as "user" | "ai",
              content: msg.content,
              files: msg.files ? JSON.parse(msg.files) : undefined
            });
          }
        });
        
        setMessages(formattedMessages);
      } else {
        // No messages found, show default greeting
        setMessages([
          {
            role: "ai",
            content: "Hi there! I'm Hedge's AI Tutor. How can I help you today? You can ask me about school, grading, or any academic-related questions!"
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading session messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingAI]);

  useEffect(() => {
    const chatMessageHandler = (e: CustomEvent) => {
              if (e.detail.role === "user") {
          setMessages(prev => {
            // Use the latest pendingAI value
            const lastPending = pendingAI;
            if (lastPending && lastPending.length > 0) {
              return [...prev, { role: "ai", content: lastPending }, e.detail];
            } else {
              return [...prev, e.detail];
            }
          });
        setPendingAI(null);
        setShowCornerTyping(true);
        window.dispatchEvent(new CustomEvent("hedge-typing-state", { detail: true }));
      } else if (e.detail.role === "ai") {
        // Live typing effect for AI
        if (typingInterval.current) clearInterval(typingInterval.current);
        let text = normalizeNewlines(e.detail.content);
        text = organizeSections(text);
        
        // Split text into lines for better table handling
        const lines = text.split('\n');
        let currentLineIndex = 0;
        let currentLineCharIndex = 0;
        let displayedText = "";
        let inTable = false;
        let tableStartIndex = -1;
        
        setPendingAI("");
        setShowCornerTyping(false);
        window.dispatchEvent(new CustomEvent("hedge-typing-state", { detail: true }));
        
        typingInterval.current = setInterval(() => {
          // If we've completed all lines, finish
          if (currentLineIndex >= lines.length) {
            if (typingInterval.current) clearInterval(typingInterval.current);
            setMessages((prev) => [...prev, { role: "ai", content: text }]);
            setPendingAI(null);
            window.dispatchEvent(new CustomEvent("hedge-typing-state", { detail: false }));
            return;
          }
          
          const currentLine = lines[currentLineIndex];
          
          // Check if we're entering a table
          if (!inTable && currentLine.includes('|') && currentLine.trim().startsWith('|')) {
            inTable = true;
            tableStartIndex = currentLineIndex;
          }
          
          // Check if we're exiting a table (empty line or non-table content)
          if (inTable && (currentLine.trim() === '' || (!currentLine.includes('|') && !currentLine.trim().startsWith('|')))) {
            inTable = false;
            tableStartIndex = -1;
          }
          
          // For table content, type the entire table at once to preserve structure
          if (inTable) {
            // Find the end of the table
            let tableEndIndex = currentLineIndex;
            for (let i = currentLineIndex; i < lines.length; i++) {
              if (lines[i].trim() === '' || (!lines[i].includes('|') && !lines[i].trim().startsWith('|'))) {
                tableEndIndex = i;
                break;
              }
              tableEndIndex = i;
            }
            
            // Type the entire table from start to end
            for (let i = tableStartIndex; i <= tableEndIndex; i++) {
              displayedText += lines[i] + '\n';
            }
            currentLineIndex = tableEndIndex + 1;
            inTable = false;
            tableStartIndex = -1;
          } else {
            // For non-table content, check other markdown structures
            const shouldTypeLineComplete = 
              currentLine.trim().startsWith('```') || // Code block markers
              currentLine.trim().startsWith('---') || // Horizontal rules
              currentLine.trim().startsWith('***') || // Horizontal rules
              currentLine.trim().startsWith('===') || // Horizontal rules
              (currentLine.trim().startsWith('#') && currentLine.trim().length <= 3) || // Short headers
              currentLine.trim().startsWith('>'); // Blockquotes
            
            if (shouldTypeLineComplete) {
              displayedText += currentLine + '\n';
              currentLineIndex++;
            } else {
              // For regular lines, type character by character
              if (currentLineCharIndex < currentLine.length) {
                displayedText += currentLine[currentLineCharIndex];
                currentLineCharIndex++;
              } else {
                // Move to next line
                displayedText += '\n';
                currentLineIndex++;
                currentLineCharIndex = 0;
              }
            }
          }
          
          setPendingAI(displayedText);
          window.dispatchEvent(new CustomEvent("hedge-typing-state", { detail: true }));
        }, 15); // Typing speed (ms per character)
      }
    };
    const cornerTypingHandler = (e: CustomEvent) => {
      setShowCornerTyping(!!e.detail);
    };
    const clearChatHandler = () => {
      setMessages([
        {
          role: "ai",
          content: "Hi there! I'm Hedge's AI Tutor. How can I help you today? You can ask me about school, grading, or any academic-related questions!"
        }
      ]);
      setPendingAI(null);
      setShowCornerTyping(false);
    };
    const loadSessionHandler = (e: CustomEvent) => {
      // Load messages for specific session
      console.log('Loading session:', e.detail);
      if (e.detail) {
        loadSessionMessages(e.detail);
      }
    };

    const stopTypingHandler = () => {
      // Stop the typing animation but preserve the partial AI response
      if (typingInterval.current) {
        clearInterval(typingInterval.current);
        typingInterval.current = null;
      }
      
      // If there's a partial response, save it as a complete message
      if (pendingAI && pendingAI.trim()) {
        const newMessage: Message = {
          role: "ai",
          content: pendingAI.trim()
        };
        setMessages(prev => [...prev, newMessage]);
        
        // Dispatch event to save the partial response to database
        window.dispatchEvent(new CustomEvent("save-partial-ai", { 
          detail: { content: pendingAI.trim() } 
        }));
      }
      
      // Clear the pending state
      setPendingAI(null);
      setShowCornerTyping(false);
      window.dispatchEvent(new CustomEvent("hedge-typing-state", { detail: false }));
    };

    window.addEventListener("chat-message", chatMessageHandler as EventListener);
    window.addEventListener("hedge-corner-typing", cornerTypingHandler as EventListener);
    window.addEventListener("clear-chat", clearChatHandler);
    window.addEventListener("load-session", loadSessionHandler as EventListener);
    window.addEventListener("hedge-stop-typing", stopTypingHandler);

    return () => {
      window.removeEventListener("chat-message", chatMessageHandler as EventListener);
      window.removeEventListener("hedge-corner-typing", cornerTypingHandler as EventListener);
      window.removeEventListener("clear-chat", clearChatHandler);
      window.removeEventListener("load-session", loadSessionHandler as EventListener);
      window.removeEventListener("hedge-stop-typing", stopTypingHandler);
    };
  }, [pendingAI]);

  // Reset messages when sessionId changes
  useEffect(() => {
    if (sessionId) {
      // Load messages for this session
      console.log('Session changed to:', sessionId);
      loadSessionMessages(sessionId);
    } else {
      // New chat - reset to initial state
      setMessages([
        {
          role: "ai",
          content: "Hi there! I'm Hedge's AI Tutor. How can I help you today? You can ask me about school, grading, or any academic-related questions!"
        }
      ]);
    }
  }, [sessionId, user, loadSessionMessages]);

  // Debug markdown rendering
  useEffect(() => {
    messages.forEach((msg, index) => {
      if (msg.role === 'ai') {
        console.log(`AI Message ${index}:`, msg.content.substring(0, 100) + '...');
      }
    });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 w-full min-h-[220px] max-h-[60vh] overflow-y-auto px-2 sm:px-0 justify-start relative">
      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#C1272D]"></div>
            <span>Loading chat history...</span>
          </div>
        </div>
      )}
      
      {!loading && messages.length > 0 && (
        <>
          {/* Default AI greeting with box, left-aligned */}
          <div className="flex justify-start w-full">
            <div className="chat-bubble ai text-left">
              <div className="markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: false }]]}
                >
                  {cleanMarkdownContent(messages[0].content)}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Other messages, top-aligned */}
      {!loading && messages.slice(1).map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "user" ? (
            <div className="chat-bubble user max-w-full">
              {/* File chips for user uploads */}
              {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {msg.files.map((file, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-[#FFFACD] border border-[#FFFACD] rounded text-xs text-[#C1272D] font-medium">
                      <svg width="16" height="16" fill="none" stroke="#C1272D" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight:2}}><path d="M16.5 13.5V17a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 7.5 17v-3.5M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5"/></svg>
                      {file.name}
                    </span>
                  ))}
                </div>
              )}
              {/* PDF preview (first 8 lines) if content is long */}
              {msg.files && msg.files.some(f => f.name.endsWith('.txt')) && msg.content && (
                <div className="bg-[#f7f7f8] border border-[#FFFACD] rounded p-2 mb-2 text-xs text-[#333] max-h-40 overflow-y-auto whitespace-pre-line">
                  {msg.content.split('\n').slice(0,8).join('\n')}
                  {msg.content.split('\n').length > 8 && <span className="text-gray-400">... (truncated)</span>}
                </div>
              )}
              {/* User's message content (if not just a file) */}
              {msg.content && (
                <span>{msg.content}</span>
              )}
            </div>
          ) : (
            <div className="text-base text-[#222] max-w-full">
              <div className="markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: false }]]}
                >
                  {cleanMarkdownContent(msg.content)}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      ))}
      {/* Pending AI message (typing) */}
      {pendingAI !== null && (
        <div className="flex justify-start">
          {pendingAI === "" ? (
            <HedgeTypingIndicator />
          ) : (
            <div className="text-base text-[#222] max-w-full">
              <div className="markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: false }]]}
                >
                  {cleanMarkdownContent(pendingAI)}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Corner typing indicator */}
      {showCornerTyping && (
        <div className="flex justify-start w-full">
          <HedgeTypingIndicator />
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
} 