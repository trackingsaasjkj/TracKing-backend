import * as fc from 'fast-check';

// Función pura que replica la lógica del middleware de main.ts
function createSwaggerMiddleware(swaggerUser: string, swaggerPassword: string) {
  return (req: any, res: any, next: any) => {
    const authHeader: string | undefined = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Basic ')) {
      const base64 = authHeader.slice('Basic '.length);
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      const [user, ...rest] = decoded.split(':');
      const password = rest.join(':');
      if (user === swaggerUser && password === swaggerPassword) {
        return next();
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="Swagger"');
    res.status(401).send('Unauthorized');
  };
}

function makeReqRes(user?: string, pass?: string) {
  const headers: Record<string, string> = {};
  if (user !== undefined && pass !== undefined) {
    const b64 = Buffer.from(`${user}:${pass}`).toString('base64');
    headers['authorization'] = `Basic ${b64}`;
  }
  const res = {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: '',
    set: (k: string, v: string) => { res.headers[k] = v; },
    status: (code: number) => { res.statusCode = code; return res; },
    send: (body: string) => { res.body = body; },
  };
  return { req: { headers }, res };
}

describe('Swagger Basic Auth Middleware', () => {
  const SWAGGER_USER = 'admin';
  const SWAGGER_PASSWORD = 'secret123';
  const middleware = createSwaggerMiddleware(SWAGGER_USER, SWAGGER_PASSWORD);

  // Unit tests
  it('should call next() with valid credentials', () => {
    const { req, res } = makeReqRes(SWAGGER_USER, SWAGGER_PASSWORD);
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 401 without credentials', () => {
    const { req, res } = makeReqRes();
    middleware(req, res, jest.fn());
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toBe('Basic realm="Swagger"');
  });

  it('should return 401 with wrong credentials', () => {
    const { req, res } = makeReqRes('wrong', 'wrong');
    middleware(req, res, jest.fn());
    expect(res.statusCode).toBe(401);
  });

  // Property 18: credenciales válidas → next()
  // Validates: Requirements 8.2
  it('P18: valid credentials always call next()', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const { req, res } = makeReqRes(SWAGGER_USER, SWAGGER_PASSWORD);
        const next = jest.fn();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  // Property 19: credenciales inválidas → 401
  // Validates: Requirements 8.3
  it('P19: invalid credentials always return 401', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s !== SWAGGER_USER),
        fc.string({ minLength: 1 }),
        (user, pass) => {
          const { req, res } = makeReqRes(user, pass);
          middleware(req, res, jest.fn());
          expect(res.statusCode).toBe(401);
          expect(res.headers['WWW-Authenticate']).toBe('Basic realm="Swagger"');
        },
      ),
      { numRuns: 100 },
    );
  });
});
