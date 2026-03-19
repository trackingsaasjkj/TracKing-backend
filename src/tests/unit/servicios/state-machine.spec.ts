import { ServicioStateMachine } from '../../../modules/servicios/domain/state-machine/servicio.machine';

describe('ServicioStateMachine', () => {
  describe('canTransition', () => {
    it('PENDING → ASSIGNED ✓', () => expect(ServicioStateMachine.canTransition('PENDING', 'ASSIGNED')).toBe(true));
    it('PENDING → CANCELLED ✓', () => expect(ServicioStateMachine.canTransition('PENDING', 'CANCELLED')).toBe(true));
    it('ASSIGNED → ACCEPTED ✓', () => expect(ServicioStateMachine.canTransition('ASSIGNED', 'ACCEPTED')).toBe(true));
    it('ASSIGNED → CANCELLED ✓', () => expect(ServicioStateMachine.canTransition('ASSIGNED', 'CANCELLED')).toBe(true));
    it('ACCEPTED → IN_TRANSIT ✓', () => expect(ServicioStateMachine.canTransition('ACCEPTED', 'IN_TRANSIT')).toBe(true));
    it('ACCEPTED → CANCELLED ✓', () => expect(ServicioStateMachine.canTransition('ACCEPTED', 'CANCELLED')).toBe(true));
    it('IN_TRANSIT → DELIVERED ✓', () => expect(ServicioStateMachine.canTransition('IN_TRANSIT', 'DELIVERED')).toBe(true));

    it('PENDING → DELIVERED ✗', () => expect(ServicioStateMachine.canTransition('PENDING', 'DELIVERED')).toBe(false));
    it('DELIVERED → CANCELLED ✗', () => expect(ServicioStateMachine.canTransition('DELIVERED', 'CANCELLED')).toBe(false));
    it('CANCELLED → PENDING ✗', () => expect(ServicioStateMachine.canTransition('CANCELLED', 'PENDING')).toBe(false));
    it('IN_TRANSIT → CANCELLED ✗', () => expect(ServicioStateMachine.canTransition('IN_TRANSIT', 'CANCELLED')).toBe(false));
  });

  describe('isFinalState', () => {
    it('DELIVERED is final', () => expect(ServicioStateMachine.isFinalState('DELIVERED')).toBe(true));
    it('CANCELLED is final', () => expect(ServicioStateMachine.isFinalState('CANCELLED')).toBe(true));
    it('PENDING is not final', () => expect(ServicioStateMachine.isFinalState('PENDING')).toBe(false));
  });

  describe('canBeCancelled', () => {
    it('PENDING can be cancelled', () => expect(ServicioStateMachine.canBeCancelled('PENDING')).toBe(true));
    it('ASSIGNED can be cancelled', () => expect(ServicioStateMachine.canBeCancelled('ASSIGNED')).toBe(true));
    it('ACCEPTED can be cancelled', () => expect(ServicioStateMachine.canBeCancelled('ACCEPTED')).toBe(true));
    it('IN_TRANSIT cannot be cancelled', () => expect(ServicioStateMachine.canBeCancelled('IN_TRANSIT')).toBe(false));
    it('DELIVERED cannot be cancelled', () => expect(ServicioStateMachine.canBeCancelled('DELIVERED')).toBe(false));
  });

  describe('requiresEvidence', () => {
    it('DELIVERED requires evidence', () => expect(ServicioStateMachine.requiresEvidence('DELIVERED')).toBe(true));
    it('IN_TRANSIT does not require evidence', () => expect(ServicioStateMachine.requiresEvidence('IN_TRANSIT')).toBe(false));
  });
});
