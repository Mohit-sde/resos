/**
 * Restaurant-specific session manager
 * Stores per-restaurant auth context in localStorage
 * Key format: restaurantSession_${restaurantId}
 */

export interface RestaurantSession {
  restaurantId: string;
  userId: string;
  loginTimestamp: number;
}

const SESSION_PREFIX = "restaurantSession_";

export const restaurantSessionManager = {
  /**
   * Get session for a specific restaurant
   */
  getSession: (restaurantId: string): RestaurantSession | null => {
    try {
      const key = `${SESSION_PREFIX}${restaurantId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  /**
   * Create/update session for a restaurant
   */
  setSession: (restaurantId: string, userId: string): RestaurantSession => {
    const session: RestaurantSession = {
      restaurantId,
      userId,
      loginTimestamp: Date.now(),
    };
    const key = `${SESSION_PREFIX}${restaurantId}`;
    localStorage.setItem(key, JSON.stringify(session));
    return session;
  },

  /**
   * Clear session for a restaurant
   */
  clearSession: (restaurantId: string): void => {
    const key = `${SESSION_PREFIX}${restaurantId}`;
    localStorage.removeItem(key);
  },

  /**
   * Check if a valid session exists for a restaurant
   */
  hasValidSession: (restaurantId: string): boolean => {
    return restaurantSessionManager.getSession(restaurantId) !== null;
  },

  /**
   * Verify session user matches current Firebase user
   */
  validateSessionUser: (
    restaurantId: string,
    currentUserId: string
  ): boolean => {
    const session = restaurantSessionManager.getSession(restaurantId);
    return session?.userId === currentUserId;
  },

  /**
   * Get all active restaurant sessions
   */
  getAllSessions: (): Record<string, RestaurantSession> => {
    try {
      const sessions: Record<string, RestaurantSession> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(SESSION_PREFIX)) {
          const restaurantId = key.replace(SESSION_PREFIX, "");
          const session = restaurantSessionManager.getSession(restaurantId);
          if (session) {
            sessions[restaurantId] = session;
          }
        }
      }
      return sessions;
    } catch {
      return {};
    }
  },

  /**
   * Clear all restaurant sessions (user logout everywhere)
   */
  clearAllSessions: (): void => {
    const sessions = restaurantSessionManager.getAllSessions();
    Object.keys(sessions).forEach((restaurantId) => {
      restaurantSessionManager.clearSession(restaurantId);
    });
  },
};