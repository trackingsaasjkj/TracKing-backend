import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FcmBatchResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase no configurado — las notificaciones push están deshabilitadas. ' +
        'Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en .env',
      );
      return;
    }

    // Evitar inicializar múltiples veces (hot reload en dev)
    if (admin.apps.length > 0) {
      this.app = admin.apps[0]!;
      return;
    }

    this.app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // Las private keys en .env tienen \n como literal — hay que convertirlos
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });

    this.logger.log('Firebase Admin SDK inicializado correctamente');
  }

  get isConfigured(): boolean {
    return this.app !== null;
  }

  /**
   * Envía una notificación a un único dispositivo.
   */
  async sendToDevice(message: FcmMessage): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.warn('[FCM] Firebase no configurado, notificación omitida');
      return false;
    }

    try {
      await admin.messaging(this.app!).send({
        token: message.token,
        notification: { title: message.title, body: message.body },
        data: message.data ?? {},
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'tracking_notifications' },
        },
      });
      return true;
    } catch (error: any) {
      this.logger.error(`[FCM] Error enviando notificación: ${error.message}`);
      return false;
    }
  }

  /**
   * Envía notificaciones a múltiples dispositivos en batch (máx 500 por llamada FCM).
   */
  async sendToMultipleDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<FcmBatchResult> {
    if (!this.isConfigured || tokens.length === 0) {
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }

    const BATCH_SIZE = 500;
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    // Procesar en lotes de 500
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const messages: admin.messaging.Message[] = batch.map((token) => ({
        token,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: 'high' as const,
          notification: { sound: 'default', channelId: 'tracking_notifications' },
        },
      }));

      try {
        const response = await admin.messaging(this.app!).sendEach(messages);
        successCount += response.successCount;
        failureCount += response.failureCount;

        // Identificar tokens inválidos para limpiarlos de la BD
        response.responses.forEach((res, idx) => {
          if (!res.success && this.isInvalidTokenError(res.error?.code)) {
            invalidTokens.push(batch[idx]);
          }
        });
      } catch (error: any) {
        this.logger.error(`[FCM] Error en batch: ${error.message}`);
        failureCount += batch.length;
      }
    }

    return { successCount, failureCount, invalidTokens };
  }

  private isInvalidTokenError(code?: string): boolean {
    return [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ].includes(code ?? '');
  }
}
