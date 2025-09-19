import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../database/models.js';
import redisClient from '../cache/redis-client.js';
import { AuditLog } from '../database/models.js';

class AuthMiddleware {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.jwtExpiration = process.env.JWT_EXPIRATION || '24h';
    this.refreshTokenExpiration = process.env.REFRESH_TOKEN_EXPIRATION || '7d';
    this.bcryptRounds = 12;
  }

  // Hash password
  async hashPassword(password) {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  // Compare password
  async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT token
  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiration
    });
  }

  // Generate refresh token
  generateRefreshToken(user) {
    const payload = {
      id: user.id,
      type: 'refresh'
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiration
    });
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Authentication middleware for Express
  authenticate = async (req, res, next) => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = this.verifyToken(token);
      
      // Check if user exists and is active
      const user = await new User().findById(decoded.id);
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Check if token is blacklisted
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'Token is blacklisted' });
      }

      // Attach user to request object
      req.user = user;
      req.token = token;
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };

  // Role-based authorization middleware
  authorize = (roles = []) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  };

  // Organization access middleware
  requireOrganizationAccess = async (req, res, next) => {
    try {
      const { organizationId } = req.params;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Admin users can access any organization
      if (req.user.role === 'admin') {
        req.organizationId = organizationId;
        return next();
      }

      // Check if user belongs to the organization
      const organizations = await new User().getOrganizations(req.user.id);
      const hasAccess = organizations.some(org => org.id === organizationId);

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this organization' });
      }

      req.organizationId = organizationId;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };

  // Extract token from request
  extractToken(req) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return req.headers['x-access-token'] || req.query.token;
  }

  // Login user
  async login(email, password, ipAddress = null, userAgent = null) {
    try {
      // Find user by email
      const user = await new User().findByEmail(email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new Error('Account is inactive');
      }

      // Verify password
      const isValidPassword = await this.comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Cache user session
      await redisClient.cacheUserSession(user.id, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        last_login: new Date().toISOString()
      });

      // Update last login
      await new User().updateLastLogin(user.id);

      // Log the login action
      await new AuditLog().logAction({
        user_id: user.id,
        action: 'login',
        resource_type: 'user',
        resource_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        refreshToken
      };
    } catch (error) {
      throw error;
    }
  }

  // Register user
  async register(userData, ipAddress = null, userAgent = null) {
    try {
      const { email, password, name, role = 'user' } = userData;

      // Check if user already exists
      const existingUser = await new User().findByEmail(email);
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create user
      const user = await new User().create({
        email,
        password_hash: passwordHash,
        name,
        role
      });

      // Generate tokens
      const token = this.generateToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Cache user session
      await redisClient.cacheUserSession(user.id, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: new Date().toISOString()
      });

      // Log the registration action
      await new AuditLog().logAction({
        user_id: user.id,
        action: 'register',
        resource_type: 'user',
        resource_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        refreshToken
      };
    } catch (error) {
      throw error;
    }
  }

  // Refresh token
  async refreshToken(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Check if user exists and is active
      const user = await new User().findById(decoded.id);
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return {
        token: newToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw error;
    }
  }

  // Logout user
  async logout(token, userId, ipAddress = null, userAgent = null) {
    try {
      // Blacklist the token
      await redisClient.set(`blacklist:${token}`, true, 86400); // 24 hours

      // Clear user session from cache
      await redisClient.invalidateUserSession(userId);

      // Log the logout action
      await new AuditLog().logAction({
        user_id: userId,
        action: 'logout',
        resource_type: 'user',
        resource_id: userId,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword, ipAddress = null, userAgent = null) {
    try {
      // Get user
      const user = await new User().findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await this.comparePassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await new User().update(userId, { password_hash: newPasswordHash });

      // Invalidate all existing sessions
      await redisClient.invalidateUserSession(userId);

      // Log the password change
      await new AuditLog().logAction({
        user_id: userId,
        action: 'change_password',
        resource_type: 'user',
        resource_id: userId,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Request password reset
  async requestPasswordReset(email) {
    try {
      const user = await new User().findByEmail(email);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { id: user.id, type: 'password_reset' },
        this.jwtSecret,
        { expiresIn: '1h' }
      );

      // Cache reset token
      await redisClient.set(`password_reset:${user.id}`, resetToken, 3600); // 1 hour

      // In a real application, you would send an email here
      // For now, we'll just return the token
      return {
        resetToken,
        message: 'Password reset token generated'
      };
    } catch (error) {
      throw error;
    }
  }

  // Reset password
  async resetPassword(resetToken, newPassword) {
    try {
      const decoded = this.verifyToken(resetToken);
      
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid reset token');
      }

      // Verify reset token exists in cache
      const cachedToken = await redisClient.get(`password_reset:${decoded.id}`);
      if (!cachedToken || cachedToken !== resetToken) {
        throw new Error('Invalid or expired reset token');
      }

      // Get user
      const user = await new User().findById(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await new User().update(decoded.id, { password_hash: newPasswordHash });

      // Clear reset token
      await redisClient.del(`password_reset:${decoded.id}`);

      // Invalidate all existing sessions
      await redisClient.invalidateUserSession(decoded.id);

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Get current user
  async getCurrentUser(userId) {
    try {
      // Try to get from cache first
      const cachedUser = await redisClient.getUserSession(userId);
      if (cachedUser) {
        return cachedUser;
      }

      // Get from database
      const user = await new User().findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        preferences: user.preferences
      };

      // Cache user data
      await redisClient.cacheUserSession(userId, userData);

      return userData;
    } catch (error) {
      throw error;
    }
  }

  // Update user profile
  async updateProfile(userId, updateData, ipAddress = null, userAgent = null) {
    try {
      // Don't allow updating sensitive fields
      const allowedFields = ['name', 'preferences'];
      const filteredData = {};
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      }

      const updatedUser = await new User().update(userId, filteredData);

      // Clear user cache
      await redisClient.invalidateUserSession(userId);

      // Log the profile update
      await new AuditLog().logAction({
        user_id: userId,
        action: 'update_profile',
        resource_type: 'user',
        resource_id: userId,
        old_values: updateData,
        new_values: filteredData,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        preferences: updatedUser.preferences
      };
    } catch (error) {
      throw error;
    }
  }
}

export default AuthMiddleware;
