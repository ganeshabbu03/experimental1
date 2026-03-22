import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

/**
 * Terminal Store: Manages shell sessions and real-time backend communication via Socket.io.
 */

interface TerminalSession {
    id: string;
    name: string;
    hasWarning?: boolean;
}

interface TerminalState {
    socket: Socket | null;
    sessions: TerminalSession[];
    activeSessionId: string | null;
    isConnected: boolean;

    // Actions
    connect: () => void;
    disconnect: () => void;
    addSession: (name: string) => void;
    deleteActiveSession: () => void;
    setActiveSession: (id: string) => void;
    sendInput: (data: string) => void;
    resizeTerminal: (cols: number, rows: number) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
    socket: null,
    sessions: [
        { id: 'initial', name: 'terminal' }
    ],
    activeSessionId: 'initial',
    isConnected: false,

    connect: () => {
        const socket = io('http://localhost:3000');

        socket.on('connect', () => {
            console.log('Connected to Terminal Gateway');
            set({ isConnected: true });
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from Terminal Gateway');
            set({ isConnected: false });
        });

        set({ socket });
    },

    disconnect: () => {
        const { socket } = get();
        if (socket) {
            socket.disconnect();
            set({ socket: null, isConnected: false });
        }
    },

    addSession: (name) => {
        const newId = Date.now().toString();
        set((state) => ({
            sessions: [...state.sessions, { id: newId, name }],
            activeSessionId: newId
        }));
    },

    deleteActiveSession: () => set((state) => {
        const filtered = state.sessions.filter(s => s.id !== state.activeSessionId);
        let newActiveId = state.activeSessionId;
        if (filtered.length > 0) {
            newActiveId = filtered[filtered.length - 1].id;
        } else {
            newActiveId = null;
        }
        return { sessions: filtered, activeSessionId: newActiveId };
    }),

    setActiveSession: (id) => set({ activeSessionId: id }),

    sendInput: (data) => {
        const { socket, isConnected } = get();
        if (socket && isConnected) {
            socket.emit('terminal.input', data);
        }
    },

    resizeTerminal: (cols, rows) => {
        const { socket, isConnected } = get();
        if (socket && isConnected) {
            socket.emit('terminal.resize', { cols, rows });
        }
    }
}));
