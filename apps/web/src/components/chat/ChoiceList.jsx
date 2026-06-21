import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatMarkdown } from './ChatMarkdown.jsx';
import { Pencil, Check } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Detect one OR MORE multiple-choice questions in an assistant message.
 *
 * Recognises options labelled with consecutive uppercase letters that restart
 * at A for each question (so "Q1: A B C D  Q2: A B C D" is parsed as two
 * independent questions, not a single A-G run). Markers may use `)`, `.`,
 * `．`, `、`, `:` or `：` and may sit on their own lines or run inline.
 *
 * Returns `null` when no question is detected. Otherwise returns:
 *   { segments: Array<{type:'markdown'|'choice', ...}>,
 *     questions: Array<{ before, options }> }
 *
 * `segments` preserves the original ordering so callers can render leading,
 * inter-question and trailing markdown alongside the interactive cards.
 *
 * Bug-fix history: prior versions used `text.length` as the end boundary of
 * the last option, which caused later questions in the same message to be
 * absorbed into the previous question's last option. The fix bounds each
 * option to the smaller of {next-marker-start, blank-line, text-length}.
 */
export function parseChoiceContent(text) {
  if (!text || typeof text !== 'string') return null;

  // Match "<boundary>A) ", "B. ", "C、", "D:" / "D：".
  // Boundary = start-of-string OR any non-alphanumeric so the marker can
  // follow whitespace, a Chinese colon (：), a comma, etc. The
  // consecutive-letter check below filters false positives like "C# is great".
  const re = /(^|[^A-Za-z0-9])([A-Z])[).．、:：]\s+/g;
  const allMatches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    allMatches.push({
      letter: m[2],
      markerStart: m.index + m[1].length,
      markerEnd: m.index + m[0].length,
    });
  }
  if (allMatches.length < 2) return null;

  const segments = [];
  const questions = [];
  let cursor = 0;
  let i = 0;

  while (i < allMatches.length) {
    if (allMatches[i].letter !== 'A') {
      i++;
      continue;
    }
    // Greedily extend a sequence A, B, C, ... starting at this match.
    const seq = [allMatches[i]];
    let expected = 'B'.charCodeAt(0);
    let j = i + 1;
    while (
      j < allMatches.length &&
      allMatches[j].letter.charCodeAt(0) === expected
    ) {
      seq.push(allMatches[j]);
      expected++;
      j++;
    }
    if (seq.length < 2) {
      i++;
      continue;
    }

    // End boundary of the LAST option: the first of (next-marker-start,
    // first blank line after the marker, text length).
    const lastStart = seq[seq.length - 1].markerEnd;
    let lastEnd = text.length;
    if (j < allMatches.length) {
      lastEnd = Math.min(lastEnd, allMatches[j].markerStart);
    }
    const blank = /\n\s*\n/.exec(text.slice(lastStart));
    if (blank) lastEnd = Math.min(lastEnd, lastStart + blank.index);

    // Determine where this question's preamble starts. Anything before
    // `seq[0]` and after the previous blank line belongs to this question's
    // header; earlier text becomes a standalone markdown segment.
    const preambleEnd = seq[0].markerStart;
    let preambleStart = cursor;
    const region = text.slice(cursor, preambleEnd);
    const blanks = [...region.matchAll(/\n\s*\n/g)];
    if (blanks.length > 0) {
      const lastBlank = blanks[blanks.length - 1];
      preambleStart = cursor + lastBlank.index + lastBlank[0].length;
    }
    if (preambleStart > cursor) {
      const md = text.slice(cursor, preambleStart);
      if (md.trim()) segments.push({ type: 'markdown', text: md });
    }

    const before = text.slice(preambleStart, preambleEnd).trim();
    const options = seq.map((mm, k) => {
      const s = mm.markerEnd;
      const e = k + 1 < seq.length ? seq[k + 1].markerStart : lastEnd;
      return { letter: mm.letter, text: text.slice(s, e).trim() };
    });
    const question = { before, options };
    questions.push(question);
    segments.push({ type: 'choice', question });

    cursor = lastEnd;
    // Advance past every marker that sits inside the consumed region so we
    // don't re-evaluate them as starts of new questions.
    i = j;
    while (i < allMatches.length && allMatches[i].markerStart < lastEnd) i++;
  }

  if (questions.length === 0) return null;

  if (cursor < text.length) {
    const tail = text.slice(cursor);
    if (tail.trim()) segments.push({ type: 'markdown', text: tail });
  }

  return { segments, questions };
}

