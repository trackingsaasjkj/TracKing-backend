import { JwtService } from '@nestjs/jwt';
import { ServiceUpdatesGateway } from '../../../modules/servicios/services-updates.gateway';
import { Role } from '../../../core/constants/roles.enum';

function makeSocket(overrides: Partial<{ id: string; auth: Record<string, string>; headers: Record<string, string> }> = {}) {
  const rooms = new Set<string>();
  return {
    id: overrides.id ?? 'socket-1',
    handshake: {
      auth: overrides.auth ?? {},
      headers: overrides.headers ?? {},
    },
    join: jest.fn((room: string) => rooms.add(room)),
    emit: jest.fn(),
    disconnect: jest.fn(),
    _rooms: rooms,
  } as any;
}

describe('ServiceUpdatesGateway', () => {
  let gateway: ServiceUpdatesGateway;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    jwtService = { verify: jest.fn() } as any;
    gateway = new ServiceUpdatesGateway(jwtService);
    // Mock server
    (gateway as any).server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
  });

  describe('handleConnection', () => {
    it('disconnects client with no token', async () => {
      const client = makeSocket();
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects client with invalid JWT', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      const client = makeSocket({ auth: { token: 'bad-token' } });
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects non-COURIER role', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', role: Role.ADMIN });
      const client = makeSocket({ auth: { token: 'valid-token' } });
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('joins courier room and emits ack for valid COURIER', async () => {
      jwtService.verify.mockReturnValue({ sub: 'courier-1', role: Role.COURIER });
      const client = makeSocket({ auth: { token: 'valid-token' } });
      await gateway.handleConnection(client);
      expect(client.join).toHaveBeenCalledWith('courier:courier-1');
      expect(client.emit).toHaveBeenCalledWith('connection:ack', expect.objectContaining({ courierId: 'courier-1' }));
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('tracks multiple sockets for same courier', async () => {
      jwtService.verify.mockReturnValue({ sub: 'courier-1', role: Role.COURIER });
      const c1 = makeSocket({ id: 's1', auth: { token: 't' } });
      const c2 = makeSocket({ id: 's2', auth: { token: 't' } });
      await gateway.handleConnection(c1);
      await gateway.handleConnection(c2);
      expect(gateway.getConnectionCount('courier-1')).toBe(2);
    });
  });

  describe('handleDisconnect', () => {
    it('cleans up socket tracking on disconnect', async () => {
      jwtService.verify.mockReturnValue({ sub: 'courier-1', role: Role.COURIER });
      const client = makeSocket({ id: 's1', auth: { token: 't' } });
      await gateway.handleConnection(client);
      gateway.handleDisconnect(client);
      expect(gateway.getConnectionCount('courier-1')).toBe(0);
    });
  });

  describe('emitServiceUpdate', () => {
    it('emits service:updated to courier room', () => {
      const mockEmit = jest.fn();
      (gateway as any).server.to.mockReturnValue({ emit: mockEmit });
      const service = { id: 'svc-1', status: 'ACCEPTED' };
      gateway.emitServiceUpdate('courier-1', service as any);
      expect((gateway as any).server.to).toHaveBeenCalledWith('courier:courier-1');
      expect(mockEmit).toHaveBeenCalledWith('service:updated', service);
    });
  });

  describe('emitServiceAssigned', () => {
    it('emits service:assigned to courier room', () => {
      const mockEmit = jest.fn();
      (gateway as any).server.to.mockReturnValue({ emit: mockEmit });
      const service = { id: 'svc-2', status: 'ASSIGNED' };
      gateway.emitServiceAssigned('courier-1', service as any);
      expect((gateway as any).server.to).toHaveBeenCalledWith('courier:courier-1');
      expect(mockEmit).toHaveBeenCalledWith('service:assigned', service);
    });
  });
});
