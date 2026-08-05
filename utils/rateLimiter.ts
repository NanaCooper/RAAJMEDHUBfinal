import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Prefixes ────────────────────────────────────────────────────────────────
const RATE_LIMIT_PREFIX  = 'auth_rate_limit_';   // existing — verification cooldowns
const ACTION_PREFIX      = 'action_rate_limit_'; // new — generic action cooldowns
const ATTEMPT_PREFIX     = 'login_attempts_';    // new — failed login attempt counters

// ─── Default cooldowns (seconds) ─────────────────────────────────────────────
const DEFAULT_COOLDOWN_SECONDS = 60;

export type ActionType =
  | 'email'            // email verification (original)
  | 'phone'            // phone verification (original)
  | 'password_change'  // change password (security screens)
  | 'password_reset'   // forgot-password flow
  | 'profile_save'     // profile update write
  | 'appointment'      // appointment booking
  | 'data_export';     // settings data export

const ACTION_COOLDOWNS: Record<ActionType, number> = {
  email:           60,
  phone:           60,
  password_change: 60,
  password_reset:  60,
  profile_save:    15,
  appointment:     30,
  data_export:     60,
};

// ─── Existing API (kept 100% backward-compatible) ────────────────────────────

/**
 * Checks if a verification code can be sent to the given identifier.
 * Used by phone SMS and email resend flows.
 */
export async function canSendVerification(
  identifier: string,
  type: 'email' | 'phone'
): Promise<{ allowed: boolean; remainingSeconds: number }> {
  try {
    const key = `${RATE_LIMIT_PREFIX}${type}_${identifier}`;
    const lastSentStr = await AsyncStorage.getItem(key);

    if (!lastSentStr) {
      return { allowed: true, remainingSeconds: 0 };
    }

    const lastSentTime = parseInt(lastSentStr, 10);
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - lastSentTime) / 1000);
    const cooldown = ACTION_COOLDOWNS[type];

    if (elapsedSeconds < cooldown) {
      return { allowed: false, remainingSeconds: cooldown - elapsedSeconds };
    }

    return { allowed: true, remainingSeconds: 0 };
  } catch (error) {
    console.warn('Error checking rate limit:', error);
    return { allowed: true, remainingSeconds: 0 };
  }
}

/**
 * Records that a verification was sent for the given identifier.
 */
export async function recordVerificationSent(
  identifier: string,
  type: 'email' | 'phone'
): Promise<void> {
  try {
    const key = `${RATE_LIMIT_PREFIX}${type}_${identifier}`;
    await AsyncStorage.setItem(key, Date.now().toString());
  } catch (error) {
    console.warn('Error recording rate limit:', error);
  }
}

/**
 * Gets the remaining cooldown time for a verification identifier.
 */
export async function getRemainingCooldown(
  identifier: string,
  type: 'email' | 'phone'
): Promise<number> {
  const result = await canSendVerification(identifier, type);
  return result.remainingSeconds;
}

/**
 * Clears a verification rate limit (e.g. after success or for testing).
 */
export async function clearRateLimit(
  identifier: string,
  type: 'email' | 'phone'
): Promise<void> {
  try {
    const key = `${RATE_LIMIT_PREFIX}${type}_${identifier}`;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn('Error clearing rate limit:', error);
  }
}

// ─── New Generic Action API ───────────────────────────────────────────────────

/**
 * Checks whether a generic action can be performed for this identifier.
 * @param identifier  Usually the user UID, or email for pre-auth flows.
 * @param action      The type of action being rate-limited.
 * @returns Object with `allowed` flag and `remainingSeconds`.
 */
export async function canPerformAction(
  identifier: string,
  action: ActionType
): Promise<{ allowed: boolean; remainingSeconds: number }> {
  try {
    const key = `${ACTION_PREFIX}${action}_${identifier}`;
    const lastStr = await AsyncStorage.getItem(key);

    if (!lastStr) {
      return { allowed: true, remainingSeconds: 0 };
    }

    const lastTime = parseInt(lastStr, 10);
    const elapsed = Math.floor((Date.now() - lastTime) / 1000);
    const cooldown = ACTION_COOLDOWNS[action];

    if (elapsed < cooldown) {
      return { allowed: false, remainingSeconds: cooldown - elapsed };
    }

    return { allowed: true, remainingSeconds: 0 };
  } catch (error) {
    console.warn('canPerformAction error:', error);
    return { allowed: true, remainingSeconds: 0 };
  }
}

