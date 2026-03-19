import { ConsultarUbicacionUseCase } from '../../../modules/tracking/application/use-cases/consultar-ubicacion.use-case';
import { NotFoundException } from '@nestjs/common';

const makeCourier = () => ({ id: 'c-1', company_id: 'co-1', operational_status: 'IN_SERVICE' });
const makeLocation = () => ({
  id: 'loc-1', courier_id: 'c-1', company_id: 'co-1',
  latitude: 4.710989, longitude: -74.072092, accuracy: 10.5,
  registration_date: new Date(),
});

const mockLocationRepo = { findLast: jest.fn(), findHistory: jest.fn() };
const mockMensajeroRepo = { findById: jest.fn() };

describe('ConsultarUbicacionUseCase', () => {
  let useCase: ConsultarUbicacionUseCase;

  beforeEach(() => {
    useCase = new ConsultarUbicacionUseCase(mockLocationRepo as any, mockMensajeroRepo as any);
    jest.clearAllMocks();
  });

  describe('findLast', () => {
    it('returns last location', async () => {
      mockMensajeroRepo.findById.mockResolvedValue(makeCourier());
      mockLocationRepo.findLast.mockResolvedValue(makeLocation());

      const result = await useCase.findLast('c-1', 'co-1');
      expect(result.latitude).toBe(4.710989);
    });

    it('throws when courier not found', async () => {
      mockMensajeroRepo.findById.mockResolvedValue(null);
      await expect(useCase.findLast('c-1', 'co-1')).rejects.toThrow(NotFoundException);
    });

    it('throws when no location registered yet', async () => {
      mockMensajeroRepo.findById.mockResolvedValue(makeCourier());
      mockLocationRepo.findLast.mockResolvedValue(null);
      await expect(useCase.findLast('c-1', 'co-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findHistory', () => {
    it('returns location history', async () => {
      mockMensajeroRepo.findById.mockResolvedValue(makeCourier());
      mockLocationRepo.findHistory.mockResolvedValue([makeLocation(), makeLocation()]);

      const result = await useCase.findHistory('c-1', 'co-1');
      expect(result).toHaveLength(2);
    });

    it('passes date range and limit to repository', async () => {
      mockMensajeroRepo.findById.mockResolvedValue(makeCourier());
      mockLocationRepo.findHistory.mockResolvedValue([]);

      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');
      await useCase.findHistory('c-1', 'co-1', { from, to, limit: 50 });

      expect(mockLocationRepo.findHistory).toHaveBeenCalledWith('c-1', 'co-1', { from, to, limit: 50 });
    });

    it('throws when courier not found', async () => {
      mockMensajeroRepo.findById.mockResolvedValue(null);
      await expect(useCase.findHistory('c-1', 'co-1')).rejects.toThrow(NotFoundException);
    });

    it('is scoped to company — different company returns not found', async () => {
      mockMensajeroRepo.findById.mockResolvedValue(null);
      await expect(useCase.findHistory('c-1', 'other-company')).rejects.toThrow(NotFoundException);
      expect(mockLocationRepo.findHistory).not.toHaveBeenCalled();
    });
  });
});
