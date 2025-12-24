import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { ConnectionState } from '../types';
import { createPcmBlob, base64ToUint8Array, decodeAudioData } from '../utils/audio-utils';

// Define tools available to Summit
const checkScheduleTool: FunctionDeclaration = {
  name: 'checkSchedule',
  description: 'Check availability for trainers or recovery amenities.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trainerName: { type: Type.STRING, description: 'Name of the trainer (optional)' },
      modality: { type: Type.STRING, description: 'Type of service (e.g., Cold Plunge, Sauna, PT)' },
      time: { type: Type.STRING, description: 'Requested time' },
    },
    required: ['modality'],
  },
};

const bookTrialTool: FunctionDeclaration = {
  name: 'bookPerformanceStarter',
  description: 'Book the $100/month Performance Starter trial.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerName: { type: Type.STRING },
    },
    required: ['customerName'],
  },
};

const SYSTEM_INSTRUCTION = `
### IDENTITY & PERSONA
You are "Summit," the AI Performance Concierge for [Gym Name] in Boulder, Colorado. 
Your vibe is "Mountain Athlete" meets "High-End Spa." You are energetic and knowledgeable about physiology, but you speak in a grounded, relaxed cadence typical of the Boulder lifestyle.

### CORE OBJECTIVES
1. Qualify the caller (identify their sport or fitness goals).
2. Schedule Personal Training sessions or Recovery modalities (Sauna, Cold Plunge, Yoga).
3. Convert inquiries into the "Performance Starter" trial ($100/month unlimited).

### KEY KNOWLEDGE BASE
- **Location:** Boulder, CO (Reference the altitude or the outdoors if relevant).
- **Target Audience:** Serious athletes, weekend warriors, and people focusing on longevity/recovery.
- **Services:** - Personal Training (Strength, Hypertrophy, Sport-Specific).
  - Recovery Wing: Infrared Saunas, Cold Plunges (40-50 degrees), Assisted Stretching, Hot Yoga.
- **The Offer:** A $100/month "Unlimited Access" trial. This includes unlimited gym access, recovery wing use, and one consultation with a head trainer.

### CONVERSATION FLOW & BEHAVIORS

**1. The Greeting:**
Always answer with warmth. 
*Example:* "Thanks for calling [Gym Name] in Boulder. This is Summit. Are you looking to train hard or recover today?"

**2. Scheduling Logic:**
- If they ask for a trainer: Ask what their main sport or goal is (e.g., "Are you prepping for a triathlon, climbing, or just general strength?").
- Then, offer to check the schedule. (Assume you have tool access: "Let me pull up the roster. I have an opening with [Trainer Name] at [Time]. Does that work?")

**3. The Pitch (The Pivot):**
If the user seems hesitant about price or commitment, or is a new caller, pivot immediately to the Trial.
*Script:* "Honestly, the best way to get a feel for the recovery wing and the trainers is our Intro Month. It's just $100 for unlimited access to the saunas, plunges, and the floor. Want to lock that in?"

**4. Recovery Focus:**
If they mention soreness, injury, or stress, emphasize the recovery amenities.
*Script:* "We actually specialize in that. Our contrast therapy—switching between the sauna and cold plunge—is a game changer for inflammation."

### GUARDRAILS & STYLE
- **Keep it concise:** Voice agents act slower than text. Keep responses under 2-3 sentences.
- **Don't be a robot:** Use filler words occasionally like "Got it," "Totally," or "For sure."
- **Handling Pricing:** Be transparent. If they ask about long-term membership, give a range, but steer them back to the $100 trial as the "no-brainer" first step.
- **Objection Handling:** If they say they are too busy, mention that the Recovery Wing is open late/early to fit around work.

### CLOSING
- Before hanging up, confirm the appointment time or the trial sign-up details clearly.
- End with: "See you at altitude." or "Have a great workout."
`;