/**
 * Records that an action was performed, starting a cooldown for this identifier.
 */
export async function recordAction(
  identifier: string,
  action: ActionType
): Promise<void> {
  try {
    const key = `${ACTION_PREFIX}${action}_${identifier}`;
    await AsyncStorage.setItem(key, Date.now().toString());
  } catch (error) {
    console.warn('recordAction error:', error);
  }
}

/**
 * Clears an action rate limit (e.g. for testing or after logout).
 */
export async function clearActionLimit(
  identifier: string,
  action: ActionType
): Promise<void> {
  try {
    const key = `${ACTION_PREFIX}${action}_${identifier}`;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn('clearActionLimit error:', error);
  }
}

// ─── Login Attempt / Lockout API ─────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS  = 5;   // failures before lockout
const LOGIN_LOCKOUT_SEC   = 30;  // lockout duration in seconds

interface LoginAttemptData {
  count: number;
  lastAttemptAt: number;
  lockedUntil: number; // epoch ms; 0 = not locked
}

/**
 * Records a failed login attempt for the given identifier (email/phone).
 * Applies a lockout if MAX_LOGIN_ATTEMPTS is exceeded.
 */
export async function recordFailedLoginAttempt(
  identifier: string
): Promise<{ locked: boolean; remainingSeconds: number; attemptsLeft: number }> {
  try {
    const key = `${ATTEMPT_PREFIX}${identifier}`;
    const raw = await AsyncStorage.getItem(key);
    const now = Date.now();

    let data: LoginAttemptData = raw
      ? JSON.parse(raw)
      : { count: 0, lastAttemptAt: now, lockedUntil: 0 };

    // If there's an active lock, return it without incrementing
    if (data.lockedUntil > now) {
      const remaining = Math.ceil((data.lockedUntil - now) / 1000);
      return { locked: true, remainingSeconds: remaining, attemptsLeft: 0 };
    }

    // If last attempt was before a "session reset" window (e.g. 10 min), reset counter
    const SESSION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
    if (now - data.lastAttemptAt > SESSION_WINDOW_MS) {
      data.count = 0;
    }

    data.count += 1;
    data.lastAttemptAt = now;

    if (data.count >= MAX_LOGIN_ATTEMPTS) {
      data.lockedUntil = now + LOGIN_LOCKOUT_SEC * 1000;
      await AsyncStorage.setItem(key, JSON.stringify(data));
      return { locked: true, remainingSeconds: LOGIN_LOCKOUT_SEC, attemptsLeft: 0 };
    }

    await AsyncStorage.setItem(key, JSON.stringify(data));
    const attemptsLeft = MAX_LOGIN_ATTEMPTS - data.count;
    return { locked: false, remainingSeconds: 0, attemptsLeft };
  } catch (error) {
    console.warn('recordFailedLoginAttempt error:', error);
    return { locked: false, remainingSeconds: 0, attemptsLeft: MAX_LOGIN_ATTEMPTS };
  }
}

/**
 * Checks current lockout state without consuming an attempt.
 */
export async function checkLoginLockout(
  identifier: string
): Promise<{ locked: boolean; remainingSeconds: number }> {
  try {
    const key = `${ATTEMPT_PREFIX}${identifier}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { locked: false, remainingSeconds: 0 };

    const data: LoginAttemptData = JSON.parse(raw);
    const now = Date.now();

    if (data.lockedUntil > now) {
      const remaining = Math.ceil((data.lockedUntil - now) / 1000);
      return { locked: true, remainingSeconds: remaining };
    }

    return { locked: false, remainingSeconds: 0 };
  } catch (error) {
    console.warn('checkLoginLockout error:', error);
    return { locked: false, remainingSeconds: 0 };
  }
}

/**
 * Clears the failed login attempts for an identifier on successful sign-in.
 */
export async function clearLoginAttempts(identifier: string): Promise<void> {
  try {
    const key = `${ATTEMPT_PREFIX}${identifier}`;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn('clearLoginAttempts error:', error);
  }
}
