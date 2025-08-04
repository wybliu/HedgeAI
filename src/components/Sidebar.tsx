'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  last_message?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
}

export default function Sidebar({ 
  isOpen, 
  onToggle, 
  currentSessionId, 
  onSessionSelect, 
  onNewChat 
}: SidebarProps) {
  const { user, signOut } = useAuth();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user]);

  const loadChatSessions = async () => {
    try {
      // First try to load from chat_sessions table
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (sessionsError) {
        console.error('Error loading sessions:', sessionsError);
        // Fallback to old method
        const { data: messages, error: messagesError } = await supabase
          .from('chat_history')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });

        if (messagesError) throw messagesError;

        // Group messages by session (simple approach)
        const sessions = messages.reduce((acc: ChatSession[], message) => {
          const sessionId = message.id.split('-')[0];
          const existingSession = acc.find(s => s.id === sessionId);
          
          if (existingSession) {
            existingSession.last_message = message.content.substring(0, 50) + '...';
          } else {
            acc.push({
              id: sessionId,
              title: `Chat ${acc.length + 1}`,
              created_at: message.created_at,
              last_message: message.content.substring(0, 50) + '...'
            });
          }
          return acc;
        }, []);

        setChatSessions(sessions);
      } else {
        // Use sessions from chat_sessions table
        const sessionsWithMessages = await Promise.all(
          sessions.map(async (session) => {
            const { data: lastMessage } = await supabase
              .from('chat_history')
              .select('content')
              .eq('session_id', session.id)
              .order('created_at', { ascending: false })
              .limit(1);

            return {
              id: session.id,
              title: session.title === 'New Chat' ? (lastMessage?.[0]?.content?.substring(0, 30) + '...' || 'New Chat') : session.title,
              created_at: session.created_at,
              last_message: lastMessage?.[0]?.content?.substring(0, 50) + '...'
            };
          })
        );

        setChatSessions(sessionsWithMessages);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 h-full bg-white border-l border-gray-200 z-50 transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 w-80' : 'translate-x-full w-0'}
        lg:relative lg:z-auto lg:transition-all lg:duration-300
        ${isOpen ? 'lg:translate-x-0 lg:w-80' : 'lg:translate-x-full lg:w-0'}
        flex flex-col overflow-hidden
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-800 text-lg">Chat History</span>
          </div>
          <button
            onClick={onToggle}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 flex-shrink-0">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[#C1272D] text-white rounded-lg hover:bg-[#a02026] transition-colors"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New Chat
          </button>
        </div>

        {/* Chat History - Scrollable Area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#C1272D] mx-auto mb-2"></div>
              Loading chats...
            </div>
          ) : chatSessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No chat history yet
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {chatSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSessionSelect(session.id)}
                  className={`
                    w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors
                    ${currentSessionId === session.id ? 'bg-gray-100 border-l-4 border-[#C1272D]' : ''}
                  `}
                >
                  <div className="font-medium text-gray-800 truncate">
                    {session.title}
                  </div>
                  {session.last_message && (
                    <div className="text-sm text-gray-500 truncate mt-1">
                      {session.last_message}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {formatDate(session.created_at)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile - Fixed at Bottom */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {user?.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="Profile" 
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {user?.user_metadata?.full_name || user?.email}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {user?.email}
              </div>
            </div>
            <button
              onClick={signOut}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Sign out"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 