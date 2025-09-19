import { Server } from 'socket.io';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import redisClient from '../cache/redis-client.js';
import { User } from '../database/models.js';

class WebSocketServer {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.connectedClients = new Map(); // userId -> socket.id
    this.userSockets = new Map(); // socket.id -> userId
    this.scanRooms = new Map(); // scanId -> Set of socket ids

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await new User().findById(decoded.id);
        
        if (!user || !user.is_active) {
          return next(new Error('Authentication error: Invalid user'));
        }

        socket.user = user;
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(new Error('Authentication error: Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.user.id} connected with socket ${socket.id}`);
      
      // Track user connections
      this.connectedClients.set(socket.user.id, socket.id);
      this.userSockets.set(socket.id, socket.user.id);

      // Join user-specific room
      socket.join(`user:${socket.user.id}`);

      // Join organization rooms if user belongs to organizations
      this.joinOrganizationRooms(socket);

      // Handle custom events
      this.handleSocketEvents(socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
    });
  }

  async joinOrganizationRooms(socket) {
    try {
      const organizations = await new User().getOrganizations(socket.user.id);
      organizations.forEach(org => {
        socket.join(`organization:${org.id}`);
      });
    } catch (error) {
      console.error('Error joining organization rooms:', error);
    }
  }

  handleSocketEvents(socket) {
    // Join scan room for real-time updates
    socket.on('join-scan', (scanId) => {
      socket.join(`scan:${scanId}`);
      
      if (!this.scanRooms.has(scanId)) {
        this.scanRooms.set(scanId, new Set());
      }
      this.scanRooms.get(scanId).add(socket.id);
      
      console.log(`User ${socket.user.id} joined scan room ${scanId}`);
    });

    // Leave scan room
    socket.on('leave-scan', (scanId) => {
      socket.leave(`scan:${scanId}`);
      
      if (this.scanRooms.has(scanId)) {
        this.scanRooms.get(scanId).delete(socket.id);
        if (this.scanRooms.get(scanId).size === 0) {
          this.scanRooms.delete(scanId);
        }
      }
      
      console.log(`User ${socket.user.id} left scan room ${scanId}`);
    });

    // Join monitoring room
    socket.on('join-monitoring', (configId) => {
      socket.join(`monitoring:${configId}`);
      console.log(`User ${socket.user.id} joined monitoring room ${configId}`);
    });

    // Leave monitoring room
    socket.on('leave-monitoring', (configId) => {
      socket.leave(`monitoring:${configId}`);
      console.log(`User ${socket.user.id} left monitoring room ${configId}`);
    });

    // Subscribe to organization alerts
    socket.on('subscribe-organization-alerts', (organizationId) => {
      socket.join(`alerts:${organizationId}`);
      console.log(`User ${socket.user.id} subscribed to alerts for organization ${organizationId}`);
    });

    // Unsubscribe from organization alerts
    socket.on('unsubscribe-organization-alerts', (organizationId) => {
      socket.leave(`alerts:${organizationId}`);
      console.log(`User ${socket.user.id} unsubscribed from alerts for organization ${organizationId}`);
    });

    // Request scan status
    socket.on('get-scan-status', async (scanId) => {
      try {
        const cachedStatus = await redisClient.get(`scan_status:${scanId}`);
        if (cachedStatus) {
          socket.emit('scan-status', { scanId, status: cachedStatus });
        }
      } catch (error) {
        console.error('Error getting scan status:', error);
        socket.emit('error', { message: 'Failed to get scan status' });
      }
    });

    // Ping/Pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  }

  handleDisconnection(socket) {
    console.log(`User ${socket.user.id} disconnected`);

    // Clean up tracking maps
    this.connectedClients.delete(socket.user.id);
    this.userSockets.delete(socket.id);

    // Clean up scan rooms
    this.scanRooms.forEach((sockets, scanId) => {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.scanRooms.delete(scanId);
      }
    });
  }

  // Public methods for emitting events

  // Scan progress updates
  async emitScanProgress(scanId, progress) {
    const room = `scan:${scanId}`;
    const data = {
      scanId,
      progress,
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('scan-progress', data);
    
    // Cache the progress
    await redisClient.set(`scan_progress:${scanId}`, data, 300); // 5 minutes
  }

  // Scan completion
  async emitScanCompleted(scanId, results) {
    const room = `scan:${scanId}`;
    const data = {
      scanId,
      status: 'completed',
      results,
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('scan-completed', data);
    
    // Cache the completion status
    await redisClient.set(`scan_status:${scanId}`, data, 3600); // 1 hour
  }

  // Scan errors
  async emitScanError(scanId, error) {
    const room = `scan:${scanId}`;
    const data = {
      scanId,
      status: 'error',
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('scan-error', data);
    
    // Cache the error status
    await redisClient.set(`scan_status:${scanId}`, data, 3600); // 1 hour
  }

  // Real-time monitoring alerts
  async emitMonitoringAlert(configId, alert) {
    const room = `monitoring:${configId}`;
    const data = {
      configId,
      alert,
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('monitoring-alert', data);
  }

  // Organization-wide alerts
  async emitOrganizationAlert(organizationId, alert) {
    const room = `alerts:${organizationId}`;
    const data = {
      organizationId,
      alert,
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('organization-alert', data);
  }

  // User-specific notifications
  async emitUserNotification(userId, notification) {
    const room = `user:${userId}`;
    const data = {
      userId,
      notification,
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('user-notification', data);
  }

  // Vulnerability detected
  async emitVulnerabilityDetected(scanId, vulnerability) {
    const room = `scan:${scanId}`;
    const data = {
      scanId,
      vulnerability,
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('vulnerability-detected', data);
  }

  // API security issue detected
  async emitApiSecurityIssue(scanId, issue) {
    const room = `scan:${scanId}`;
    const data = {
      scanId,
      issue,
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('api-security-issue', data);
  }

  // Compliance status update
  async emitComplianceUpdate(organizationId, update) {
    const room = `alerts:${organizationId}`;
    const data = {
      organizationId,
      update,
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('compliance-update', data);
  }

  // ML anomaly detected
  async emitAnomalyDetected(scanId, anomaly) {
    const room = `scan:${scanId}`;
    const data = {
      scanId,
      anomaly,
      timestamp: new Date().toISOString()
    };

    this.io.to(room).emit('anomaly-detected', data);
  }

  // System status updates
  async emitSystemStatus(status) {
    this.io.emit('system-status', {
      status,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast to all connected clients
  async broadcast(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Get connection statistics
  getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      totalSockets: this.userSockets.size,
      activeScanRooms: this.scanRooms.size,
      scanRoomDetails: Array.from(this.scanRooms.entries()).map(([scanId, sockets]) => ({
        scanId,
        participantCount: sockets.size
      }))
    };
  }

  // Send message to specific user
  async sendToUser(userId, event, data) {
    const socketId = this.connectedClients.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  // Send message to organization
  async sendToOrganization(organizationId, event, data) {
    const room = `organization:${organizationId}`;
    this.io.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  // Health check
  async healthCheck() {
    return {
      status: 'healthy',
      connections: this.getConnectionStats(),
      timestamp: new Date().toISOString()
    };
  }
}

// Factory function to create WebSocket server
export function createWebSocketServer(httpServer) {
  return new WebSocketServer(httpServer);
}

export default WebSocketServer;
