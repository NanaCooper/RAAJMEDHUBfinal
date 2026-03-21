import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_PREFIX = 'auth_rate_limit_';
const DEFAULT_COOLDOWN_SECONDS = 60;

/**
 * Checks if a verification code can be sent to the given identifier.
 * @param identifier The email or phone number
 * @param type 'email' or 'phone'
 * @returns Object containing allowed status and remaining seconds
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

        if (elapsedSeconds < DEFAULT_COOLDOWN_SECONDS) {
            return {
                allowed: false,
                remainingSeconds: DEFAULT_COOLDOWN_SECONDS - elapsedSeconds
            };
        }

        return { allowed: true, remainingSeconds: 0 };
    } catch (error) {
        console.warn('Error checking rate limit:', error);
        // Fail safe: allow sending if storage check fails
        return { allowed: true, remainingSeconds: 0 };
    }
}

/**
 * Records a verification send event for the identifier.
 * @param identifier The email or phone number
 * @param type 'email' or 'phone'
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
 * Gets the remaining cooldown time for an identifier without performing a check logic.
 * @param identifier The email or phone number
 * @param type 'email' or 'phone'
 */
export async function getRemainingCooldown(
    identifier: string,
    type: 'email' | 'phone'
): Promise<number> {
    const result = await canSendVerification(identifier, type);
    return result.remainingSeconds;
}

/**
 * Clear rate limit for testing or success
 */
export async function clearRateLimit(
    identifier: string,
    type: 'email' | 'phone'
): Promise<void> {
    try {
        const key = `${RATE_LIMIT_PREFIX}${type}_${identifier}`;
        await AsyncStorage.removeItem(key);
    } catch (error) {
        console.warn('Error clear rate limit:', error);
    }
}
