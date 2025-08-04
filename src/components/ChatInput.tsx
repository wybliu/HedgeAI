"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface ChatInputProps {
  sessionId?: string;
}

export default function ChatInput({ sessionId }: ChatInputProps) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isStopPressed, setIsStopPressed] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(sessionId);

  // Update current session when prop changes
  useEffect(() => {
    setCurrentSessionId(sessionId);
  }, [sessionId]);

  // Load chat history when session changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!user || !currentSessionId) return;
      
      console.log('Loading chat history for session:', currentSessionId, 'user:', user.id);
      
      try {
        const { data: history, error } = await supabase
          .from('chat_history')
          .select('*')
          .eq('session_id', currentSessionId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading chat history:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          return;
        }

        if (history) {
          setChatHistory(history);
        }
      } catch (error) {
        console.error('Error loading chat history (catch block):', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          error: error
        });
      }
    };

    loadChatHistory();
  }, [currentSessionId, user]);

  useEffect(() => {
    const typingStateHandler = (e: any) => setTimeout(() => setIsAITyping(!!e.detail), 0);
    const savePartialAIHandler = (e: CustomEvent) => {
      if (e.detail && e.detail.content) {
        saveMessage('ai', e.detail.content);
      }
    };
    
    window.addEventListener("hedge-typing-state", typingStateHandler);
    window.addEventListener("save-partial-ai", savePartialAIHandler as EventListener);
    
    return () => {
      window.removeEventListener("hedge-typing-state", typingStateHandler);
      window.removeEventListener("save-partial-ai", savePartialAIHandler as EventListener);
    };
  }, []);

  // Create or get session ID
  const getOrCreateSession = async (): Promise<string> => {
    if (!user?.id) {
      console.error('No user ID available');
      return `session-${Date.now()}`;
    }

    // Check if user is authenticated
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      console.error('No active session found');
      return `session-${Date.now()}`;
    }

    if (currentSessionId) {
      return currentSessionId;
    }

    console.log('Creating session for user:', user.id);
    console.log('User ID type:', typeof user.id);
    console.log('Current session:', currentSession);

    // Create new session
    const { data: session, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user?.id,
        title: 'New Chat'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      // Fallback: use timestamp as session ID
      return `session-${Date.now()}`;
    }

    console.log('Session created successfully:', session);
    setCurrentSessionId(session.id);
    return session.id;
  };

  // Save message to database
  const saveMessage = async (role: 'user' | 'ai', content: string, files?: any[]) => {
    try {
      const sessionId = await getOrCreateSession();
      console.log(`Saving ${role} message to session:`, sessionId);
      
      // For now, save all messages separately to ensure they're saved
      const { data: newMessage, error } = await supabase
        .from('chat_history')
        .insert({
          user_id: user?.id,
          session_id: sessionId,
          role,
          content,
          files: files ? JSON.stringify(files) : null
        })
        .select()
        .single();

      if (error) {
        console.error(`Error saving ${role} message:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return;
      }

      console.log(`Successfully saved ${role} message:`, newMessage?.id);

      // Update local chat history
      if (newMessage) {
        setChatHistory(prev => [...prev, newMessage]);
      }

      // Update session title with first user message
      if (role === 'user' && content.length > 0) {
        const title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        const { error: updateError } = await supabase
          .from('chat_sessions')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
        
        if (updateError) {
          console.error('Error updating session title:', updateError);
        } else {
          console.log('Session title updated to:', title);
        }
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  // Drag and drop handlers
  useEffect(() => {
    const dropArea = dropRef.current;
    if (!dropArea) return;
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer?.files || []);
      if (droppedFiles.length > 0) {
        const processedFiles: File[] = [];
        for (const file of droppedFiles) {
          // Remove PDF extraction logic, just push file
          processedFiles.push(file);
        }
        setFiles(prev => {
          const combined = [...prev, ...processedFiles].slice(0, 10);
          return combined;
        });
      }
    };
    dropArea.addEventListener("dragover", handleDragOver);
    dropArea.addEventListener("dragleave", handleDragLeave);
    dropArea.addEventListener("drop", handleDrop);
    return () => {
      dropArea.removeEventListener("dragover", handleDragOver);
      dropArea.removeEventListener("dragleave", handleDragLeave);
      dropArea.removeEventListener("drop", handleDrop);
    };
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    const processedFiles: File[] = [];
    for (const file of selectedFiles) {
      // Remove PDF extraction logic, just push file
      processedFiles.push(file);
    }
    setFiles(prev => {
      const combined = [...prev, ...processedFiles].slice(0, 10);
      return combined;
    });
    setInput("");
    // Reset input value so same file can be reselected
    e.target.value = "";
  }

  function handleRemoveFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setIsAITyping(true);
    window.dispatchEvent(new CustomEvent("hedge-typing-state", { detail: true }));
    const controller = new AbortController();
    setAbortController(controller);
    let content = input;
    let fileMeta: { name: string; type: string; size: number }[] = [];
    let extractedText = content;
    if (files.length > 0) {
      fileMeta = files.map(f => ({ name: f.name, type: f.type, size: f.size }));
    }
    if (!content.trim() && fileMeta.length === 0) {
      setLoading(false);
      setIsAITyping(false);
      setAbortController(null);
      return;
    }

    // IMMEDIATELY show user message in chat and clear input (like a text message)
    window.dispatchEvent(new CustomEvent("chat-message", { detail: { role: "user", content: content, files: fileMeta } }));
    window.dispatchEvent(new CustomEvent("hedge-corner-typing", { detail: true }));
    setInput("");
    setFiles([]);
    // Reset textarea height after send
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Save user message to database in background
    saveMessage('user', content, fileMeta);

    // Now handle file extraction and AI response in the background
    (async () => {
      if (files.length > 0) {
        try {
          console.log("Files being sent to backend:", files); // Debug log
          const formData = new FormData();
          files.forEach(f => formData.append("files", f));
          const res = await fetch("/api/extract", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });
          const data = await res.json();
          extractedText = data.text || content;
        } catch (err) {
          window.dispatchEvent(new CustomEvent("chat-message", { detail: { role: "ai", content: "Sorry, file extraction failed. Please try again." } }));
          setLoading(false);
          setIsAITyping(false);
          setAbortController(null);
          return;
        }
      }
      try {
        const res = await fetch("/api/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            assignment: extractedText,
            files: fileMeta, // Pass file metadata to the API
            chatHistory: chatHistory // Pass chat history context
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        
        // Save AI response to database
        await saveMessage('ai', data.feedback);
        
        window.dispatchEvent(new CustomEvent("chat-message", { detail: { role: "ai", content: data.feedback } }));
      } catch (err) {
        const error = err as Error & { name?: string };
        if (error.name !== "AbortError") {
          const errorMessage = "Sorry, something went wrong.";
          await saveMessage('ai', errorMessage);
          window.dispatchEvent(new CustomEvent("chat-message", { detail: { role: "ai", content: errorMessage } }));
        }
      }
      setLoading(false);
      setIsAITyping(false);
      setAbortController(null);
    })();
  }

  function handleBreak() {
    setIsStopPressed(true);
    setIsAITyping(false);
    setLoading(false);
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    window.dispatchEvent(new CustomEvent("hedge-stop-typing"));
    window.dispatchEvent(new CustomEvent("hedge-typing-state", { detail: false }));
    
    // Reset stop button state after a short delay
    setTimeout(() => setIsStopPressed(false), 200);
  }

  return (
    <div ref={dropRef} className="w-full max-w-2xl mx-auto relative">
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#f3f3f3] bg-opacity-90 pointer-events-none rounded-lg transition-colors">
          <span className="text-7xl font-extralight text-[#333] select-none" style={{fontFamily: 'monospace', fontWeight: 100}}>+</span>
        </div>
      )}
      {/* File Chips */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm max-w-xs">
              <svg width="20" height="20" fill="none" stroke="#C1272D" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M16.5 13.5V17a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 7.5 17v-3.5M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5"/>
              </svg>
              <span className="truncate text-sm max-w-[120px]">{f.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveFile(idx)}
                className="ml-2 text-gray-400 hover:text-red-500"
                title="Remove file"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="flex items-center px-4 py-4 bg-[#f7f7f8] rounded-lg shadow-md relative min-h-[64px]"
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent border-none outline-none resize-none min-h-[44px] max-h-[40vh] px-2 text-base placeholder-gray-400 pr-24 transition-all"
          placeholder="Message Hedge AI"
          value={input}
          onChange={e => {
            setInput(e.target.value);
            const ta = e.target as HTMLTextAreaElement;
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
            // If text is erased, shrink box
            if (ta.value.length === 0) {
              ta.style.height = 'auto';
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!loading && (input.trim() || files.length > 0)) {
                handleSubmit(e as any);
              }
            }
          }}
          disabled={loading}
          rows={1}
        />
        {/* Action Buttons - absolute in bottom right */}
        <div className="absolute right-6 bottom-3 flex gap-2">
          {/* Upload Button */}
          <label className="flex items-center cursor-pointer">
            <input
              type="file"
              accept=".txt,.pdf,.docx,image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={loading || files.length >= 10}
              multiple
            />
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#f7f7f8] hover:bg-[#eee] transition border border-gray-200 ${files.length >= 10 ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16.5 13.5V17a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 7.5 17v-3.5M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5"/></svg>
            </span>
          </label>
          {/* Send/Break Button */}
          {isAITyping || loading ? (
            <button
              type="button"
              onClick={handleBreak}
              className={`inline-flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 border-2 shadow-lg ${
                isStopPressed 
                          ? 'bg-[#C1272D] border-[#C1272D] shadow-inner'
        : 'bg-[#FFFACD] hover:bg-[#FFF8DC] border-[#C1272D] hover:shadow-xl animate-pulse'
              }`}
              title="Stop AI response"
            >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={isStopPressed ? "#FFFACD" : "#C1272D"}>
          <rect x="6" y="6" width="12" height="12" rx="1" fill={isStopPressed ? "#FFFACD" : "#C1272D"} />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#e6e6e6] hover:bg-[#FFFACD] transition"
              disabled={loading || (!input.trim() && files.length === 0)}
            >
              <svg width="20" height="20" fill="none" stroke="#C1272D" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
} 