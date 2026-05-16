import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { GradioPlayground } from '../src/core/GradioPlayground';

describe('GradioPlayground', () => {
    it('should initialize with custom options', () => {
        const playground = new GradioPlayground({
            sessionTimeoutMs: 5000
        });
        expect(playground).toBeDefined();
        playground.destroy();
    });

    it('should clean up expired sessions automatically', async () => {
        vi.useFakeTimers();

        // Create playground with 50ms timeout
        const playground = new GradioPlayground({
            sessionTimeoutMs: 50
        });

        const mockSessionId = 'test_session';
        const mockSession: any = {
            sessionId: mockSessionId,
            appReference: 'test-app',
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            inputs: []
        };

        // Access internal sessions Map for testing
        (playground as any).sessions.set(mockSessionId, mockSession);

        expect((playground as any).sessions.has(mockSessionId)).toBe(true);

        // Advance timers by 60 seconds (since interval runs every 60s)
        vi.advanceTimersByTime(60 * 1000);

        expect((playground as any).sessions.has(mockSessionId)).toBe(false);

        playground.destroy();
        vi.useRealTimers();
    });
});
