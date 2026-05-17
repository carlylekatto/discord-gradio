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

    it('should correctly merge global and session-specific customizers', () => {
        const globalLoader = () => 'global_loader';
        const globalResult = () => 'global_result';
        const sessionResult = () => 'session_result';

        const playground = new GradioPlayground({
            customizers: {
                loading: globalLoader,
                result: globalResult
            }
        });

        const mockSession: any = {
            sessionId: 'test_session',
            customizers: {
                result: sessionResult
            }
        };

        const merged = (playground as any).getMergedCustomizers(mockSession);
        
        // Assertions: loading should fall back to global, result should be overridden by session
        expect(merged.loading).toBe(globalLoader);
        expect(merged.result).toBe(sessionResult);

        playground.destroy();
    });
});
