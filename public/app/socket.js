import { state } from './state.js';

class SocketManager {
    constructor() {
        this.ws = null;
        this.reconnectInterval = 500;
        this.maxReconnectInterval = 15000;
        this.maxReconnectAttempts = 5;
        this.reconnectAttempts = 0;
        this.listeners = new Map();
        this._readyResolve = null;
        this.ready = new Promise(resolve => { this._readyResolve = resolve; });
        this.connect();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let url = `${protocol}//${window.location.host}`;
        if (window.isGuestMode && window.guestToken) {
            url += `?token=${window.guestToken}`;
        }
        this.ws = new WebSocket(url);

        // Connection timeout: if onopen doesn't fire within 5s, close and reconnect
        const connectTimeout = setTimeout(() => {
            if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                console.warn('WebSocket connection timed out, reconnecting...');
                this.ws.close();
            }
        }, 5000);

        this.ws.onopen = () => {
            clearTimeout(connectTimeout);
            console.log('WebSocket connected');
            this.reconnectInterval = 500;
            this.reconnectAttempts = 0;
            if (this._readyResolve) {
                this._readyResolve();
                this._readyResolve = null;
            }

            if (window.isGuestMode && window.guestToken) {
                this.send('JOIN_SESSION', { guestToken: window.guestToken });
            } else {
                // Initial data fetch
                this.send('GET_SESSIONS');

                // Re-join session if we were in one
                if (state.currentSessionId) {
                    this.send('JOIN_SESSION', { sessionId: state.currentSessionId });
                }
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.emit(message.type, message);
            } catch (e) {
                console.error('Error parsing WebSocket message:', e);
            }
        };

        this.ws.onclose = () => {
            clearTimeout(connectTimeout);
            this.reconnectAttempts++;
            if (this.reconnectAttempts > this.maxReconnectAttempts) {
                console.error(`WebSocket reconnection failed after ${this.maxReconnectAttempts} attempts.`);
                this.emit('CONNECTION_LOST', { attempts: this.reconnectAttempts });
                return;
            }
            console.log(`WebSocket disconnected. Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), this.reconnectInterval);
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, this.maxReconnectInterval);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.ws.close();
        };
    }

    send(type, payload = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...payload }));
        } else {
            console.warn('WebSocket not connected. Message dropped:', type);
        }
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(callback);
    }

    off(type, callback) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).delete(callback);
        }
    }

    emit(type, data) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).forEach(cb => cb(data));
        }
    }
}

export const socket = new SocketManager();
