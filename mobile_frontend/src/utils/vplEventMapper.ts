/**
 * VPL Event Mapper — the ONE source of truth for match-event banners.
 *
 * Both the Scorer screen and the Public screen must call mapBallToEvents()
 * with the same ball record. Nobody else decides what an event is called.
 *
 * Bug fix: an "EXTRA" event is produced ONLY when `extraType` is one of
 * wide / noball / bye / legbye / penalty. Runs scored off the bat can never
 * become an EXTRA, whatever other flags the data carries.
 */

export type VPLTier = 1 | 2 | 3 | 4 | 5 | 'extra';
export type VPLSoundKind = 'tick' | 'four' | 'six' | 'wicket' | 'extra' | 'milestone' | 'over';
export type VPLExtraType = 'wide' | 'noball' | 'bye' | 'legbye' | 'penalty';
export type VPLDismissal =
  | 'bowled'
  | 'caught'
  | 'caught_and_bowled'
  | 'lbw'
  | 'run_out'
  | 'stumped'
  | 'hit_wicket'
  | 'other';

export type VPLEventKind =
  | 'dot'
  | 'runs'
  | 'four'
  | 'six'
  | 'wicket'
  | 'wide'
  | 'noball'
  | 'bye'
  | 'legbye'
  | 'penalty'
  | 'fifty'
  | 'hundred'
  | 'hattrick'
  | 'partnership'
  | 'maiden'
  | 'overComplete';

export interface VPLEvent {
  id: string;
  kind: VPLEventKind;
  tier: VPLTier;
  sound: VPLSoundKind | null;
  durationMs: number;
  titleEn: string;
  titleTa: string;
  primary?: string;
  secondary?: string;
  detail?: string;
  shake?: boolean;
}

export const DURATION_MS = {
  runs: 1500,
  four: 2500,
  six: 3500,
  wicket: 3500,
  milestone: 4000,
  extra: 2000,
} as const;

export interface VPLBallInput {
  ballId: string;
  runsOffBat: number;
  extraType?: VPLExtraType | null;
  extraRuns?: number;
  isWicket?: boolean;
  dismissal?: VPLDismissal;
  dismissedName?: string;
  dismissedRuns?: number;
  dismissedBalls?: number;
  fielderName?: string;
  batterName?: string;
  batterRunsAfter?: number;
  batterBallsAfter?: number;
  nonStrikerName?: string;
  bowlerName?: string;
  bowlerConsecutiveWickets?: number;
  partnershipRunsAfter?: number;
}

export interface VPLOverInput {
  overId: string;
  overNumber: number;
  runsInOver: number;
  bowlerName?: string;
  bowlerFigures?: string;
  scoreText?: string;
}

const VALID_EXTRAS: VPLExtraType[] = ['wide', 'noball', 'bye', 'legbye', 'penalty'];

export function normalizeExtraType(raw: unknown): VPLExtraType | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.toLowerCase().replace(/[_\s-]/g, '');
  if (s === 'wide' || s === 'wd') return 'wide';
  if (s === 'noball' || s === 'nb') return 'noball';
  if (s === 'bye' || s === 'b') return 'bye';
  if (s === 'legbye' || s === 'lb') return 'legbye';
  if (s === 'penalty') return 'penalty';
  return null;
}

export function normalizeDismissal(raw: unknown): VPLDismissal | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const s = raw.toLowerCase().replace(/[_\s-]/g, '');
  if (s.includes('bowled')) return 'bowled';
  if (s.includes('caughtandbowled') || s.includes('c&b')) return 'caught_and_bowled';
  if (s.includes('caught')) return 'caught';
  if (s.includes('lbw')) return 'lbw';
  if (s.includes('runout')) return 'run_out';
  if (s.includes('stumped')) return 'stumped';
  if (s.includes('hitwicket')) return 'hit_wicket';
  return 'other';
}

