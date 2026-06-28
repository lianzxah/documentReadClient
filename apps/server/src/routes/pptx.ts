import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import {
  renderSlideThumbnail,
  generateAndCacheThumbnail,
  getCachedThumbnail,
} from '../services/pptxThumbnail.js';

const PPTX_THUMBNAILS_DIR = path.join(config.DATA_DIR, 'pptx-thumbnails');

// Schema for slide element
const SlideElementSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'shape', 'table']),
  left: z.number().optional(),
  top: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  rotate: z.number().optional(),
  opacity: z.number().optional(),
  // Text
  content: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  align: z.string().optional(),
  // Image
  src: z.string().optional(),
  // Shape
  svgPath: z.string().optional(),
  viewBox: z.tuple([z.number(), z.number()]).optional(),
  fillColor: z.string().optional(),
  outlined: z.boolean().optional(),
  outlineColor: z.string().optional(),
  outlineWidth: z.number().optional(),
  shapeType: z.string().optional(),
  // Table
  data: z.array(z.array(z.any())).optional(),
  theme: z.object({ color: z.string().optional() }).optional(),
}).passthrough();

const SlideSchema = z.object({
  id: z.string().min(1),
  elements: z.array(SlideElementSchema).default([]),
  background: z.object({
    type: z.string().optional(),
    color: z.string().optional(),
  }).optional(),
});

const ThumbnailBody = z.object({
  slide: SlideSchema,
});

export async function pptxRoutes(app: FastifyInstance) {
  /**
   * POST /pptx/thumbnail - Generate a thumbnail for a single slide.
   * Accepts slide JSON data and returns a PNG image.
   */
  app.post('/pptx/thumbnail', async (req, reply) => {
    const parsed = ThumbnailBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { slide } = parsed.data;

    try {
      // Generate thumbnail
      const buffer = await renderSlideThumbnail(slide as any);

      // Cache it
      await fs.mkdir(PPTX_THUMBNAILS_DIR, { recursive: true });
      const filePath = path.join(PPTX_THUMBNAILS_DIR, `${slide.id}.png`);
      await fs.writeFile(filePath, buffer);

      reply.header('Content-Type', 'image/png');
      reply.header('Cache-Control', 'public, max-age=3600');
      return reply.send(buffer);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({
        error: e?.message ?? 'Failed to generate thumbnail.',
      });
    }
  });

  /**
   * GET /pptx/thumbnail/:slideId - Serve a cached thumbnail.
   */
  app.get<{ Params: { slideId: string } }>(
    '/pptx/thumbnail/:slideId',
    async (req, reply) => {
      const { slideId } = req.params;

      // Sanitize to prevent path traversal
      const sanitized = path.basename(slideId).replace(/[^a-zA-Z0-9_-]/g, '');
      if (!sanitized) {
        return reply.code(400).send({ error: 'Invalid slide ID.' });
      }

      const cached = await getCachedThumbnail(sanitized);
      if (!cached) {
        return reply.code(404).send({ error: 'Thumbnail not found.' });
      }

      const content = await fs.readFile(cached);
      reply.header('Content-Type', 'image/png');
      reply.header('Cache-Control', 'public, max-age=3600');
      return reply.send(content);
    },
  );

  /**
   * POST /pptx/thumbnails/batch - Generate thumbnails for multiple slides.
   * Useful for initial load when all slides need thumbnails.
   */
  app.post('/pptx/thumbnails/batch', async (req, reply) => {
    const BatchBody = z.object({
      slides: z.array(SlideSchema).min(1).max(50),
    });

    const parsed = BatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { slides } = parsed.data;
    const results: Array<{ slideId: string; url: string }> = [];
    const errors: Array<{ slideId: string; error: string }> = [];

    for (const slide of slides) {
      try {
        await generateAndCacheThumbnail(slide.id, slide as any);
        results.push({
          slideId: slide.id,
          url: `/pptx/thumbnail/${slide.id}`,
        });
      } catch (e: any) {
        errors.push({
          slideId: slide.id,
          error: e?.message ?? 'Generation failed',
        });
      }
    }

    return { results, errors };
  });
}
