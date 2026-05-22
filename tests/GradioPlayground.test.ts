import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { GradioPlayground } from '../src/core/GradioPlayground';
import { ConfigParser } from '../src/utils/ConfigParser';

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

    it('should fall back to interaction.locale if options.language is not specified', async () => {
        const playground = new GradioPlayground();
        const mockInteraction = {
            id: 'test_interaction',
            locale: 'vi-VN',
            deferred: true,
            replied: false,
            editReply: vi.fn().mockResolvedValue({}),
            reply: vi.fn().mockResolvedValue({})
        };

        const fetchConfigSpy = vi.spyOn(ConfigParser, 'fetchConfig').mockResolvedValue({
            dependencies: [{ id: 0, inputs: [], outputs: [] }],
            components: [],
            api_prefix: '/gradio_api'
        });
        const parseSpy = vi.spyOn(ConfigParser, 'parse').mockImplementation(() => {
            return {
                apiName: 'predict',
                fnIndex: 0,
                inputs: [],
                outputs: [],
                translations: {}
            };
        });

        await playground.init(mockInteraction as any, 'user/app');

        expect(parseSpy).toHaveBeenCalledWith(expect.anything(), null, 'vi-VN');

        fetchConfigSpy.mockRestore();
        parseSpy.mockRestore();
        playground.destroy();
    });
});
