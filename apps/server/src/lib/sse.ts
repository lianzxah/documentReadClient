import type { FastifyReply } from 'fastify';

/**
 * Writes a line-delimited JSON event stream. Each record is prefixed with
 * `data: ` and terminated with `\n\n` - compatible with EventSource but we
 * parse on the client manually via fetch + ReadableStream for POST support.
 */
export function openSSE(reply: FastifyReply) {
  reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders?.();
  // Comment pad to kick some proxies into streaming mode.
  reply.raw.write(': ok\n\n');

  return {
    send(event: unknown) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    error(message: string, extra?: Record<string, unknown>) {
      reply.raw.write(
        `data: ${JSON.stringify({ type: 'error', message, ...extra })}\n\n`,
      );
    },
    close() {
      reply.raw.end();
    },
  };
}
