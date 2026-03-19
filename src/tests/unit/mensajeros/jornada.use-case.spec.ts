import { JornadaUseCase } from '../../../modules/mensajeros/application/use-cases/jornada.use-case';
import { AppException } from '../../../core/errors/app.exception';
import { NotFoundException } from '@nestjs/common';

const makeCourier = (status: string) => ({
  id: 'c-1', company_id: 'co-1', operational_status: status,
});

const mockRepo = {
  findById: jest.fn(),
  updateStatus: jest.fn().mockResolvedValue({}),
  countActiveServices: jest.fn(),
};

describe('JornadaUseCase', () => {
  let useCase: JornadaUseCase;

  beforeEach(() => {
    useCase = new JornadaUseCase(mockRepo as any);
    jest.clearAllMocks();
    mockRepo.updateStatus.mockResolvedValue({});
  });

  describe('iniciar', () => {
    it('transitions UNAVAILABLE → AVAILABLE', async () => {
      mockRepo.findById
        .mockResolvedValueOnce(makeCourier('UNAVAILABLE'))
        .mockResolvedValueOnce(makeCourier('AVAILABLE'));
      const result = await useCase.iniciar('c-1', 'co-1');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith('c-1', 'co-1', 'AVAILABLE');
      expect(result.operational_status).toBe('AVAILABLE');
    });

    it('throws when courier not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(useCase.iniciar('c-1', 'co-1')).rejects.toThrow(NotFoundException);
    });

    it('throws when already AVAILABLE', async () => {
      mockRepo.findById.mockResolvedValue(makeCourier('AVAILABLE'));
      await expect(useCase.iniciar('c-1', 'co-1')).rejects.toThrow(AppException);
    });
  });

  describe('finalizar', () => {
    it('transitions AVAILABLE → UNAVAILABLE with no active services', async () => {
      mockRepo.findById
        .mockResolvedValueOnce(makeCourier('AVAILABLE'))
        .mockResolvedValueOnce(makeCourier('UNAVAILABLE'));
      mockRepo.countActiveServices.mockResolvedValue(0);
      await useCase.finalizar('c-1', 'co-1');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith('c-1', 'co-1', 'UNAVAILABLE');
    });

    it('throws when courier has active services', async () => {
      mockRepo.findById.mockResolvedValue(makeCourier('AVAILABLE'));
      mockRepo.countActiveServices.mockResolvedValue(1);
      await expect(useCase.finalizar('c-1', 'co-1')).rejects.toThrow(AppException);
    });

    it('throws when IN_SERVICE (must finish service first)', async () => {
      mockRepo.findById.mockResolvedValue(makeCourier('IN_SERVICE'));
      mockRepo.countActiveServices.mockResolvedValue(1);
      await expect(useCase.finalizar('c-1', 'co-1')).rejects.toThrow(AppException);
    });
  });
});
