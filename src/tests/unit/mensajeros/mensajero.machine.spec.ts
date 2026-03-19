import { MensajeroStateMachine } from '../../../modules/mensajeros/domain/mensajero.machine';

describe('MensajeroStateMachine', () => {
  describe('canTransition', () => {
    it('UNAVAILABLE → AVAILABLE ✓', () =>
      expect(MensajeroStateMachine.canTransition('UNAVAILABLE', 'AVAILABLE')).toBe(true));
    it('AVAILABLE → IN_SERVICE ✓', () =>
      expect(MensajeroStateMachine.canTransition('AVAILABLE', 'IN_SERVICE')).toBe(true));
    it('AVAILABLE → UNAVAILABLE ✓', () =>
      expect(MensajeroStateMachine.canTransition('AVAILABLE', 'UNAVAILABLE')).toBe(true));
    it('IN_SERVICE → AVAILABLE ✓', () =>
      expect(MensajeroStateMachine.canTransition('IN_SERVICE', 'AVAILABLE')).toBe(true));

    it('IN_SERVICE → UNAVAILABLE ✗', () =>
      expect(MensajeroStateMachine.canTransition('IN_SERVICE', 'UNAVAILABLE')).toBe(false));
    it('UNAVAILABLE → IN_SERVICE ✗', () =>
      expect(MensajeroStateMachine.canTransition('UNAVAILABLE', 'IN_SERVICE')).toBe(false));
  });

  describe('canReceiveServices', () => {
    it('AVAILABLE can receive', () =>
      expect(MensajeroStateMachine.canReceiveServices('AVAILABLE')).toBe(true));
    it('IN_SERVICE cannot receive', () =>
      expect(MensajeroStateMachine.canReceiveServices('IN_SERVICE')).toBe(false));
    it('UNAVAILABLE cannot receive', () =>
      expect(MensajeroStateMachine.canReceiveServices('UNAVAILABLE')).toBe(false));
  });
});