/**
 * Backwards-compatible single-question parser. Returns the FIRST question of
 * `parseChoiceContent` (or null). Kept so callers that still expect the old
 * shape continue to work.
 */
export function parseChoiceOptions(text) {
  const parsed = parseChoiceContent(text);
  if (!parsed) return null;
  const q = parsed.questions[0];
  return { before: q.before, options: q.options };
}

/**
 * Internal: a single question card with its own option toggles and an
 * "Other (free input)" row. State is owned by the parent ChoiceList so a
 * single shared submit button can read all answers at once.
 */
function QuestionCard({
  question,
  selected,
  showOther,
  otherText,
  locked,
  onToggle,
  onToggleOther,
  onChangeOther,
}) {
  const { t } = useTranslation();
  return (
    <div className="not-prose my-3 space-y-2">
      {question.before && (
        <div className="prose prose-invert prose-sm max-w-none">
          <ChatMarkdown>{question.before}</ChatMarkdown>
        </div>
      )}
      {question.options.map((opt) => {
        const sel = selected.has(opt.letter);
        return (
          <button
            key={opt.letter}
            type="button"
            onClick={() => onToggle(opt.letter)}
            disabled={locked}
            className={cn(
              'w-full text-left px-3 py-2 rounded-md border transition-colors flex items-start gap-2 text-sm',
              sel
                ? 'border-vs-accent bg-vs-accent/25 text-white'
                : 'border-vs-border bg-[#2a2a2a] hover:bg-vs-accent/10 text-vs-fg',
              locked && !sel && 'opacity-60',
              locked && 'cursor-not-allowed',
            )}
          >
            <span
              className={cn(
                'inline-flex items-center justify-center w-5 h-5 rounded font-mono font-semibold flex-shrink-0 mt-px',
                sel ? 'bg-vs-accent text-white' : 'bg-vs-border/60 text-vs-fg',
              )}
            >
              {sel ? <Check size={12} /> : opt.letter}
            </span>
            <span className="flex-1 whitespace-pre-wrap break-words">
              <span className="text-vs-muted mr-1">{opt.letter}.</span>
              {opt.text}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => !locked && onToggleOther()}
        disabled={locked}
        className={cn(
          'w-full text-left px-3 py-2 rounded-md border flex items-center gap-2 text-sm',
          showOther
            ? 'border-vs-accent bg-vs-accent/15 text-white'
            : 'border-vs-border bg-[#2a2a2a] hover:bg-vs-accent/10 text-vs-fg',
          locked && 'opacity-60 cursor-not-allowed',
        )}
      >
        <Pencil size={13} className="flex-shrink-0" />
        <span>{t('chat.choice.other')}</span>
      </button>

      {showOther && (
        <textarea
          value={otherText}
          onChange={(e) => onChangeOther(e.target.value)}
          disabled={locked}
          placeholder={t('chat.choice.otherPlaceholder')}
          rows={2}
          className="w-full px-3 py-2 rounded-md border border-vs-border bg-vs-bg text-vs-fg text-sm resize-none focus:outline-none focus:border-vs-accent disabled:opacity-60"
        />
      )}
    </div>
  );
}

/**
 * Renders one or more multiple-choice questions as selectable cards, each
 * with its own "Other (free input)" row. A single shared submit button at
 * the bottom posts answers for all questions at once. The submit is enabled
 * only when EVERY question has at least one selection (option or non-empty
 * "Other" text), matching the reference UI ("回答所有问题").
 *
 * Props (preferred): `segments` from `parseChoiceContent`.
 * Props (legacy):   `before` + `options` for a single question.
 */
export function ChoiceList({
  segments,
  before,
  options,
  onSubmit,
  disabled,
}) {
  const { t } = useTranslation();

  // Normalise inputs: callers may pass either the new `segments` or the
  // legacy single-question shape.
  const normalisedSegments = useMemo(() => {
    if (segments && segments.length) return segments;
    if (options && options.length) {
      return [{ type: 'choice', question: { before: before ?? '', options } }];
    }
    return [];
  }, [segments, before, options]);

  const questions = useMemo(
    () =>
      normalisedSegments
        .filter((s) => s.type === 'choice')
        .map((s) => s.question),
    [normalisedSegments],
  );

  const [selectedSets, setSelectedSets] = useState(() =>
    questions.map(() => new Set()),
  );
  const [otherFlags, setOtherFlags] = useState(() => questions.map(() => false));
  const [otherTexts, setOtherTexts] = useState(() => questions.map(() => ''));
  const [submitted, setSubmitted] = useState(false);

  const locked = disabled || submitted;

  const toggle = (qIdx, letter) => {
    if (locked) return;
    setSelectedSets((prev) => {
      const next = prev.slice();
      const set = new Set(next[qIdx]);
      if (set.has(letter)) set.delete(letter);
      else set.add(letter);
      next[qIdx] = set;
      return next;
    });
  };

  const toggleOther = (qIdx) => {
    if (locked) return;
    setOtherFlags((prev) => {
      const next = prev.slice();
      next[qIdx] = !next[qIdx];
      return next;
    });
  };

  const setOther = (qIdx, value) => {
    if (locked) return;
    setOtherTexts((prev) => {
      const next = prev.slice();
      next[qIdx] = value;
      return next;
    });
  };

  const allAnswered = questions.every((_, idx) => {
    const hasOpt = selectedSets[idx]?.size > 0;
    const hasOther =
      otherFlags[idx] && (otherTexts[idx] || '').trim().length > 0;
    return hasOpt || hasOther;
  });
  const canSubmit = !locked && questions.length > 0 && allAnswered;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const lines = questions.map((q, idx) => {
      const heading = q.before
        ? q.before.replace(/\s+/g, ' ').trim()
        : `Q${idx + 1}`;
      const ans = [];
      for (const opt of q.options) {
        if (selectedSets[idx].has(opt.letter)) {
          ans.push(`${opt.letter}. ${opt.text}`);
        }
      }
      const ot = (otherTexts[idx] || '').trim();
      if (otherFlags[idx] && ot) ans.push(ot);
      return `【${heading}】 ${ans.join('；')}`;
    });
    setSubmitted(true);
    onSubmit?.(lines.join('\n'));
  };

  // Render every segment in document order, threading per-question state
  // into each `choice` segment. A running counter maps the segment to its
  // index in the `questions` array.
  let qCounter = 0;

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {normalisedSegments.map((seg, segIdx) => {
        if (seg.type === 'markdown') {
          return (
            <ChatMarkdown key={`md-${segIdx}`}>{seg.text}</ChatMarkdown>
          );
        }
        const qIdx = qCounter++;
        return (
          <QuestionCard
            key={`q-${segIdx}`}
            question={seg.question}
            selected={selectedSets[qIdx] ?? new Set()}
            showOther={otherFlags[qIdx] ?? false}
            otherText={otherTexts[qIdx] ?? ''}
            locked={locked}
            onToggle={(letter) => toggle(qIdx, letter)}
            onToggleOther={() => toggleOther(qIdx)}
            onChangeOther={(value) => setOther(qIdx, value)}
          />
        );
      })}

      <div className="not-prose flex justify-center pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'px-5 py-2 rounded-md text-sm font-medium transition-colors',
            canSubmit
              ? 'bg-vs-accent hover:bg-vs-accent-hover text-white'
              : 'bg-vs-border/60 text-vs-muted cursor-not-allowed',
          )}
        >
          {submitted ? t('chat.choice.submitted') : t('chat.choice.submit')}
        </button>
      </div>
    </div>
  );
}
