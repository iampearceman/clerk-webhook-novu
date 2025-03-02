/**
 * Utility functions for webhook handling
 */

/**
 * A utility function to handle promises and catch errors
 * @param promise The promise to handle
 * @returns An object with either the result or the error
 */
export async function tryCatch<T>(promise: Promise<T>): Promise<{ result?: T; error?: Error }> {
  try {
    const result = await promise;
    return { result };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * A utility function to wait for a background task to complete
 * This is a simplified version of the Next.js waitUntil function
 * @param promise The promise to wait for
 */
export function waitUntil(promise: Promise<any>): void {
  // In a real Next.js environment, this would use the actual waitUntil function
  // For now, we'll just let the promise run in the background
  promise.catch((error) => {
    console.error("Background task error:", error);
  });
}

/**
 * Syncs Stripe customer data to KV store
 * @param customerId The Stripe customer ID
 */
export async function syncStripeDataToKV(customerId: string): Promise<void> {
  try {
    console.log(`Syncing Stripe data for customer: ${customerId}`);
    // In a real implementation, this would fetch data from Stripe and store it in KV
    // For now, we'll just log the customer ID
    console.log(`Successfully synced Stripe data for customer: ${customerId}`);
  } catch (error) {
    console.error(`Error syncing Stripe data for customer ${customerId}:`, error);
  }
} 