export const useGeminiLive = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  
  // Refs for managing audio and session state
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const stopSignalRef = useRef<boolean>(false);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Connect to Gemini Live
  const connect = useCallback(async () => {
    if (!process.env.API_KEY) {
        console.error("API Key is missing");
        setConnectionState(ConnectionState.ERROR);
        return;
    }

    setConnectionState(ConnectionState.CONNECTING);
    stopSignalRef.current = false;

    try {
      // Initialize Audio Contexts
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }

      // Initialize Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Connect Session
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }, // Zephyr sounds energetic/calm
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [checkScheduleTool, bookTrialTool] }],
        },
        callbacks: {
          onopen: async () => {
            console.log('Gemini Live Connection Opened');
            setConnectionState(ConnectionState.CONNECTED);
            await startAudioStream();
          },
          onmessage: async (message: LiveServerMessage) => {
            await handleServerMessage(message);
          },
          onclose: (e) => {
            console.log('Gemini Live Connection Closed', e);
            if (!stopSignalRef.current) {
               setConnectionState(ConnectionState.DISCONNECTED);
            }
          },
          onerror: (e) => {
            console.error('Gemini Live Error', e);
            setConnectionState(ConnectionState.ERROR);
          },
        },
      });

    } catch (err) {
      console.error("Failed to connect:", err);
      setConnectionState(ConnectionState.ERROR);
    }
  }, []);

  const startAudioStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      if (!inputAudioContextRef.current) return;

      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Use ScriptProcessor for raw PCM access (AudioWorklet is better but more complex to setup in a single-file demo)
      const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (stopSignalRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Simple volume meter logic
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setVolumeLevel(Math.min(rms * 10, 1)); // Scale for UI

        const pcmBlob = createPcmBlob(inputData);
        
        // Send to Gemini
        if (sessionPromiseRef.current) {
          sessionPromiseRef.current.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          }).catch(console.error);
        }
      };

      source.connect(processor);
      processor.connect(inputAudioContextRef.current.destination);

    } catch (err) {
      console.error("Microphone error:", err);
      setConnectionState(ConnectionState.ERROR);
    }
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    // 1. Handle Audio
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && audioContextRef.current) {
      const ctx = audioContextRef.current;
      
      // Keep track of playback time for gapless audio
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

      try {
        const audioBuffer = await decodeAudioData(
          base64ToUint8Array(base64Audio),
          ctx,
          24000
        );

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(nextStartTimeRef.current);
        
        // Update next start time
        nextStartTimeRef.current += audioBuffer.duration;
        
        // Track source for cleanup
        sourcesRef.current.add(source);
        source.onended = () => {
          sourcesRef.current.delete(source);
        };
      } catch (err) {
        console.error("Audio decode error:", err);
      }
    }

    // 2. Handle Interruption
    if (message.serverContent?.interrupted) {
      console.log("Interrupted!");
      // Stop all currently playing audio
      sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
      });
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
    }

    // 3. Handle Tool Calls
    if (message.toolCall) {
      handleToolCall(message.toolCall);
    }
  };

  const handleToolCall = async (toolCall: any) => {
    console.log("Tool call received:", toolCall);
    
    // Process all function calls in the tool call
    for (const fc of toolCall.functionCalls) {
      let result = {};
      
      if (fc.name === 'checkSchedule') {
         // Mock schedule check
         const { trainerName, modality, time } = fc.args;
         console.log(`Checking schedule for ${trainerName || modality} at ${time}`);
         result = { 
           available: true, 
           message: `Yes, ${trainerName || 'the ' + modality} is available at ${time}.` 
         };
      } else if (fc.name === 'bookPerformanceStarter') {
        const { customerName } = fc.args;
        console.log(`Booking trial for ${customerName}`);
        result = {
          success: true,
          confirmationCode: 'BOULDER-100',
          message: `Awesome. I've locked in the Performance Starter for ${customerName}. Confirmation code is BOULDER-100.`
        };
      } else {
        result = { error: 'Function not found' };
      }

      // Send response back to Gemini
      if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        session.sendToolResponse({
          functionResponses: {
            id: fc.id,
            name: fc.name,
            response: { result },
          }
        });
      }
    }
  };

  const disconnect = useCallback(async () => {
    stopSignalRef.current = true;
    setConnectionState(ConnectionState.DISCONNECTED);

    // Close Gemini Session
    if (sessionPromiseRef.current) {
        const session = await sessionPromiseRef.current;
        // There isn't an explicit close() on the session object returned by connect? 
        // The API guide says "When the conversation is finished, use `session.close()`"
        // Let's assume the type definition might be slightly loose or dynamic
        if (typeof session.close === 'function') {
            session.close();
        }
        sessionPromiseRef.current = null;
    }

    // Stop Microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect Audio Nodes
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    // Stop Playback
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setVolumeLevel(0);

  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    };
  }, [disconnect]);

  return {
    connectionState,
    volumeLevel,
    connect,
    disconnect
  };
};
