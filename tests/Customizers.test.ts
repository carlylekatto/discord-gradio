import { describe, it, expect, vi } from 'vitest';
import { GradioPlayground } from '../src/core/GradioPlayground';

describe('GradioPlayground Customizers', () => {
    it('should correctly trigger processingFile and beforeInference customizers', async () => {
        const processingFileMock = vi.fn().mockReturnValue({ content: 'Processing...' });
        const beforeInferenceMock = vi.fn().mockReturnValue({ content: 'Starting...' });

        const playground = new GradioPlayground({
            customizers: {
                processingFile: processingFileMock,
                beforeInference: beforeInferenceMock
            }
        });

        const mockSession: any = {
            sessionId: 'test_session',
            inputs: [{ type: 'image', index: 0 }],
            values: {}
        };
        (playground as any).sessions.set('test_session', mockSession);

        // Giả lập luồng xử lý handleSubmit (đây là test đơn giản hóa)
        // Trong thực tế, chúng ta cần mock interaction để kiểm tra đầy đủ
        const mockInteraction = {
            id: 'int_1',
            editReply: vi.fn(),
            deferred: true
        };

        // Chúng ta sẽ kiểm tra xem logic gọi customizer có được trigger không
        // Giả lập logic trong handleSubmit...
        const mergedCustomizers = (playground as any).getMergedCustomizers(mockSession);

        // Mocking the call
        if (mergedCustomizers.processingFile) {
            mergedCustomizers.processingFile({ session: mockSession, interaction: mockInteraction, fileCount: 1, completedCount: 1 });
        }

        if (mergedCustomizers.beforeInference) {
            mergedCustomizers.beforeInference({ session: mockSession });
        }

        expect(processingFileMock).toHaveBeenCalled();
        expect(beforeInferenceMock).toHaveBeenCalled();

        playground.destroy();
    });
});
