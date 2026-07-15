import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  Res,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { clearSessionCookie } from '../auth/family-auth.service.js';
import { parseContentQuery, sanitizeContentDetail } from './content-query.js';

export const AUTH_SERVICE = Symbol('AUTH_SERVICE');
export const CONTENT_SERVICE = Symbol('CONTENT_SERVICE');
export const FEEDBACK_SERVICE = Symbol('FEEDBACK_SERVICE');
export const OPERATIONS_SERVICE = Symbol('OPERATIONS_SERVICE');
export const APP_ORIGIN = Symbol('APP_ORIGIN');
const IS_PUBLIC = Symbol('IS_PUBLIC');
const Public = () => SetMetadata(IS_PUBLIC, true);

interface AuthApi {
  login(username: string, password: string, ipAddress: string): Promise<{
    actorId: string; csrfToken: string; expiresAt: string; sessionCookie: string;
  }>;
  authenticate(cookieValue: string): Promise<{ actorId: string }>;
  authorizeStateChange(input: {
    cookieValue: string; csrfToken: string; origin: string; expectedOrigin: string;
  }): Promise<{ actorId: string }>;
  logout(cookieValue: string): Promise<void>;
}

type AuthenticatedRequest = Request & { actorId?: string };

@Injectable()
export class FamilyAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH_SERVICE) private readonly auth: AuthApi,
    @Inject(APP_ORIGIN) private readonly appOrigin: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(), context.getClass(),
    ])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.path === '/api/health') return true;
    const cookieValue = readCookie(request.headers.cookie, 'serenity_session');
    if (!cookieValue) throw new UnauthorizedException('authentication_required');
    try {
      const actor = request.method === 'GET' || request.method === 'HEAD'
        ? await this.auth.authenticate(cookieValue)
        : await this.auth.authorizeStateChange({
            cookieValue,
            csrfToken: headerValue(request.headers['x-csrf-token']),
            origin: headerValue(request.headers.origin),
            expectedOrigin: this.appOrigin,
          });
      request.actorId = actor.actorId;
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === 'csrf') {
        throw new ForbiddenException('csrf_rejected');
      }
      throw new UnauthorizedException('invalid_session');
    }
  }
}

@Controller('api')
export class PrivateApiController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly auth: AuthApi,
    @Inject(CONTENT_SERVICE) private readonly content: {
      list(query: unknown): Promise<unknown>; timeline?(query: unknown): Promise<unknown>; detail(id: string): Promise<unknown>;
    },
    @Inject(FEEDBACK_SERVICE) private readonly feedback: {
      submit(actorId: string, body: unknown): Promise<unknown>;
    },
    @Inject(OPERATIONS_SERVICE) private readonly operations: {
      status(): Promise<unknown>; retry(id: string, actorId: string): Promise<unknown>;
    },
  ) {}

  @Public()
  @Post('auth/login')
  async login(
    @Body() body: { username?: unknown; password?: unknown },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      throw new BadRequestException('invalid_login_input');
    }
    let result;
    try {
      result = await this.auth.login(body.username, body.password, request.ip ?? 'unknown');
    } catch (error) {
      if (error instanceof Error && error.message === 'rate_limited') {
        throw new HttpException('rate_limited', 429);
      }
      throw new UnauthorizedException('invalid_credentials');
    }
    response.setHeader('Set-Cookie', result.sessionCookie);
    return { actorId: result.actorId, csrfToken: result.csrfToken, expiresAt: result.expiresAt };
  }

  @Post('auth/logout')
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const cookieValue = readCookie(request.headers.cookie, 'serenity_session') as string;
    await this.auth.logout(cookieValue);
    response.setHeader('Set-Cookie', clearSessionCookie(request.secure));
    return { status: 'logged_out' };
  }

  @Get('content')
  async list(@Query() query: Record<string, unknown>) {
    try {
      return await this.content.list(parseContentQuery(query));
    } catch {
      throw new BadRequestException('invalid_content_query');
    }
  }

  @Get('content/:id')
  async detail(@Param('id') id: string) {
    return sanitizeContentDetail(await this.content.detail(id));
  }

  @Get('timeline')
  async timeline(@Query() query: Record<string, unknown>) {
    try {
      const parsed = parseContentQuery({ ...query, sort: query.sort ?? 'published_desc' });
      return this.content.timeline
        ? this.content.timeline(parsed)
        : this.content.list(parsed);
    } catch {
      throw new BadRequestException('invalid_timeline_query');
    }
  }

  @Post('feedback')
  async submitFeedback(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    if (body !== null && typeof body === 'object' && 'actorId' in body) {
      throw new BadRequestException('actor_is_server_bound');
    }
    try {
      return await this.feedback.submit(request.actorId as string, body);
    } catch {
      throw new BadRequestException('invalid_feedback');
    }
  }

  @Get('operations/status')
  status() {
    return this.operations.status();
  }

  @Post('operations/retry/:id')
  async retry(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    try {
      return await this.operations.retry(id, request.actorId as string);
    } catch {
      throw new BadRequestException('not_recoverable');
    }
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const item of header?.split(';') ?? []) {
    const separator = item.indexOf('=');
    if (separator > 0 && item.slice(0, separator).trim() === name) {
      return item.slice(separator + 1).trim();
    }
  }
  return undefined;
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
