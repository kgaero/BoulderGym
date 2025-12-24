import React from 'react';
import { useGeminiLive } from './hooks/use-live-api';
import { ConnectionState } from './types';
import { Visualizer } from './components/Visualizer';

// Simple icons
const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
);

const PhoneOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v1a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"></path></svg>
);

const MountainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="m8 3 4 8 5-5 5 15H2L8 3z"></path></svg>
);

export default function App() {
  const { connectionState, volumeLevel, connect, disconnect } = useGeminiLive();

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;
  const isError = connectionState === ConnectionState.ERROR;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-50 p-6 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-20">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-900 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-slate-800 rounded-full blur-[120px]"></div>
      </div>

      <header className="z-10 flex flex-col items-center mb-12 space-y-2">
        <div className="flex items-center space-x-2">
          <MountainIcon />
          <h1 className="text-2xl font-bold tracking-tight">SUMMIT</h1>
        </div>
        <p className="text-slate-400 text-sm tracking-wide uppercase">AI Performance Concierge</p>
      </header>

      <main className="z-10 flex flex-col items-center w-full max-w-md">
        
        {/* Status Display */}
        <div className="mb-8 h-8 flex items-center justify-center">
          {isConnecting && (
            <span className="text-emerald-400 animate-pulse font-medium">Connecting to Summit...</span>
          )}
          {isConnected && (
            <span className="text-emerald-500 font-medium">Live • Listening</span>
          )}
          {connectionState === ConnectionState.DISCONNECTED && (
             <span className="text-slate-500">Tap to start conversation</span>
          )}
          {isError && (
             <span className="text-red-400">Connection Error. Check API Key.</span>
          )}
        </div>

        {/* Visualizer / Avatar */}
        <div className="relative mb-12">
            <Visualizer isActive={isConnected} volume={volumeLevel} />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          {!isConnected && !isConnecting && (
            <button
              onClick={connect}
              className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-emerald-600 hover:bg-emerald-500 transition-all duration-300 shadow-lg hover:shadow-emerald-500/30"
              aria-label="Call Summit"
            >
              <div className="absolute inset-0 rounded-full border border-emerald-400 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"></div>
              <PhoneIcon />
            </button>
          )}

          {(isConnected || isConnecting) && (
            <button
              onClick={disconnect}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 transition-all duration-300 shadow-lg"
              aria-label="End Call"
            >
              <PhoneOffIcon />
            </button>
          )}
        </div>

        <p className="mt-12 text-center text-slate-500 text-xs max-w-xs">
          Summit uses Gemini Live Audio. Speak naturally. Ask about training, recovery, or the $100 Trial.
        </p>

      </main>
    </div>
  );
}
