/**
 * Admin Web Socket.IO — join admin room for new service-request alerts.
 */

import {io, type Socket} from 'socket.io-client';
import {getApiBaseUrl} from '../config/runtime';

export type NewServiceRequestPayload = {
  serviceRequestId: string;
  jobCardId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  serviceType?: string;
  address?: string;
  pincode?: string;
  district?: string;
  status?: string;
  isTargeted?: boolean;
  providerId?: string;
  providersNotified?: number;
  matchBy?: string;
  needsAdminAssignment?: boolean;
  /** Customer asked admin to source providers in their area (no booking yet) */
  needsProvidersInArea?: boolean;
  type?: string;
  createdAt?: string | Date;
};

type Listener = (payload: NewServiceRequestPayload) => void;

function getSocketUrl(): string {
  return getApiBaseUrl().replace(/\/api\/?$/, '');
}

class AdminSocketService {
  private socket: Socket | null = null;
  private listeners = new Set<Listener>();

  connect(): void {
    if (this.socket?.connected) {
      this.socket.emit('join-admin-room');
      return;
    }
    if (this.socket) {
      this.socket.connect();
      return;
    }

    const url = getSocketUrl();
    this.socket = io(url, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      query: {clientType: 'admin'},
    });

    this.socket.on('connect', () => {
      this.socket?.emit('join-admin-room');
    });

    this.socket.on('new-service-request', (payload: NewServiceRequestPayload) => {
      this.listeners.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.warn('[admin-socket] listener error', err);
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  onNewServiceRequest(listener: Listener): () => void {
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const adminSocketService = new AdminSocketService();
