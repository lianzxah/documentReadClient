/**
 * Normalize and split Slidev markdown into individual slide bodies.
 *
 * Responsibilities:
 * - Strip accidental outer ```slidev / ```markdown / ```md fence wrappers that
 *   some LLMs add despite prompt instructions. Without this, the opening fence
 *   becomes a blank "slide" in the preview.
 * - Drop the global YAML frontmatter block (first chunk starts with '---').
 * - Drop per-slide YAML-only blocks (e.g. `layout: cover\nclass: text-center`)
 *   that would otherwise render as plain text with no visible content.
 *
 * Shared by SlidevPreview.jsx and SlidevPresenter.jsx to keep parsing logic
 * consistent across paginated preview and fullscreen presentation.
 */
export function parseSlides(markdown) {
  if (!markdown) return [];

  const cleaned = markdown
    .trim()
    .replace(/^```(?:slidev|markdown|md)?\s*\n/, '')
    .replace(/\n```\s*$/, '')
    .trim();

  let slides = cleaned
    .split(/\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Drop global frontmatter block (the first chunk that starts with '---').
  if (slides[0] && slides[0].startsWith('---') && slides.length > 1) {
    slides = slides.slice(1);
  }

  // Drop chunks that contain only YAML key/value pairs - these are per-slide
  // frontmatter blocks (layout:, class:, theme:, etc.) that carry no visible
  // content on their own.
  const isYamlOnly = (s) =>
    s.length > 0 &&
    s.split('\n').every(
      (line) => /^\s*$/.test(line) || /^[A-Za-z_][\w-]*\s*:/.test(line),
    );

  return slides.filter((s) => !isYamlOnly(s));
}
