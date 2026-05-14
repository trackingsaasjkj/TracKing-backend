import { Test, TestingModule } from '@nestjs/testing';
import { UserAddressHistoryService } from './user-address-history.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SearchBoxSuggestion } from '../search-provider.interface';

const mockSuggestion: SearchBoxSuggestion = {
  name: 'Cra 27 #48-10',
  place_name: 'Cra 27 #48-10, Bucaramanga, Colombia',
  center: [-73.122742, 7.119349],
  place_type: ['place'],
  context: {
    place: { name: 'Bucaramanga' },
    country: { name: 'Colombia' },
  },
};

const mockHistoryRecord = {
  id: 'hist-1',
  user_id: 'user-1',
  company_id: 'company-1',
  address: 'Cra 27 #48-10, Bucaramanga, Colombia',
  place_id: 'place-abc',
  lat: 7.119349,
  lng: -73.122742,
  main_text: 'Cra 27 #48-10',
  secondary_text: 'Bucaramanga',
  used_count: 3,
  last_used_at: new Date(),
  created_at: new Date(),
};

describe('UserAddressHistoryService', () => {
  let service: UserAddressHistoryService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAddressHistoryService,
        {
          provide: PrismaService,
          useValue: {
            userAddressHistory: {
              findMany: jest.fn(),
              upsert: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UserAddressHistoryService>(UserAddressHistoryService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHistory', () => {
    it('should return mapped suggestions from history records', async () => {
      (prisma.userAddressHistory.findMany as jest.Mock).mockResolvedValue([mockHistoryRecord]);

      const result = await service.getHistory('user-1', 'company-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Cra 27 #48-10');
      expect(result[0].place_name).toBe('Cra 27 #48-10, Bucaramanga, Colombia');
      expect(result[0].center).toEqual([-73.122742, 7.119349]);
    });

    it('should query with correct filters and ordering', async () => {
      (prisma.userAddressHistory.findMany as jest.Mock).mockResolvedValue([]);

      await service.getHistory('user-1', 'company-1', 5);

      expect(prisma.userAddressHistory.findMany).toHaveBeenCalledWith({
        where: { user_id: 'user-1', company_id: 'company-1' },
        take: 5,
        orderBy: [{ last_used_at: 'desc' }, { used_count: 'desc' }],
      });
    });

    it('should return empty array on error', async () => {
      (prisma.userAddressHistory.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await service.getHistory('user-1', 'company-1');

      expect(result).toEqual([]);
    });

    it('should use main_text as name when available', async () => {
      (prisma.userAddressHistory.findMany as jest.Mock).mockResolvedValue([mockHistoryRecord]);

      const result = await service.getHistory('user-1', 'company-1');

      expect(result[0].name).toBe('Cra 27 #48-10');
    });

    it('should fall back to address when main_text is null', async () => {
      const recordWithoutMainText = { ...mockHistoryRecord, main_text: null };
      (prisma.userAddressHistory.findMany as jest.Mock).mockResolvedValue([recordWithoutMainText]);

      const result = await service.getHistory('user-1', 'company-1');

      expect(result[0].name).toBe('Cra 27 #48-10, Bucaramanga, Colombia');
    });
  });

  describe('recordAddress', () => {
    it('should upsert address with correct data', async () => {
      (prisma.userAddressHistory.upsert as jest.Mock).mockResolvedValue(mockHistoryRecord);

      await service.recordAddress('user-1', 'company-1', mockSuggestion);

      expect(prisma.userAddressHistory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id_company_id_address: {
              user_id: 'user-1',
              company_id: 'company-1',
              address: mockSuggestion.place_name,
            },
          },
          update: expect.objectContaining({ used_count: { increment: 1 } }),
          create: expect.objectContaining({
            user_id: 'user-1',
            company_id: 'company-1',
            address: mockSuggestion.place_name,
            lat: mockSuggestion.center[1],
            lng: mockSuggestion.center[0],
            main_text: mockSuggestion.name,
          }),
        }),
      );
    });

    it('should not throw on DB error', async () => {
      (prisma.userAddressHistory.upsert as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.recordAddress('user-1', 'company-1', mockSuggestion)).resolves.not.toThrow();
    });

    it('should use place_id from suggestion when available', async () => {
      const suggestionWithPlaceId = { ...mockSuggestion, place_id: 'ChIJabc123' } as any;
      (prisma.userAddressHistory.upsert as jest.Mock).mockResolvedValue(mockHistoryRecord);

      await service.recordAddress('user-1', 'company-1', suggestionWithPlaceId);

      expect(prisma.userAddressHistory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ place_id: 'ChIJabc123' }),
        }),
      );
    });
  });

  describe('deleteAddress', () => {
    it('should delete address with correct key', async () => {
      (prisma.userAddressHistory.delete as jest.Mock).mockResolvedValue(mockHistoryRecord);

      await service.deleteAddress('user-1', 'company-1', 'Cra 27 #48-10, Bucaramanga, Colombia');

      expect(prisma.userAddressHistory.delete).toHaveBeenCalledWith({
        where: {
          user_id_company_id_address: {
            user_id: 'user-1',
            company_id: 'company-1',
            address: 'Cra 27 #48-10, Bucaramanga, Colombia',
          },
        },
      });
    });

    it('should not throw on DB error', async () => {
      (prisma.userAddressHistory.delete as jest.Mock).mockRejectedValue(new Error('Not found'));

      await expect(service.deleteAddress('user-1', 'company-1', 'addr')).resolves.not.toThrow();
    });
  });

  describe('cleanupOldAddresses', () => {
    it('should delete addresses beyond limit for specific user', async () => {
      const oldRecords = [{ id: 'old-1' }, { id: 'old-2' }];
      (prisma.userAddressHistory.findMany as jest.Mock).mockResolvedValue(oldRecords);
      (prisma.userAddressHistory.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      await service.cleanupOldAddresses('user-1');

      expect(prisma.userAddressHistory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['old-1', 'old-2'] } },
      });
    });

    it('should skip deleteMany when no old records found', async () => {
      (prisma.userAddressHistory.findMany as jest.Mock).mockResolvedValue([]);

      await service.cleanupOldAddresses('user-1');

      expect(prisma.userAddressHistory.deleteMany).not.toHaveBeenCalled();
    });

    it('should delete records older than 90 days when no userId provided', async () => {
      (prisma.userAddressHistory.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      await service.cleanupOldAddresses();

      expect(prisma.userAddressHistory.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            last_used_at: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should not throw on DB error', async () => {
      (prisma.userAddressHistory.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.cleanupOldAddresses('user-1')).resolves.not.toThrow();
    });
  });
});
