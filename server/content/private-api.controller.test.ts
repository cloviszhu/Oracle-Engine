import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  APP_ORIGIN,
  AUTH_SERVICE,
  CONTENT_SERVICE,
  FEEDBACK_SERVICE,
  OPERATIONS_SERVICE,
  FamilyAuthGuard,
  PrivateApiController,
} from './private-api.controller.js';

describe('private API negative boundaries', () => {
  it('rejects unauthenticated access, unsafe filters, missing CSRF and forged feedback actors', async () => {
    const auth = {
      authenticate: async (cookie: string) => {
        if (cookie !== 'valid') throw new Error('invalid_session');
        return { actorId: 'father' };
      },
      authorizeStateChange: async (input: { cookieValue: string; csrfToken: string }) => {
        if (input.cookieValue !== 'valid' || input.csrfToken !== 'csrf') throw new Error('csrf');
        return { actorId: 'father' };
      },
      login: async () => ({ actorId: 'father', csrfToken: 'csrf', expiresAt: 'later', sessionCookie: 'serenity_session=valid; HttpOnly' }),
      logout: async () => undefined,
    };
    const content = {
      list: async (query: unknown) => ({ query, items: [] }),
      detail: async () => ({ id: 'content-1', rawPayload: { token: 'canary-secret' } }),
    };
    const feedback = { submit: async () => ({ id: 'feedback-1' }) };
    const operations = { status: async () => ({}), retry: async () => ({}) };

    @Module({
      controllers: [PrivateApiController],
      providers: [
        { provide: AUTH_SERVICE, useValue: auth },
        { provide: CONTENT_SERVICE, useValue: content },
        { provide: FEEDBACK_SERVICE, useValue: feedback },
        { provide: OPERATIONS_SERVICE, useValue: operations },
        { provide: APP_ORIGIN, useValue: 'https://serenity.example' },
        { provide: APP_GUARD, useClass: FamilyAuthGuard },
      ],
    })
    class TestModule {}

    const module = await Test.createTestingModule({ imports: [TestModule] }).compile();
    const app = module.createNestApplication();
    await app.init();
    const http = app.getHttpServer();

    await request(http).get('/api/content').expect(401);
    await request(http).get('/api/content?sort=raw_payload').set('Cookie', 'serenity_session=valid').expect(400);
    await request(http).post('/api/feedback').set('Cookie', 'serenity_session=valid').send({
      cardId: 'card-1', cardVersion: 1, type: 'known',
    }).expect(403);
    await request(http).post('/api/feedback')
      .set('Cookie', 'serenity_session=valid')
      .set('Origin', 'https://serenity.example')
      .set('x-csrf-token', 'csrf')
      .send({ cardId: 'card-1', cardVersion: 1, type: 'known', actorId: 'requester' })
      .expect(400);
    const detail = await request(http).get('/api/content/content-1')
      .set('Cookie', 'serenity_session=valid').expect(200);
    expect(JSON.stringify(detail.body)).not.toContain('canary-secret');

    await app.close();
  });
});
