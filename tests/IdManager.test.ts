import { describe, it, expect } from 'vitest';
import { IdManager } from '../src/utils/IdManager';

describe('IdManager', () => {
    describe('Field ID encoding & decoding', () => {
        it('should encode string components correctly', () => {
            const encoded = IdManager.encodeFieldId('session123', 5, 'textbox');
            expect(encoded).toBe('dg_session123_05_0');
        });

        it('should encode number and slider components with NUMBER flags', () => {
            const encodedNumber = IdManager.encodeFieldId('session123', 10, 'number');
            const encodedSlider = IdManager.encodeFieldId('session123', 10, 'slider');
            expect(encodedNumber).toBe('dg_session123_0A_1');
            expect(encodedSlider).toBe('dg_session123_0A_1');
        });

        it('should encode checkbox components with BOOLEAN flags', () => {
            const encoded = IdManager.encodeFieldId('session123', 15, 'checkbox');
            expect(encoded).toBe('dg_session123_0F_2');
        });

        it('should decode valid field IDs correctly', () => {
            const decoded = IdManager.decodeFieldId('dg_session_abc_05_2');
            expect(decoded).toEqual({
                sessionId: 'session_abc',
                gradioIndex: 5,
                flags: 2
            });
        });

        it('should return null for invalid field IDs', () => {
            expect(IdManager.decodeFieldId('invalid_id')).toBeNull();
            expect(IdManager.decodeFieldId('dg_m_session_1')).toBeNull(); // Modal ID, not field ID
        });
    });

    describe('Modal ID encoding & decoding', () => {
        it('should encode modal IDs correctly', () => {
            const encoded = IdManager.encodeModalId('session_xyz', 2);
            expect(encoded).toBe('dg_m_session_xyz_2');
        });

        it('should decode modal IDs correctly', () => {
            const decoded = IdManager.decodeModalId('dg_m_session_xyz_2');
            expect(decoded).toEqual({
                sessionId: 'session_xyz',
                pageIndex: 2
            });
        });

        it('should decode modal IDs with underscores in session ID correctly', () => {
            const decoded = IdManager.decodeModalId('dg_m_session_with_underscores_3');
            expect(decoded).toEqual({
                sessionId: 'session_with_underscores',
                pageIndex: 3
            });
        });

        it('should return null for invalid modal IDs', () => {
            expect(IdManager.decodeModalId('dg_session_abc_05_2')).toBeNull(); // Field ID, not modal ID
            expect(IdManager.decodeModalId('invalid_id')).toBeNull();
        });
    });
});
