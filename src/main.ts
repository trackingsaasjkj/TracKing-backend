import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import * as express from 'express';
import { AppModule } from './app.module';

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TracKing API — Acceso</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f1117;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #e2e8f0;
    }
    .bg-grid {
      position: fixed; inset: 0;
      background-image:
        linear-gradient(rgba(99,102,241,.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99,102,241,.06) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }
    .glow {
      position: fixed; width: 600px; height: 600px; border-radius: 50%;
      background: radial-gradient(circle, rgba(99,102,241,.15) 0%, transparent 70%);
      top: -150px; left: -150px; pointer-events: none;
    }
    .card {
      position: relative; width: 100%; max-width: 420px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 20px; padding: 48px 40px 40px;
      backdrop-filter: blur(12px);
      box-shadow: 0 25px 60px rgba(0,0,0,.5);
    }
    .logo-wrap { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
    .logo-icon {
      width: 44px; height: 44px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 12px; display: flex; align-items: center;
      justify-content: center; font-size: 22px; flex-shrink: 0;
    }
    .logo-text h1 { font-size: 20px; font-weight: 700; color: #f1f5f9; letter-spacing: -.3px; }
    .logo-text p { font-size: 12px; color: #64748b; margin-top: 1px; }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(99,102,241,.15); border: 1px solid rgba(99,102,241,.3);
      color: #a5b4fc; font-size: 11px; font-weight: 600;
      padding: 4px 10px; border-radius: 20px; margin-bottom: 24px;
      letter-spacing: .5px; text-transform: uppercase;
    }
    .badge::before {
      content: ''; width: 6px; height: 6px; border-radius: 50%;
      background: #6366f1; animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
    h2 { font-size: 24px; font-weight: 700; color: #f1f5f9; margin-bottom: 6px; }
    .subtitle { font-size: 14px; color: #64748b; margin-bottom: 32px; }
    .field { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 500; color: #94a3b8; margin-bottom: 8px; }
    .input-wrap { position: relative; }
    .input-icon {
      position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
      color: #475569; font-size: 16px; pointer-events: none;
    }
    input {
      width: 100%; padding: 12px 14px 12px 42px;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px; color: #f1f5f9; font-size: 14px; outline: none;
      transition: border-color .2s, box-shadow .2s;
    }
    input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.2); }
    input::placeholder { color: #475569; }
    .toggle-pw {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      background: none; border: none; color: #475569; cursor: pointer;
      font-size: 16px; padding: 0; line-height: 1; transition: color .2s;
    }
    .toggle-pw:hover { color: #94a3b8; }
    .error-msg {
      display: none; align-items: center; gap: 8px;
      background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3);
      color: #fca5a5; font-size: 13px; padding: 10px 14px;
      border-radius: 8px; margin-bottom: 18px;
    }
    .error-msg.show { display: flex; }
    button[type="submit"] {
      width: 100%; padding: 13px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none; border-radius: 10px; color: #fff;
      font-size: 15px; font-weight: 600; cursor: pointer;
      transition: opacity .2s, transform .1s; margin-top: 8px;
    }
    button[type="submit"]:hover { opacity: .9; }
    button[type="submit"]:active { transform: scale(.98); }
    button[type="submit"]:disabled { opacity: .5; cursor: not-allowed; }
    .spinner {
      display: none; width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,.3); border-top-color: #fff;
      border-radius: 50%; animation: spin .7s linear infinite; margin: 0 auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .footer {
      margin-top: 28px; padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,.06);
      text-align: center; font-size: 12px; color: #334155;
    }
  </style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="glow"></div>
  <div class="card">
    <div class="logo-wrap">
      <div class="logo-icon">🚚</div>
      <div class="logo-text">
        <h1>TracKing</h1>
        <p>Plataforma de mensajería</p>
      </div>
    </div>
    <div class="badge">API Docs</div>
    <h2>Acceso restringido</h2>
    <p class="subtitle">Ingresa tus credenciales para acceder a la documentación.</p>
    <div class="error-msg" id="errorMsg">
      <span>⚠</span><span id="errorText">Credenciales incorrectas.</span>
    </div>
    <form id="loginForm">
      <div class="field">
        <label for="username">Usuario</label>
        <div class="input-wrap">
          <span class="input-icon">👤</span>
          <input type="text" id="username" name="username" placeholder="Nombre de usuario" autocomplete="username" required />
        </div>
      </div>
      <div class="field">
        <label for="password">Contraseña</label>
        <div class="input-wrap">
          <span class="input-icon">🔒</span>
          <input type="password" id="password" name="password" placeholder="••••••••" autocomplete="current-password" required />
          <button type="button" class="toggle-pw" id="togglePw" aria-label="Mostrar contraseña">👁</button>
        </div>
      </div>
      <button type="submit" id="submitBtn">
        <span id="btnText">Ingresar a la documentación</span>
        <div class="spinner" id="spinner"></div>
      </button>
    </form>
    <div class="footer">TracKing SaaS &copy; 2026 — Solo personal autorizado</div>
  </div>
  <script>
    const form = document.getElementById('loginForm');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('spinner');
    const togglePw = document.getElementById('togglePw');
    const pwInput = document.getElementById('password');
    togglePw.addEventListener('click', () => {
      const isText = pwInput.type === 'text';
      pwInput.type = isText ? 'password' : 'text';
      togglePw.textContent = isText ? '👁' : '🙈';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.classList.remove('show');
      btnText.style.display = 'none';
      spinner.style.display = 'block';
      submitBtn.disabled = true;
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/docs/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (res.ok) {
          window.location.href = '/api/docs';
        } else {
          const data = await res.json().catch(() => ({}));
          errorText.textContent = data.message || 'Credenciales incorrectas.';
          errorMsg.classList.add('show');
        }
      } catch {
        errorText.textContent = 'Error de conexión. Intenta de nuevo.';
        errorMsg.classList.add('show');
      } finally {
        btnText.style.display = 'block';
        spinner.style.display = 'none';
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error', 'debug'] });

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3001',
      'https://tracking-xi-seven.vercel.app',
    ],
    credentials: true,
  });

  app.use(cookieParser());
  app.use(express.json());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger Auth / Visibility ──────────────────────────────────
  const swaggerEnabled = process.env.SWAGGER_ENABLED;
  const swaggerUser = process.env.SWAGGER_USER;
  const swaggerPassword = process.env.SWAGGER_PASSWORD;
  // Simple in-memory session store (tokens válidos por 8 horas)
  const SESSION_COOKIE = 'swagger_session';
  const SESSION_TTL = 8 * 60 * 60 * 1000;
  const sessions = new Map<string, number>(); // token → expiry timestamp

  function isValidSession(token: string): boolean {
    const expiry = sessions.get(token);
    if (!expiry) return false;
    if (Date.now() > expiry) { sessions.delete(token); return false; }
    return true;
  }

  if (swaggerEnabled === 'false') {
    app.use('/api/docs', (_req: any, res: any) => res.status(404).send('Not Found'));
  } else {
    // GET /api/docs/login — página de login
    app.use('/api/docs/login', (req: any, res: any) => {
      if (req.method !== 'GET') return res.status(405).end();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(LOGIN_HTML);
    });

    // POST /api/docs/auth — valida credenciales y setea cookie
    app.use('/api/docs/auth', (req: any, res: any) => {
      if (req.method !== 'POST') return res.status(405).end();
      const { username, password } = req.body ?? {};
      if (username === swaggerUser && password === swaggerPassword) {
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, Date.now() + SESSION_TTL);
        res.cookie(SESSION_COOKIE, token, {
          httpOnly: true,
          sameSite: 'strict',
          maxAge: SESSION_TTL,
          secure: process.env.NODE_ENV === 'production',
        });
        return res.json({ ok: true });
      }
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    });

    // GET /api/docs/logout — limpia la cookie y redirige al login
    app.use('/api/docs/logout', (req: any, res: any) => {
      const token = req.cookies?.[SESSION_COOKIE];
      if (token) sessions.delete(token);
      res.clearCookie(SESSION_COOKIE);
      res.redirect('/api/docs/login');
    });

    // Middleware de protección para todo /api/docs
    app.use('/api/docs', (req: any, res: any, next: any) => {
      // Permitir pasar los sub-recursos estáticos de Swagger (js, css, etc.)
      const isAsset = /\.(js|css|png|ico|json)(\?.*)?$/.test(req.path);
      if (isAsset) return next();

      const token = req.cookies?.[SESSION_COOKIE];
      if (token && isValidSession(token)) return next();

      res.redirect('/api/docs/login');
    });

    // ── Swagger ────────────────────────────────────────────────────
    const config = new DocumentBuilder()
      .setTitle('Mensajería API')
      .setDescription(
        'Backend multi-tenant para gestión de servicios de mensajería y logística.\n\n' +
        '**Autenticación:** Usa `POST /api/auth/login` para obtener el token, ' +
        'luego haz clic en **Authorize** e ingresa `Bearer <token>`.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .addCookieAuth('access_token')
      .addTag('Auth', 'Autenticación y gestión de sesión')
      .addTag('Companies', 'Gestión de empresas (tenants)')
      .addTag('Users', 'Gestión de usuarios por empresa')
      .addTag('Customers', 'Gestión de clientes')
      .addTag('Mensajeros', 'Gestión de mensajeros y jornadas')
      .addTag('Courier Mobile', 'API móvil del mensajero')
      .addTag('Services', 'Ciclo de vida de servicios de entrega')
      .addTag('Evidence', 'Evidencias de entrega')
      .addTag('Tracking', 'Geolocalización de mensajeros en tiempo real')
      .addTag('Liquidaciones', 'Liquidaciones de mensajeros y facturación de clientes')
      .addTag('Suscripción', 'Suscripción activa de la empresa')
      .addTag('Super Admin', 'Control centralizado del sistema')
      .addTag('Super Admin — Planes', 'Gestión de planes de suscripción')
      .addTag('Super Admin — Suscripciones', 'Gestión de suscripciones de empresas')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customJs: `
        window.addEventListener('load', function() {
          // Inyectar botón de logout en la barra de Swagger
          function injectLogout() {
            const topbar = document.querySelector('.topbar-wrapper');
            if (!topbar || document.getElementById('swagger-logout-btn')) return;
            const btn = document.createElement('button');
            btn.id = 'swagger-logout-btn';
            btn.textContent = '⏻  Cerrar sesión';
            btn.style.cssText = [
              'margin-left:auto',
              'padding:8px 18px',
              'background:rgba(239,68,68,.15)',
              'border:1px solid rgba(239,68,68,.4)',
              'border-radius:8px',
              'color:#fca5a5',
              'font-size:13px',
              'font-weight:600',
              'cursor:pointer',
              'transition:background .2s',
              'white-space:nowrap',
            ].join(';');
            btn.onmouseover = () => btn.style.background = 'rgba(239,68,68,.28)';
            btn.onmouseout  = () => btn.style.background = 'rgba(239,68,68,.15)';
            btn.onclick = () => window.location.href = '/api/docs/logout';
            topbar.style.display = 'flex';
            topbar.style.alignItems = 'center';
            topbar.appendChild(btn);
          }
          // Reintentar hasta que el DOM de Swagger esté listo
          const iv = setInterval(() => {
            if (document.querySelector('.topbar-wrapper')) { injectLogout(); clearInterval(iv); }
          }, 200);
        });
      `,
    });
    // ──────────────────────────────────────────────────────────────
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Server running on port ${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