function dismissalLabel(d?: VPLDismissal): { en: string; ta: string } {
  switch (d) {
    case 'bowled': return { en: 'BOWLED', ta: '' };
    case 'caught': return { en: 'CAUGHT', ta: '' };
    case 'caught_and_bowled': return { en: 'C&B', ta: '' };
    case 'lbw': return { en: 'LBW', ta: '' };
    case 'run_out': return { en: 'RUN OUT', ta: '' };
    case 'stumped': return { en: 'STUMPED', ta: '' };
    case 'hit_wicket': return { en: 'HIT WICKET', ta: '' };
    default: return { en: 'OUT', ta: '' };
  }
}

export function mapBallToEvents(ball: VPLBallInput): VPLEvent[] {
  const events: VPLEvent[] = [];
  const extra = normalizeExtraType(ball.extraType);
  const isValidExtra = extra !== null && VALID_EXTRAS.includes(extra);

  // 1. WICKET
  if (ball.isWicket) {
    const dl = dismissalLabel(ball.dismissal);
    const detailParts = [dl.en];
    if (ball.bowlerName) detailParts.push('b ' + ball.bowlerName);
    if (ball.fielderName && (ball.dismissal === 'caught' || ball.dismissal === 'run_out' || ball.dismissal === 'stumped')) {
      detailParts.push('c ' + ball.fielderName);
    }
    const scoreStr = (ball.dismissedRuns !== undefined && ball.dismissedBalls !== undefined)
      ? `${ball.dismissedRuns} (${ball.dismissedBalls})`
      : undefined;
    events.push({
      id: `${ball.ballId}-wicket`,
      kind: 'wicket',
      tier: 4,
      sound: 'wicket',
      durationMs: DURATION_MS.wicket,
      titleEn: 'WICKET',
      titleTa: '',
      primary: ball.dismissedName || ball.batterName,
      secondary: scoreStr,
      detail: detailParts.join(' · '),
      shake: true,
    });

    if (ball.bowlerConsecutiveWickets && ball.bowlerConsecutiveWickets >= 3) {
      events.push({
        id: `${ball.ballId}-hattrick`,
        kind: 'hattrick',
        tier: 5,
        sound: 'milestone',
        durationMs: DURATION_MS.milestone,
        titleEn: 'HAT-TRICK!',
        titleTa: '',
        primary: ball.bowlerName,
      });
    }
  }

  // 2. SIX
  if (!isValidExtra && ball.runsOffBat === 6) {
    events.push({
      id: `${ball.ballId}-six`,
      kind: 'six',
      tier: 3,
      sound: 'six',
      durationMs: DURATION_MS.six,
      titleEn: 'SIX',
      titleTa: '',
      primary: ball.batterName,
    });
  }

  // 3. FOUR
  if (!isValidExtra && ball.runsOffBat === 4) {
    events.push({
      id: `${ball.ballId}-four`,
      kind: 'four',
      tier: 2,
      sound: 'four',
      durationMs: DURATION_MS.four,
      titleEn: 'FOUR',
      titleTa: '',
      primary: ball.batterName,
    });
  }

  // 4. EXTRAS
  if (isValidExtra) {
    const extraLabels: Record<VPLExtraType, { en: string; ta: string }> = {
      wide: { en: 'WIDE', ta: '' },
      noball: { en: 'NO BALL', ta: '' },
      bye: { en: 'BYE', ta: '' },
      legbye: { en: 'LEG BYE', ta: '' },
      penalty: { en: 'PENALTY', ta: '' },
    };
    const lbl = extraLabels[extra!];
    events.push({
      id: `${ball.ballId}-extra-${extra}`,
      kind: extra! as VPLEventKind,
      tier: 'extra',
      sound: 'extra',
      durationMs: DURATION_MS.extra,
      titleEn: lbl.en,
      titleTa: lbl.ta,
      primary: ball.batterName,
      secondary: ball.extraRuns ? `+${ball.extraRuns}` : undefined,
    });
  }

  // 5. DOT or RUNS
  if (!isValidExtra && !ball.isWicket && ball.runsOffBat !== 4 && ball.runsOffBat !== 6) {
    if (ball.runsOffBat === 0) {
      events.push({
        id: `${ball.ballId}-dot`,
        kind: 'dot',
        tier: 1,
        sound: null,
        durationMs: DURATION_MS.runs,
        titleEn: 'DOT',
        titleTa: '',
        primary: ball.batterName,
      });
    } else {
      events.push({
        id: `${ball.ballId}-runs-${ball.runsOffBat}`,
        kind: 'runs',
        tier: 1,
        sound: ball.runsOffBat >= 2 ? 'tick' : null,
        durationMs: DURATION_MS.runs,
        titleEn: `+${ball.runsOffBat} RUN${ball.runsOffBat > 1 ? 'S' : ''}`,
        titleTa: '',
        primary: ball.batterName,
      });
    }
  }

  // 6. Milestones (50/100)
  if (ball.batterRunsAfter !== undefined) {
    if (ball.batterRunsAfter >= 100 && (ball.batterRunsAfter - (ball.runsOffBat || 0)) < 100) {
      events.push({
        id: `${ball.ballId}-hundred`,
        kind: 'hundred',
        tier: 5,
        sound: 'milestone',
        durationMs: DURATION_MS.milestone,
        titleEn: 'CENTURY!',
        titleTa: '',
        primary: ball.batterName,
        secondary: `${ball.batterRunsAfter} (${ball.batterBallsAfter})`,
      });
    } else if (ball.batterRunsAfter >= 50 && (ball.batterRunsAfter - (ball.runsOffBat || 0)) < 50) {
      events.push({
        id: `${ball.ballId}-fifty`,
        kind: 'fifty',
        tier: 5,
        sound: 'milestone',
        durationMs: DURATION_MS.milestone,
        titleEn: 'HALF-CENTURY!',
        titleTa: '',
        primary: ball.batterName,
        secondary: `${ball.batterRunsAfter} (${ball.batterBallsAfter})`,
      });
    }
  }

  // 7. Partnership milestone
  if (ball.partnershipRunsAfter !== undefined) {
    if (ball.partnershipRunsAfter >= 100 && (ball.partnershipRunsAfter - (ball.runsOffBat || 0)) < 100) {
      events.push({
        id: `${ball.ballId}-partnership-100`,
        kind: 'partnership',
        tier: 5,
        sound: 'milestone',
        durationMs: DURATION_MS.milestone,
        titleEn: '100 PARTNERSHIP',
        titleTa: '',
        primary: ball.batterName && ball.nonStrikerName ? `${ball.batterName} & ${ball.nonStrikerName}` : undefined,
        secondary: `${ball.partnershipRunsAfter} runs`,
      });
    } else if (ball.partnershipRunsAfter >= 50 && (ball.partnershipRunsAfter - (ball.runsOffBat || 0)) < 50) {
      events.push({
        id: `${ball.ballId}-partnership-50`,
        kind: 'partnership',
        tier: 5,
        sound: 'milestone',
        durationMs: DURATION_MS.milestone,
        titleEn: '50 PARTNERSHIP',
        titleTa: '',
        primary: ball.batterName && ball.nonStrikerName ? `${ball.batterName} & ${ball.nonStrikerName}` : undefined,
        secondary: `${ball.partnershipRunsAfter} runs`,
      });
    }
  }

  return events;
}

export function mapOverEnd(over: VPLOverInput): VPLEvent[] {
  const events: VPLEvent[] = [];
  const isMaiden = over.runsInOver === 0;
  if (isMaiden) {
    events.push({
      id: `${over.overId}-maiden`,
      kind: 'maiden',
      tier: 5,
      sound: 'milestone',
      durationMs: DURATION_MS.milestone,
      titleEn: 'MAIDEN OVER!',
      titleTa: '',
      primary: over.bowlerName,
      secondary: over.bowlerFigures,
    });
  }
  events.push({
    id: `${over.overId}-over`,
    kind: 'overComplete',
    tier: 1,
    sound: 'over',
    durationMs: DURATION_MS.runs,
    titleEn: `OVER ${over.overNumber}`,
    titleTa: '',
    primary: over.scoreText,
    secondary: over.bowlerName ? `b: ${over.bowlerName}` : undefined,
  });
  return events;
}

