import * as fc from 'fast-check';
import { ReportesRepository } from '../src/modules/reportes/infrastructure/reportes.repository';
import { ReporteServiciosUseCase } from '../src/modules/reportes/application/use-cases/reporte-servicios.use-case';

// Feature: reportes-ampliados

describe('ReportesRepository.getFavoriteCustomersReport — Property Tests', () => {
  // Feature: reportes-ampliados, Property 5: solo clientes favoritos en el reporte
  // Validates: Requirements 3.2, 3.3
  it('Property 5: todos los elementos devueltos deben tener is_favorite = true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            customer_id: fc.uuid(),
            is_favorite: fc.boolean(),
            total_services: fc.nat({ max: 50 }),
            delivery_price: fc.float({ min: 0, max: 100_000, noNaN: true }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (customers) => {
          // Deduplicate customer_ids
          const seen = new Set<string>();
          const uniqueCustomers = customers.filter((c) => {
            if (seen.has(c.customer_id)) return false;
            seen.add(c.customer_id);
            return true;
          });

          // Only favorite customers are returned by Prisma because the query
          // filters by customer: { is_favorite: true }
          const favoriteCustomers = uniqueCustomers.filter((c) => c.is_favorite);

          // Query 1 mock: groupBy returns only favorite customers (Prisma filters them)
          const totalGroupByRows = favoriteCustomers.map((c) => ({
            customer_id: c.customer_id,
            _count: { id: c.total_services },
            _sum: { delivery_price: c.delivery_price },
          }));

          // Query 2 mock: paid rows (empty — not relevant for this property)
          const paidGroupByRows: Array<{
            customer_id: string;
            _count: { id: number };
            _sum: { delivery_price: number };
          }> = [];

          // Query 3 mock: customer.findMany returns only favorite customers
          const customerFindManyRows = favoriteCustomers.map((c) => ({
            id: c.customer_id,
            name: `Customer ${c.customer_id.slice(0, 8)}`,
          }));

          const mockPrisma = {
            service: {
              groupBy: jest
                .fn()
                // First call → total rows (Query 1, filtered to is_favorite=true by Prisma)
                .mockResolvedValueOnce(totalGroupByRows)
                // Second call → paid rows (Query 2)
                .mockResolvedValueOnce(paidGroupByRows),
            },
            customer: {
              findMany: jest.fn().mockResolvedValueOnce(customerFindManyRows),
            },
          };

          const repo = new ReportesRepository(mockPrisma as any);
          const result = await repo.getFavoriteCustomersReport('company-test');

          // Every returned customer_id must belong to a favorite customer
          for (const row of result) {
            const originalCustomer = uniqueCustomers.find(
              (c) => c.customer_id === row.customer_id,
            );
            // The customer must exist in our input and must be a favorite
            expect(originalCustomer).toBeDefined();
            expect(originalCustomer!.is_favorite).toBe(true);
          }

          // The result must not contain any non-favorite customer
          const nonFavoriteIds = new Set(
            uniqueCustomers
              .filter((c) => !c.is_favorite)
              .map((c) => c.customer_id),
          );
          for (const row of result) {
            expect(nonFavoriteIds.has(row.customer_id)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: reportes-ampliados, Property 7: invariante de montos por cliente
  // Validates: Requirements 3.11, 3.7, 3.8, 3.9
  it('Property 7: paid_amount + unpaid_amount = total_amount para cualquier cliente favorito', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            customer_id: fc.uuid(),
            // Services with mixed payment_status for this customer
            services: fc.array(
              fc.record({
                payment_status: fc.constantFrom('PAID', 'UNPAID'),
                delivery_price: fc.float({ min: 0, max: 100_000, noNaN: true }),
              }),
              { minLength: 0, maxLength: 20 },
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (customers) => {
          // Deduplicate customer_ids
          const seen = new Set<string>();
          const uniqueCustomers = customers.filter((c) => {
            if (seen.has(c.customer_id)) return false;
            seen.add(c.customer_id);
            return true;
          });

          // Only include customers that have at least one service
          const customersWithServices = uniqueCustomers.filter(
            (c) => c.services.length > 0,
          );

          if (customersWithServices.length === 0) return;

          // Compute expected amounts per customer
          const expectedMap = new Map<
            string,
            { total_amount: number; paid_amount: number; unpaid_amount: number }
          >();
          for (const c of customersWithServices) {
            const total_amount = c.services.reduce(
              (sum, s) => sum + s.delivery_price,
              0,
            );
            const paid_amount = c.services
              .filter((s) => s.payment_status === 'PAID')
              .reduce((sum, s) => sum + s.delivery_price, 0);
            const unpaid_amount = c.services
              .filter((s) => s.payment_status === 'UNPAID')
              .reduce((sum, s) => sum + s.delivery_price, 0);
            expectedMap.set(c.customer_id, {
              total_amount,
              paid_amount,
              unpaid_amount,
            });
          }

          // Query 1 mock: total rows (all services per customer)
          const totalGroupByRows = customersWithServices.map((c) => ({
            customer_id: c.customer_id,
            _count: { id: c.services.length },
            _sum: {
              delivery_price: c.services.reduce(
                (sum, s) => sum + s.delivery_price,
                0,
              ),
            },
          }));

          // Query 2 mock: paid rows (only PAID services)
          const paidGroupByRows = customersWithServices
            .map((c) => {
              const paidServices = c.services.filter(
                (s) => s.payment_status === 'PAID',
              );
              return {
                customer_id: c.customer_id,
                _count: { id: paidServices.length },
                _sum: {
                  delivery_price: paidServices.reduce(
                    (sum, s) => sum + s.delivery_price,
                    0,
                  ),
                },
              };
            })
            .filter((r) => r._count.id > 0); // groupBy omits customers with no PAID services

          // Query 3 mock: customer names
          const customerFindManyRows = customersWithServices.map((c) => ({
            id: c.customer_id,
            name: `Customer ${c.customer_id.slice(0, 8)}`,
          }));

          const mockPrisma = {
            service: {
              groupBy: jest
                .fn()
                // First call → total rows (Query 1)
                .mockResolvedValueOnce(totalGroupByRows)
                // Second call → paid rows (Query 2)
                .mockResolvedValueOnce(paidGroupByRows),
            },
            customer: {
              findMany: jest.fn().mockResolvedValueOnce(customerFindManyRows),
            },
          };

          const repo = new ReportesRepository(mockPrisma as any);
          const result = await repo.getFavoriteCustomersReport('company-test');

          // Verify the amount invariant for every row returned
          for (const row of result) {
            // paid_amount + unpaid_amount must equal total_amount
            expect(row.paid_amount + row.unpaid_amount).toBeCloseTo(
              row.total_amount,
              5,
            );

            // Also verify against expected values computed from raw services
            const expected = expectedMap.get(row.customer_id);
            if (expected) {
              expect(row.total_amount).toBeCloseTo(expected.total_amount, 5);
              expect(row.paid_amount).toBeCloseTo(expected.paid_amount, 5);
              expect(row.unpaid_amount).toBeCloseTo(expected.unpaid_amount, 5);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: reportes-ampliados, Property 8: filtrado temporal de servicios por cliente
  // Validates: Requirements 3.5
  it('Property 8: los totales deben reflejar únicamente servicios cuyo created_at cae dentro del Date_Range', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a date range [from, to]
        fc.tuple(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-06-30') }),
          fc.date({ min: new Date('2025-07-01'), max: new Date('2026-12-31') }),
        ),
        // Generate customers with services at various dates (inside and outside the range)
        fc.array(
          fc.record({
            customer_id: fc.uuid(),
            services: fc.array(
              fc.record({
                payment_status: fc.constantFrom('PAID', 'UNPAID'),
                delivery_price: fc.float({ min: 0, max: 100_000, noNaN: true }),
                // Whether this service falls inside the date range
                in_range: fc.boolean(),
              }),
              { minLength: 0, maxLength: 20 },
            ),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async ([from, to], customers) => {
          // Deduplicate customer_ids
          const seen = new Set<string>();
          const uniqueCustomers = customers.filter((c) => {
            if (seen.has(c.customer_id)) return false;
            seen.add(c.customer_id);
            return true;
          });

          // Only include customers that have at least one service inside the range
          const customersWithInRangeServices = uniqueCustomers.filter(
            (c) => c.services.some((s) => s.in_range),
          );

          if (customersWithInRangeServices.length === 0) return;

          // Compute expected values using ONLY in-range services
          const expectedMap = new Map<
            string,
            {
              total_services: number;
              total_amount: number;
              paid_services: number;
              paid_amount: number;
              unpaid_services: number;
              unpaid_amount: number;
            }
          >();

          for (const c of customersWithInRangeServices) {
            const inRangeServices = c.services.filter((s) => s.in_range);
            const total_services = inRangeServices.length;
            const total_amount = inRangeServices.reduce((sum, s) => sum + s.delivery_price, 0);
            const paidInRange = inRangeServices.filter((s) => s.payment_status === 'PAID');
            const paid_services = paidInRange.length;
            const paid_amount = paidInRange.reduce((sum, s) => sum + s.delivery_price, 0);
            const unpaid_services = total_services - paid_services;
            const unpaid_amount = total_amount - paid_amount;

            expectedMap.set(c.customer_id, {
              total_services,
              total_amount,
              paid_services,
              paid_amount,
              unpaid_services,
              unpaid_amount,
            });
          }

          // The mock simulates Prisma's date filter: only in-range services are returned.
          // Query 1 mock: total rows — only in-range services per customer
          const totalGroupByRows = customersWithInRangeServices.map((c) => {
            const inRangeServices = c.services.filter((s) => s.in_range);
            return {
              customer_id: c.customer_id,
              _count: { id: inRangeServices.length },
              _sum: {
                delivery_price: inRangeServices.reduce(
                  (sum, s) => sum + s.delivery_price,
                  0,
                ),
              },
            };
          });

          // Query 2 mock: paid rows — only in-range PAID services per customer
          const paidGroupByRows = customersWithInRangeServices
            .map((c) => {
              const inRangePaid = c.services.filter(
                (s) => s.in_range && s.payment_status === 'PAID',
              );
              return {
                customer_id: c.customer_id,
                _count: { id: inRangePaid.length },
                _sum: {
                  delivery_price: inRangePaid.reduce(
                    (sum, s) => sum + s.delivery_price,
                    0,
                  ),
                },
              };
            })
            .filter((r) => r._count.id > 0); // groupBy omits customers with no PAID in-range services

          // Query 3 mock: customer names
          const customerFindManyRows = customersWithInRangeServices.map((c) => ({
            id: c.customer_id,
            name: `Customer ${c.customer_id.slice(0, 8)}`,
          }));

          const mockPrisma = {
            service: {
              groupBy: jest
                .fn()
                // First call → total rows (Query 1, filtered by date range by Prisma)
                .mockResolvedValueOnce(totalGroupByRows)
                // Second call → paid rows (Query 2, filtered by date range by Prisma)
                .mockResolvedValueOnce(paidGroupByRows),
            },
            customer: {
              findMany: jest.fn().mockResolvedValueOnce(customerFindManyRows),
            },
          };

          const repo = new ReportesRepository(mockPrisma as any);
          const result = await repo.getFavoriteCustomersReport('company-test', from, to);

          // Verify that totals reflect ONLY in-range services
          for (const row of result) {
            const expected = expectedMap.get(row.customer_id);
            if (!expected) continue;

            expect(row.total_services).toBe(expected.total_services);
            expect(row.total_amount).toBeCloseTo(expected.total_amount, 5);
            expect(row.paid_services).toBe(expected.paid_services);
            expect(row.paid_amount).toBeCloseTo(expected.paid_amount, 5);
            expect(row.unpaid_services).toBe(expected.unpaid_services);
            expect(row.unpaid_amount).toBeCloseTo(expected.unpaid_amount, 5);
          }

          // Out-of-range services must NOT inflate the totals:
          // For each customer, the result must not include counts from out-of-range services
          for (const row of result) {
            const customer = uniqueCustomers.find((c) => c.customer_id === row.customer_id);
            if (!customer) continue;

            const outOfRangeCount = customer.services.filter((s) => !s.in_range).length;
            const inRangeCount = customer.services.filter((s) => s.in_range).length;

            // total_services must equal in-range count, not total count
            expect(row.total_services).toBe(inRangeCount);
            // If there are out-of-range services, total_services must be less than all services
            if (outOfRangeCount > 0) {
              expect(row.total_services).toBeLessThan(customer.services.length);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: reportes-ampliados, Property 6: invariante de servicios por cliente (conteo)
  // Validates: Requirements 3.10
  it('Property 6: paid_services + unpaid_services = total_services para cualquier cliente favorito', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            customer_id: fc.uuid(),
            total_services: fc.nat({ max: 50 }),
            paid_services: fc.nat({ max: 50 }),
            delivery_price: fc.float({ min: 0, max: 100_000, noNaN: true }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (customers) => {
          // Deduplicate customer_ids
          const seen = new Set<string>();
          const uniqueCustomers = customers.filter((c) => {
            if (seen.has(c.customer_id)) return false;
            seen.add(c.customer_id);
            return true;
          });

          // Normalise: paid_services cannot exceed total_services
          const normalisedCustomers = uniqueCustomers.map((c) => ({
            ...c,
            paid_services: Math.min(c.paid_services, c.total_services),
          }));

          // Query 1 mock: total rows (all services of favorite customers)
          const totalGroupByRows = normalisedCustomers.map((c) => ({
            customer_id: c.customer_id,
            _count: { id: c.total_services },
            _sum: { delivery_price: c.delivery_price },
          }));

          // Query 2 mock: paid rows
          const paidGroupByRows = normalisedCustomers.map((c) => ({
            customer_id: c.customer_id,
            _count: { id: c.paid_services },
            _sum: {
              delivery_price:
                c.total_services > 0
                  ? c.delivery_price * (c.paid_services / c.total_services)
                  : 0,
            },
          }));

          // Query 3 mock: customer names
          const customerFindManyRows = normalisedCustomers.map((c) => ({
            id: c.customer_id,
            name: `Customer ${c.customer_id.slice(0, 8)}`,
          }));

          const mockPrisma = {
            service: {
              groupBy: jest
                .fn()
                // First call → total rows (Query 1)
                .mockResolvedValueOnce(totalGroupByRows)
                // Second call → paid rows (Query 2)
                .mockResolvedValueOnce(paidGroupByRows),
            },
            customer: {
              findMany: jest.fn().mockResolvedValueOnce(customerFindManyRows),
            },
          };

          const repo = new ReportesRepository(mockPrisma as any);
          const result = await repo.getFavoriteCustomersReport('company-test');

          // Verify the invariant for every row returned
          for (const row of result) {
            expect(row.paid_services + row.unpaid_services).toBe(row.total_services);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});



describe('ReportesRepository.getCourierStats — Property Tests', () => {
  // Feature: reportes-ampliados, Property 1: invariante de liquidación por mensajero
  // Validates: Requirements 2.5, 1.5, 2.2, 2.3, 2.4
  it('Property 1: settled_services + unsettled_services = total_services para cualquier entrada generada', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            courier_id: fc.uuid(),
            total: fc.nat(),
            settled: fc.nat(),
          }),
        ),
        async (rows) => {
          // Normalise: settled cannot exceed total
          const normalisedRows = rows.map((r) => ({
            courier_id: r.courier_id,
            total: r.total,
            settled: Math.min(r.settled, r.total),
          }));

          // Build mock Prisma responses that mirror what getCourierStats queries
          const totalGroupByRows = normalisedRows.map((r) => ({
            courier_id: r.courier_id,
            _count: { id: r.total },
            _sum: { delivery_price: r.total * 10 }, // arbitrary amount
          }));

          const settledGroupByRows = normalisedRows.map((r) => ({
            courier_id: r.courier_id,
            _count: { id: r.settled },
            _sum: { delivery_price: r.settled * 10 },
          }));

          // No settlements in this test — company_earnings will be 0
          const settlementGroupByRows: Array<{
            courier_id: string;
            _sum: { total_earned: number };
          }> = [];

          // Courier name lookup
          const courierFindManyRows = normalisedRows.map((r) => ({
            id: r.courier_id,
            user: { name: `Courier ${r.courier_id.slice(0, 8)}` },
          }));

          // Mock PrismaService
          const mockPrisma = {
            service: {
              groupBy: jest
                .fn()
                // First call → total rows (Query 1)
                .mockResolvedValueOnce(totalGroupByRows)
                // Second call → settled rows (Query 2)
                .mockResolvedValueOnce(settledGroupByRows),
            },
            courierSettlement: {
              groupBy: jest.fn().mockResolvedValueOnce(settlementGroupByRows),
            },
            courier: {
              findMany: jest.fn().mockResolvedValueOnce(courierFindManyRows),
            },
          };

          const repo = new ReportesRepository(mockPrisma as any);
          const result = await repo.getCourierStats('company-test');

          // Verify the invariant for every row returned
          for (const row of result) {
            expect(row.settled_services + row.unsettled_services).toBe(
              row.total_services,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: reportes-ampliados, Property 3: fórmula de company_earnings
  // Validates: Requirements 1.3, 1.4
  it('Property 3: company_earnings = Σ(delivery_price de is_settled_courier=true) − Σ(total_earned de settlements)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            courier_id: fc.uuid(),
            settled_amount: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
            total_earned: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
            has_settlements: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (couriers) => {
          // Deduplicate courier_ids
          const seen = new Set<string>();
          const uniqueCouriers = couriers.filter((c) => {
            if (seen.has(c.courier_id)) return false;
            seen.add(c.courier_id);
            return true;
          });

          // Query 1 mock: total rows (DELIVERED) — use settled_amount as total for simplicity
          const totalGroupByRows = uniqueCouriers.map((c) => ({
            courier_id: c.courier_id,
            _count: { id: 5 },
            _sum: { delivery_price: c.settled_amount + 100 }, // total > settled
          }));

          // Query 2 mock: settled rows (DELIVERED + is_settled_courier=true)
          const settledGroupByRows = uniqueCouriers.map((c) => ({
            courier_id: c.courier_id,
            _count: { id: 3 },
            _sum: { delivery_price: c.settled_amount },
          }));

          // Query 3 mock: settlements — only include if has_settlements=true
          const settlementGroupByRows = uniqueCouriers
            .filter((c) => c.has_settlements)
            .map((c) => ({
              courier_id: c.courier_id,
              _sum: { total_earned: c.total_earned },
            }));

          // Courier name lookup
          const courierFindManyRows = uniqueCouriers.map((c) => ({
            id: c.courier_id,
            user: { name: `Courier ${c.courier_id.slice(0, 8)}` },
          }));

          const mockPrisma = {
            service: {
              groupBy: jest
                .fn()
                .mockResolvedValueOnce(totalGroupByRows)
                .mockResolvedValueOnce(settledGroupByRows),
            },
            courierSettlement: {
              groupBy: jest.fn().mockResolvedValueOnce(settlementGroupByRows),
            },
            courier: {
              findMany: jest.fn().mockResolvedValueOnce(courierFindManyRows),
            },
          };

          const repo = new ReportesRepository(mockPrisma as any);
          const result = await repo.getCourierStats('company-test');

          for (const row of result) {
            const courier = uniqueCouriers.find((c) => c.courier_id === row.courier_id)!;
            const expectedEarnings = courier.has_settlements
              ? courier.settled_amount - courier.total_earned
              : courier.settled_amount; // no settlements → total_earned = 0

            expect(row.company_earnings).toBeCloseTo(expectedEarnings, 5);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: reportes-ampliados, Property 3 (special case): when no settlements, company_earnings = 0
  // Validates: Requirements 1.4
  it('Property 3 (special case): cuando no hay settlements, company_earnings = settled_amount (total_earned = 0)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            courier_id: fc.uuid(),
            settled_amount: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (couriers) => {
          // Deduplicate courier_ids
          const seen = new Set<string>();
          const uniqueCouriers = couriers.filter((c) => {
            if (seen.has(c.courier_id)) return false;
            seen.add(c.courier_id);
            return true;
          });

          const totalGroupByRows = uniqueCouriers.map((c) => ({
            courier_id: c.courier_id,
            _count: { id: 5 },
            _sum: { delivery_price: c.settled_amount + 100 },
          }));

          const settledGroupByRows = uniqueCouriers.map((c) => ({
            courier_id: c.courier_id,
            _count: { id: 3 },
            _sum: { delivery_price: c.settled_amount },
          }));

          // No settlements at all
          const settlementGroupByRows: Array<{
            courier_id: string;
            _sum: { total_earned: number };
          }> = [];

          const courierFindManyRows = uniqueCouriers.map((c) => ({
            id: c.courier_id,
            user: { name: `Courier ${c.courier_id.slice(0, 8)}` },
          }));

          const mockPrisma = {
            service: {
              groupBy: jest
                .fn()
                .mockResolvedValueOnce(totalGroupByRows)
                .mockResolvedValueOnce(settledGroupByRows),
            },
            courierSettlement: {
              groupBy: jest.fn().mockResolvedValueOnce(settlementGroupByRows),
            },
            courier: {
              findMany: jest.fn().mockResolvedValueOnce(courierFindManyRows),
            },
          };

          const repo = new ReportesRepository(mockPrisma as any);
          const result = await repo.getCourierStats('company-test');

          for (const row of result) {
            const courier = uniqueCouriers.find((c) => c.courier_id === row.courier_id)!;
            // When no settlements: company_earnings = settled_amount - 0 = settled_amount
            expect(row.company_earnings).toBeCloseTo(courier.settled_amount, 5);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: reportes-ampliados, Property 2: total_amount solo incluye DELIVERED
  // Validates: Requirements 1.2
  it('Property 2: total_amount debe ser igual a la suma de delivery_price de servicios con status = DELIVERED', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            courier_id: fc.uuid(),
            // Services with mixed statuses for this courier
            services: fc.array(
              fc.record({
                status: fc.constantFrom(
                  'DELIVERED',
                  'CANCELLED',
                  'PENDING',
                  'ASSIGNED',
                  'IN_TRANSIT',
                ),
                delivery_price: fc.float({ min: 0, max: 100000, noNaN: true }),
              }),
              { minLength: 0, maxLength: 20 },
            ),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (couriers) => {
          // Deduplicate courier_ids (fc.uuid can theoretically repeat)
          const seen = new Set<string>();
          const uniqueCouriers = couriers.filter((c) => {
            if (seen.has(c.courier_id)) return false;
            seen.add(c.courier_id);
            return true;
          });

          // Compute expected total_amount per courier: sum of delivery_price for DELIVERED only
          const expectedAmountMap = new Map<string, number>();
          for (const c of uniqueCouriers) {
            const deliveredSum = c.services
              .filter((s) => s.status === 'DELIVERED')
              .reduce((sum, s) => sum + s.delivery_price, 0);
            expectedAmountMap.set(c.courier_id, deliveredSum);
          }

          // Query 1 mock: getCourierStats filters by status=DELIVERED, so it only
          // receives DELIVERED services in the groupBy result. We simulate this by
          // summing only DELIVERED services for each courier.
          const totalGroupByRows = uniqueCouriers
            .map((c) => {
              const deliveredServices = c.services.filter(
                (s) => s.status === 'DELIVERED',
              );
              return {
                courier_id: c.courier_id,
                _count: { id: deliveredServices.length },
                _sum: {
                  delivery_price: deliveredServices.reduce(
                    (sum, s) => sum + s.delivery_price,
                    0,
                  ),
                },
              };
            })
            .filter((r) => r._count.id > 0); // groupBy omits couriers with no DELIVERED

          // Query 2 mock: settled rows (empty — not relevant for this property)
          const settledGroupByRows: Array<{
            courier_id: string;
            _count: { id: number };
            _sum: { delivery_price: number };
          }> = [];

          // Query 3 mock: no settlements
          const settlementGroupByRows: Array<{
            courier_id: string;
            _sum: { total_earned: number };
          }> = [];

          // Courier name lookup
          const courierFindManyRows = totalGroupByRows.map((r) => ({
            id: r.courier_id,
            user: { name: `Courier ${r.courier_id.slice(0, 8)}` },
          }));

          const mockPrisma = {
            service: {
              groupBy: jest
                .fn()
                .mockResolvedValueOnce(totalGroupByRows)
                .mockResolvedValueOnce(settledGroupByRows),
            },
            courierSettlement: {
              groupBy: jest.fn().mockResolvedValueOnce(settlementGroupByRows),
            },
            courier: {
              findMany: jest.fn().mockResolvedValueOnce(courierFindManyRows),
            },
          };

          const repo = new ReportesRepository(mockPrisma as any);
          const result = await repo.getCourierStats('company-test');

          // Verify that total_amount for each returned row matches the sum of
          // delivery_price exclusively from DELIVERED services
          for (const row of result) {
            const expected = expectedAmountMap.get(row.courier_id) ?? 0;
            expect(row.total_amount).toBeCloseTo(expected, 5);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('ReporteServiciosUseCase — Property Tests', () => {
  // Feature: reportes-ampliados, Property 4: filtrado por courier_id
  // Validates: Requirements 1.6
  it('Property 4: la respuesta de GET /api/reports/services?courier_id=X debe contener exactamente un elemento en by_courier con courier_id = X', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a target courier_id and a list of couriers (including the target)
        fc.uuid(),
        fc.array(
          fc.record({
            courier_id: fc.uuid(),
            total_services: fc.nat({ max: 50 }),
            settled_services: fc.nat({ max: 50 }),
            total_amount: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
            company_earnings: fc.float({ min: -100_000, max: 100_000, noNaN: true }),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        async (targetCourierId, otherCouriers) => {
          // Deduplicate and ensure target courier is not in the list
          const seen = new Set<string>([targetCourierId]);
          const uniqueOtherCouriers = otherCouriers.filter((c) => {
            if (seen.has(c.courier_id)) return false;
            seen.add(c.courier_id);
            return true;
          });

          // The target courier stats row
          const targetCourierStats = {
            courier_id: targetCourierId,
            courier_name: `Courier ${targetCourierId.slice(0, 8)}`,
            total_services: 5,
            settled_services: 3,
            unsettled_services: 2,
            total_amount: 50_000,
            company_earnings: 10_000,
          };

          // When filtering by courier_id, getCourierStats returns only that courier
          const mockRepo = {
            countByStatus: jest.fn().mockResolvedValue([]),
            getCourierStats: jest.fn().mockResolvedValue([targetCourierStats]),
            avgDeliveryMinutes: jest.fn().mockResolvedValue(null),
            cancellationRate: jest.fn().mockResolvedValue({ total: 0, cancelled: 0, rate: 0 }),
          };

          const useCase = new ReporteServiciosUseCase(mockRepo as unknown as ReportesRepository, { get: () => null, set: () => {} } as any);
          const result = await useCase.execute(
            { courier_id: targetCourierId },
            'company-test',
          );

          // by_courier must contain exactly one element
          expect(result!.by_courier).toHaveLength(1);

          // That element must have courier_id = targetCourierId
          expect(result!.by_courier[0].courier_id).toBe(targetCourierId);

          // Verify getCourierStats was called with the correct courier_id
          expect(mockRepo.getCourierStats).toHaveBeenCalledWith(
            'company-test',
            undefined,
            undefined,
            targetCourierId,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 4 (all 7 fields): by_courier includes all 7 required fields for each courier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            courier_id: fc.uuid(),
            courier_name: fc.string({ minLength: 1, maxLength: 50 }),
            total_services: fc.nat({ max: 100 }),
            settled_services: fc.nat({ max: 100 }),
            unsettled_services: fc.nat({ max: 100 }),
            total_amount: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
            company_earnings: fc.float({ min: -100_000, max: 100_000, noNaN: true }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (courierStats) => {
          // Deduplicate courier_ids
          const seen = new Set<string>();
          const uniqueStats = courierStats.filter((c) => {
            if (seen.has(c.courier_id)) return false;
            seen.add(c.courier_id);
            return true;
          });

          const mockRepo = {
            countByStatus: jest.fn().mockResolvedValue([]),
            getCourierStats: jest.fn().mockResolvedValue(uniqueStats),
            avgDeliveryMinutes: jest.fn().mockResolvedValue(null),
            cancellationRate: jest.fn().mockResolvedValue({ total: 0, cancelled: 0, rate: 0 }),
          };

          const useCase = new ReporteServiciosUseCase(mockRepo as unknown as ReportesRepository, { get: () => null, set: () => {} } as any);
          const result = await useCase.execute({}, 'company-test');

          expect(result!.by_courier).toHaveLength(uniqueStats.length);

          for (let i = 0; i < result!.by_courier.length; i++) {
            const row = result!.by_courier[i];
            const expected = uniqueStats[i];

            // All 7 fields must be present
            expect(row).toHaveProperty('courier_id', expected.courier_id);
            expect(row).toHaveProperty('courier_name', expected.courier_name);
            expect(row).toHaveProperty('total_services', expected.total_services);
            expect(row).toHaveProperty('settled_services', expected.settled_services);
            expect(row).toHaveProperty('unsettled_services', expected.unsettled_services);
            expect(row).toHaveProperty('total_amount', expected.total_amount);
            expect(row).toHaveProperty('company_earnings', expected.company_earnings);

            // courier_earnings must NOT be present (Requirement 1.7)
            expect(row).not.toHaveProperty('courier_earnings');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
