'use client';

import { useState } from 'react';
import { useAuth } from "../contexts/AuthContext";
import Chat from "../components/Chat";
import ChatInput from "../components/ChatInput";
import Sidebar from "../components/Sidebar";
import Login from "../components/Login";
import Image from "next/image";

export default function Home() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Start with sidebar open
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f7f1f1]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C1272D] mx-auto mb-4"></div>
          <p className="text-[#333]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleNewChat = () => {
    setCurrentSessionId(undefined);
    // Clear current chat messages (you'll need to implement this in Chat component)
    window.dispatchEvent(new CustomEvent('clear-chat'));
  };

  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setSidebarOpen(false); // Close sidebar on mobile
    // Load chat messages for this session (you'll need to implement this)
    window.dispatchEvent(new CustomEvent('load-session', { detail: sessionId }));
  };

  const handleSidebarToggle = () => {
    console.log('Sidebar toggle clicked, current state:', sidebarOpen);
    setSidebarOpen(!sidebarOpen);
    console.log('New state will be:', !sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-[#fff] text-[#222] font-sans overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 bg-white border-b-2 border-[#FFFACD] sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-full border-2 border-[#FFFACD] bg-white p-1">
              <Image src="/logo.png" alt="Hedge Academy Logo" width={48} height={48} />
            </div>
            <span className="text-3xl font-bold text-black tracking-tight">Hedge Academy AI</span>
          </div>
          
          {/* Hamburger menu button on the right */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={handleSidebarToggle}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg border border-gray-300"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            
            {/* Desktop sidebar toggle button */}
            <button
              onClick={handleSidebarToggle}
              className="hidden lg:block p-2 hover:bg-gray-100 rounded-lg border border-gray-300"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </header>
        
        {/* Chat area */}
        <main className="flex-1 flex flex-col items-center justify-end bg-[#f7f1f1] px-2 sm:px-0 py-6 overflow-y-auto">
          <div className="w-full max-w-4xl flex flex-col flex-1 justify-end">
            <Chat sessionId={currentSessionId} />
          </div>
        </main>
        
        {/* Input area */}
        <footer className="w-full bg-[#6d2027] border-t-2 border-[#FFFACD] px-2 py-4 sticky bottom-0 z-20 flex justify-center items-end">
          <div className="w-full max-w-2xl">
            <ChatInput sessionId={currentSessionId} />
          </div>
        </footer>
      </div>

      {/* Sidebar - now on the right */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
      />
    </div>
  );
}
