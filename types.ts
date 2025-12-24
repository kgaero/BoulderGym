export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface MessageLog {
  role: 'user' | 'system' | 'model';
  text: string;
  timestamp: Date;
}

export interface TrainerSlot {
  trainer: string;
  time: string;
  available: boolean;
}
