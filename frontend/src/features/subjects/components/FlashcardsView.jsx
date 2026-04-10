import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, 
    ChevronRight, 
    Layers,
    Award,
    RotateCcw,
    Volume2,
    VolumeX,
    Shuffle,
    Timer,
    Flame,
    ThumbsUp,
    ThumbsDown,
    Minus,
    Keyboard,
    Brain,
    Zap,
    Target,
    BrainCircuit,
    Sparkles,
    RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}
import Confetti from 'react-confetti';

// ---------------------------------------------------------------------------
// Audio Synthesis
// ---------------------------------------------------------------------------
let audioCtx = null;
const playAudio = (type) => {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        if (type === 'flip') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'next') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(700, audioCtx.currentTime + 0.08);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.08);
        } else if (type === 'mastered') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.4);
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.4);
        } else if (type === 'easy') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.12);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.25);
        } else if (type === 'medium') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'hard') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.2);
        }
    } catch (e) {
        console.warn('Audio not supported', e);
    }
};

// ---------------------------------------------------------------------------
// Confetti Wrapper
// ---------------------------------------------------------------------------
const ConfettiOverlay = () => {
    const [dim, setDim] = useState({ width: window.innerWidth, height: window.innerHeight });
    useEffect(() => {
        const onResize = () => setDim({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return <Confetti width={dim.width} height={dim.height} className="!fixed !top-0 !left-0 !z-[9999] pointer-events-none" />;
};

// ---------------------------------------------------------------------------
// Fisher-Yates shuffle
// ---------------------------------------------------------------------------
const shuffleArray = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

// ---------------------------------------------------------------------------
// Time formatter
// ---------------------------------------------------------------------------
const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Data normaliser — handles every known backend shape & property names
// ---------------------------------------------------------------------------
const mapCard = (c) => {
    // Priority order: prefer 'question'/'answer', fallback to 'front'/'back'
    const question =
        c.question ?? c.front ?? c.text ?? c.title ?? '';
    const answer =
        c.answer ?? c.back ?? c.solution ?? c.explanation ?? '';
    return {
        question: String(question).trim(),
        answer: String(answer).trim()
    };
};

const extractCards = (data) => {
    if (!data) return [];
    
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) { /* ignore */ }
    }
    
    // 0. Salvage completely broken JSON from the AI engine (`data.raw`)
    if (data && data.error && data.raw) {
        let rawStr = data.raw.trim();
        // The AI sometimes generates comma-separated objects without array brackets: {..}, {..}
        try {
            // Attempt to wrap in array and parse
            let fixed = `[${rawStr.replace(/}\s*$/, '}')}]`; // Ensure it ends with }
            if (!rawStr.startsWith('[')) fixed = `[${rawStr}]`;
            const arr = JSON.parse(fixed);
            if (Array.isArray(arr)) return arr.map(e => mapCard(e));
        } catch (e) {
            // Ultimate fallback: Regex scavenge question/answer pairs from broken string
            const qMatches = [...rawStr.matchAll(/("question[^"]*"\s*:\s*"([^"]+)")/gi)];
            const aMatches = [...rawStr.matchAll(/("answer[^"]*"\s*:\s*"([^"]+)")/gi)];
            
            if (qMatches.length > 0 && aMatches.length > 0) {
                const salvaged = [];
                const len = Math.min(qMatches.length, aMatches.length);
                for (let i = 0; i < len; i++) {
                    salvaged.push({ question: qMatches[i][2], answer: aMatches[i][2] });
                }
                if (salvaged.length > 0) return salvaged;
            }
        }
    }
    
    // 1. Direct Array
    if (Array.isArray(data)) return data.map(mapCard);
    
    // 2. Contains standard properties
    if (Array.isArray(data.cards)) return data.cards.map(mapCard);
    if (Array.isArray(data.flashcards)) return data.flashcards.map(mapCard);
    
    // 3. Single object (AI forgot to make an array)
    if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).some(k => k.toLowerCase().includes('question') || k.toLowerCase().includes('front'))) {
        // AI sometimes outputs single flat object: {"question1": "...", "answer1": "..."}
        const keys = Object.keys(data);
        const qKeys = keys.filter(k => k.toLowerCase().includes('question') || k.toLowerCase().includes('front'));
        const aKeys = keys.filter(k => k.toLowerCase().includes('answer') || k.toLowerCase().includes('back'));
        
        if (qKeys.length > 1) {
            // It mapped multiple cards into a flat object
            const salvaged = [];
            for (let i = 0; i < Math.min(qKeys.length, aKeys.length); i++) {
                salvaged.push({ question: data[qKeys[i]], answer: data[aKeys[i]] });
            }
            if (salvaged.length > 0) return salvaged;
        } else {
            return [mapCard(data)];
        }
    }
    
    // 4. Try recursively unpacking wrapper objects ({ result: { ... } }, { data: { ... } })
    if (data.result) return extractCards(data.result);
    if (data.data) return extractCards(data.data);
    
    // 5. Deep search fallback: find ANY array that looks like flashcards
    const values = Object.values(data);
    for (const val of values) {
        if (Array.isArray(val) && val.length > 0) {
            return val.map(mapCard);
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
            const nested = extractCards(val);
            if (nested.length > 0) return nested;
        }
    }
    
    return [];
};

// ── Strict Validation Layer ──
const validateCards = (rawCards) => {
    console.log("RAW PARSED CARDS:", rawCards);
    
    // ENFORCE STRICT VALIDATION (Never trust LLM output)
    let cards = rawCards.filter(card => 
        card.question && card.question.trim() !== "" &&
        card.answer && card.answer.trim() !== ""
    );
    
    // Attempt local frontend healing if parsing somehow duplicated / over-generated
    // UI acts as last line of defense. 
    // If flashcardsExpectedCount is set by the session, it wins. 
    // Otherwise use cards.length, and only fallback to 10 if everything is empty.
    const expectedCount = flashcardsExpectedCount > 0 
        ? flashcardsExpectedCount 
        : (cards.length > 0 ? cards.length : 10);
    
    if (cards.length > expectedCount) {
        cards = cards.slice(0, expectedCount);
    }
    
    if (cards.length < expectedCount && cards.length > 0) {
        const missing = expectedCount - cards.length;
        console.warn(`[Flashcards] Regenerating/Padding missing ${missing} cards locally to enforce N=${expectedCount}`);
        const extra = [];
        for (let i = 0; i < missing; i++) {
            const baseCard = cards[i % cards.length];
            extra.push({ 
                question: `${baseCard.question} (Review)`, 
                answer: baseCard.answer 
            });
        }
        cards = [...cards, ...extra];
    }
    
    console.log("FINAL VALIDATED CARDS COUNT:", cards.length);
    console.log("VALIDATED CARDS CONTENT:", cards);
    return cards;
};

// Global config trick to pass expected count from options to frontend easily for slicing
let flashcardsExpectedCount = 0;
export const setFlashcardsExpectedCount = (count) => { flashcardsExpectedCount = count; };

// ---------------------------------------------------------------------------
// Rating Config
// ---------------------------------------------------------------------------
const RATINGS = {
    easy: { label: 'Know It', icon: ThumbsUp, color: 'emerald', gradient: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-200', key: '1' },
    medium: { label: 'Almost', icon: Minus, color: 'amber', gradient: 'from-amber-400 to-orange-400', shadow: 'shadow-amber-200', key: '2' },
    hard: { label: "Didn't Know", icon: ThumbsDown, color: 'rose', gradient: 'from-rose-500 to-pink-500', shadow: 'shadow-rose-200', key: '3' },
};

// ---------------------------------------------------------------------------
// Mini-Map Dot
// ---------------------------------------------------------------------------
const CardDot = ({ rating, isCurrent, onClick }) => {
    const colors = {
        easy: 'bg-emerald-400',
        medium: 'bg-amber-400',
        hard: 'bg-rose-400',
        null: 'bg-gray-200',
    };
    return (
        <button
            onClick={onClick}
            className={`rounded-full transition-all duration-200 ${colors[rating || 'null']} ${
                isCurrent ? 'w-3 h-3 ring-2 ring-indigo-400 ring-offset-1' : 'w-2 h-2 hover:scale-150'
            }`}
            title={rating ? `Rated: ${rating}` : 'Not rated'}
        />
    );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const FlashcardsView = ({ flashcardsData, isExpanded = false }) => {
    // ── SYNCHRONOUS card derivation (no state race conditions) ──
    // Cards are computed directly from the prop — never async.
    const cards = useMemo(() => {
        const rawExtracted = extractCards(flashcardsData);
        return validateCards(rawExtracted);
    }, [flashcardsData]);

    // Pure session state — reset when flashcardsData identity changes
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isFlipping, setIsFlipping] = useState(false);
    const [direction, setDirection] = useState(0);
    const [muted, setMuted] = useState(false);
    const [ratings, setRatings] = useState({});
    const [shuffled, setShuffled] = useState(false);
    const [shuffleOrder, setShuffleOrder] = useState([]);
    const [streak, setStreak] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef(null);
    const [showSummary, setShowSummary] = useState(false);
    const [celebrating, setCelebrating] = useState(false);
    const [studyHardOnly, setStudyHardOnly] = useState(false);
    const animating = useRef(false);

    // Hard reset all session state when the data source changes
    const prevDataRef = useRef(null);
    useEffect(() => {
        if (prevDataRef.current !== flashcardsData) {
            prevDataRef.current = flashcardsData;
            console.log("[Flashcards] NEW SESSION — resetting state. Cards:", cards.length);
            setCurrentIndex(0);
            setIsRevealed(false);
            setRatings({});
            setStreak(0);
            setShowSummary(false);
            setCelebrating(false);
            setStudyHardOnly(false);
            setElapsed(0);
            setDirection(0);
            setShuffled(false);
            setShuffleOrder(cards.map((_, i) => i));
        }
    }, [flashcardsData, cards]);

    // Keep shuffleOrder in sync with cards length
    useEffect(() => {
        if (shuffleOrder.length !== cards.length && cards.length > 0) {
            setShuffleOrder(cards.map((_, i) => i));
        }
    }, [cards.length, shuffleOrder.length]);

    // Active card order (respects shuffle + hard-only modes)
    const activeOrder = useMemo(() => {
        if (cards.length === 0) return [];
        if (studyHardOnly) {
            return shuffleOrder.filter(i => ratings[i] === 'hard' || !ratings[i]);
        }
        return shuffled ? shuffleOrder : cards.map((_, i) => i);
    }, [shuffled, shuffleOrder, cards, studyHardOnly, ratings]);

    // Current card — always safely bounded
    const safeIndex = Math.min(currentIndex, Math.max(0, activeOrder.length - 1));
    const originalIndex = activeOrder[safeIndex] ?? 0;
    const card = cards[originalIndex];

    // Timer
    useEffect(() => {
        if (showSummary) return;
        timerRef.current = setInterval(() => {
            setElapsed(prev => prev + 1);
        }, 1000);

        const handleVisibility = () => {
            if (document.hidden) {
                clearInterval(timerRef.current);
            } else {
                timerRef.current = setInterval(() => {
                    setElapsed(prev => prev + 1);
                }, 1000);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(timerRef.current);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [showSummary]);

    // Ensure shuffle order matches card count safely
    useEffect(() => {
        if (cards.length > 0 && Math.max(...shuffleOrder, -1) >= cards.length) {
            setShuffleOrder(cards.map((_, i) => i));
        }
    }, [cards.length, shuffleOrder]);

    // Completion detection
    const ratedCount = Object.keys(ratings).length;
    const allRated = cards.length > 0 && ratedCount >= cards.length;

    useEffect(() => {
        if (allRated && !showSummary) {
            const allEasy = Object.values(ratings).every(r => r === 'easy');
            if (allEasy) {
                setCelebrating(true);
                if (!muted) playAudio('mastered');
                const t = setTimeout(() => setCelebrating(false), 5000);
                return () => clearTimeout(t);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allRated, showSummary]);

    // ── Actions ──
    const toggleFlip = useCallback(() => {
        if (!muted) playAudio('flip');
        setIsRevealed(prev => !prev);
    }, [muted]);

    const rateCard = useCallback((rating) => {
        setRatings(prev => ({ ...prev, [originalIndex]: rating }));
        if (!muted) playAudio(rating);
        
        if (rating === 'easy') {
            setStreak(prev => prev + 1);
        } else {
            setStreak(0);
        }

        // Auto-advance after a brief delay
        setTimeout(() => {
            if (currentIndex < activeOrder.length - 1) {
                setDirection(1);
                setIsRevealed(false);
                const next = currentIndex + 1;
                setCurrentIndex(next);
            } else {
                // All cards seen in this pass
                setShowSummary(true);
            }
        }, 400);
    }, [originalIndex, currentIndex, activeOrder.length, muted]);

    const goNext = useCallback(() => {
        if (currentIndex >= activeOrder.length - 1 || animating.current) return;
        animating.current = true;
        setDirection(1);
        setIsRevealed(false);
        if (!muted) playAudio('next');
        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            animating.current = false;
        }, 50);
    }, [currentIndex, activeOrder.length, muted]);

    const goPrev = useCallback(() => {
        if (currentIndex <= 0 || animating.current) return;
        animating.current = true;
        setDirection(-1);
        setIsRevealed(false);
        if (!muted) playAudio('next');
        setTimeout(() => {
            setCurrentIndex(prev => prev - 1);
            animating.current = false;
        }, 50);
    }, [currentIndex, muted]);

    const jumpToCard = useCallback((orderIdx) => {
        setIsRevealed(false);
        setDirection(orderIdx > currentIndex ? 1 : -1);
        setCurrentIndex(orderIdx);
    }, [currentIndex]);

    const toggleShuffle = useCallback(() => {
        if (!shuffled) {
            const newOrder = shuffleArray(cards.map((_, i) => i));
            setShuffleOrder(newOrder);
            setShuffled(true);
        } else {
            setShuffled(false);
        }
        setCurrentIndex(0);
        setIsRevealed(false);
    }, [shuffled, cards]);

    const restart = useCallback(() => {
        setCurrentIndex(0);
        setIsRevealed(false);
        setRatings({});
        setStreak(0);
        setShowSummary(false);
        setCelebrating(false);
        setStudyHardOnly(false);
        setElapsed(0);
        if (shuffled) {
            setShuffleOrder(shuffleArray(cards.map((_, i) => i)));
        }
    }, [shuffled, cards]);

    const studyHard = useCallback(() => {
        setStudyHardOnly(true);
        setShowSummary(false);
        setCurrentIndex(0);
        setIsRevealed(false);
        // Keep hard ratings, clear others so they can be re-rated
        setRatings(prev => {
            const next = {};
            Object.entries(prev).forEach(([k, v]) => {
                if (v === 'hard') next[k] = undefined; // clear to allow re-rating
            });
            return next;
        });
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e) => {
            const tag = document.activeElement?.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            if (showSummary) return;

            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                toggleFlip();
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                goNext();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                goPrev();
            } else if (e.key.toLowerCase() === 's') {
                e.preventDefault();
                toggleShuffle();
            } else if (isRevealed) {
                // Rating shortcuts: 1/2/3
                if (e.key === '1') { e.preventDefault(); rateCard('easy'); }
                if (e.key === '2') { e.preventDefault(); rateCard('medium'); }
                if (e.key === '3') { e.preventDefault(); rateCard('hard'); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isRevealed, showSummary, toggleFlip, goNext, goPrev, toggleShuffle, rateCard]);

    // ── Stats ──
    const stats = useMemo(() => {
        const easy = Object.values(ratings).filter(r => r === 'easy').length;
        const medium = Object.values(ratings).filter(r => r === 'medium').length;
        const hard = Object.values(ratings).filter(r => r === 'hard').length;
        return { easy, medium, hard, total: cards.length };
    }, [ratings, cards.length]);

    // -----------------------------------------------------------------------
    // Empty state
    // -----------------------------------------------------------------------
    if (cards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-16 text-gray-400 gap-4">
                <Layers className="w-14 h-14 opacity-20" />
                <p className="text-sm font-semibold text-center mt-2">
                    {flashcardsData?.error 
                        ? "AI failed to generate flashcards. The content format was invalid." 
                        : "No flashcards available or generation produced empty results."}
                </p>
                <p className="text-xs text-gray-300">Please try generating flashcards again from the Study Intelligence tab.</p>
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // Summary Screen
    // -----------------------------------------------------------------------
    if (showSummary) {
        const allEasy = stats.easy === stats.total;
        const easyPct = Math.round((stats.easy / stats.total) * 100);
        const medPct = Math.round((stats.medium / stats.total) * 100);
        const hardPct = Math.round((stats.hard / stats.total) * 100);
        const hardCards = cards.filter((_, i) => ratings[i] === 'hard');

        return (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mx-auto ${isExpanded ? 'max-w-3xl py-16' : 'max-w-2xl py-10'} px-6 relative`}
            >
                {celebrating && <ConfettiOverlay />}
                
                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-gray-100 overflow-hidden">
                    {/* Header gradient */}
                    <div className={`h-2 ${allEasy ? 'bg-gradient-to-r from-amber-400 to-yellow-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} />
                    
                    <div className="p-10 text-center">
                        <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
                                allEasy ? 'bg-amber-50' : 'bg-indigo-50'
                            }`}
                        >
                            {allEasy 
                                ? <Award className="w-12 h-12 text-amber-500" />
                                : <Brain className="w-12 h-12 text-indigo-500" />
                            }
                        </motion.div>

                        <h2 className="text-3xl font-black text-gray-900 mb-2">
                            {allEasy ? 'Perfect Mastery!' : 'Session Complete!'}
                        </h2>
                        <p className="text-gray-400 font-medium mb-2">
                            {allEasy 
                                ? 'You knew every single card. Outstanding!' 
                                : 'Great study session. Keep reviewing the tough ones!'}
                        </p>
                        <div className="flex items-center justify-center gap-2 text-gray-300 text-sm font-medium mb-8">
                            <Timer className="w-4 h-4" />
                            <span>Study time: {formatTime(elapsed)}</span>
                        </div>

                        {/* Score Breakdown */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                                <div className="text-3xl font-black text-emerald-600 mb-1">{stats.easy}</div>
                                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Know It</div>
                                <div className="text-xs text-emerald-400 font-bold mt-1">{easyPct}%</div>
                            </div>
                            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
                                <div className="text-3xl font-black text-amber-600 mb-1">{stats.medium}</div>
                                <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Almost</div>
                                <div className="text-xs text-amber-400 font-bold mt-1">{medPct}%</div>
                            </div>
                            <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100">
                                <div className="text-3xl font-black text-rose-600 mb-1">{stats.hard}</div>
                                <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Didn't Know</div>
                                <div className="text-xs text-rose-400 font-bold mt-1">{hardPct}%</div>
                            </div>
                        </div>

                        {/* Difficulty bar */}
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex mb-8">
                            {stats.easy > 0 && (
                                <div className="bg-emerald-400 h-full transition-all" style={{ width: `${easyPct}%` }} />
                            )}
                            {stats.medium > 0 && (
                                <div className="bg-amber-400 h-full transition-all" style={{ width: `${medPct}%` }} />
                            )}
                            {stats.hard > 0 && (
                                <div className="bg-rose-400 h-full transition-all" style={{ width: `${hardPct}%` }} />
                            )}
                        </div>

                        {/* Hard cards list */}
                        {hardCards.length > 0 && (
                            <div className="mb-8 text-left">
                                <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5" />
                                    Cards to Review ({hardCards.length})
                                </h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {hardCards.map((c, i) => (
                                        <div key={i} className="bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-3 text-sm">
                                            <span className="font-bold text-gray-700">{c.front}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 justify-center flex-wrap">
                            <button
                                onClick={restart}
                                className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg shadow-gray-200"
                            >
                                <RotateCcw className="w-5 h-5" />
                                Restart Deck
                            </button>
                            {hardCards.length > 0 && (
                                <button
                                    onClick={studyHard}
                                    className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl font-bold hover:from-rose-600 hover:to-pink-600 transition-all shadow-lg shadow-rose-200"
                                >
                                    <Zap className="w-5 h-5" />
                                    Study Hard Cards
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    // -----------------------------------------------------------------------
    // Main Card View
    // -----------------------------------------------------------------------
    const progress = ((currentIndex + 1) / activeOrder.length) * 100;
    const currentRating = ratings[originalIndex];
    const isLast = currentIndex === activeOrder.length - 1;

    return (
        <div className={`mx-auto ${isExpanded ? 'max-w-3xl py-16' : 'max-w-2xl py-10'} px-6 relative`}>
            {celebrating && <ConfettiOverlay />}

            {/* ── Top bar ── */}
            <div className="flex items-center justify-between mb-6">
                {/* Left: icon + title */}
                <div className="flex items-center gap-4">
                    <div className={`rounded-2xl flex items-center justify-center shadow-md transition-all ${
                        allRated ? 'bg-amber-500 shadow-amber-200' : 'bg-indigo-600 shadow-indigo-200'
                    } w-11 h-11`}>
                        {allRated
                            ? <Award className="w-5 h-5 text-white" />
                            : <Layers className="w-5 h-5 text-white" />
                        }
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Flashcards</h2>
                            {studyHardOnly && (
                                <span className="bg-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-rose-200">
                                    Hard Cards
                                </span>
                            )}
                            <AnimatePresence>
                                {streak >= 3 && (
                                    <motion.div 
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-rose-500 text-white px-2 py-0.5 rounded-lg shadow-lg shadow-orange-500/30 font-bold text-[11px] tracking-wide"
                                    >
                                        <Flame className="w-3 h-3 animate-pulse" />
                                        {streak}🔥
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {ratedCount} of {cards.length} rated
                        </p>
                    </div>
                </div>

                {/* Right: timer + controls */}
                <div className="flex items-center gap-2">
                    {/* Timer */}
                    <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 text-gray-400 text-xs font-bold">
                        <Timer className="w-3.5 h-3.5" />
                        {formatTime(elapsed)}
                    </div>
                    
                    {/* Shuffle */}
                    <button
                        onClick={toggleShuffle}
                        title={shuffled ? 'Sequential order' : 'Shuffle cards'}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-colors ${
                            shuffled 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-500' 
                                : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                        }`}
                    >
                        <Shuffle className="w-4 h-4" />
                    </button>

                    {/* Mute */}
                    <button
                        onClick={() => setMuted(m => !m)}
                        title={muted ? 'Unmute' : 'Mute'}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    {/* Restart */}
                    <button
                        onClick={restart}
                        title="Restart deck"
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Segmented Progress bar ── */}
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex mb-2">
                {activeOrder.map((origIdx, i) => {
                    const r = ratings[origIdx];
                    const bgColor = r === 'easy' ? 'bg-emerald-400' 
                                  : r === 'medium' ? 'bg-amber-400' 
                                  : r === 'hard' ? 'bg-rose-400' 
                                  : i <= currentIndex ? 'bg-indigo-200' 
                                  : 'bg-transparent';
                    return (
                        <div 
                            key={origIdx} 
                            className={`h-full transition-all duration-300 ${bgColor}`}
                            style={{ width: `${100 / activeOrder.length}%` }}
                        />
                    );
                })}
            </div>

            {/* ── Card Mini-map ── */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap mb-8 py-2">
                {activeOrder.map((origIdx, i) => (
                    <CardDot 
                        key={origIdx}
                        rating={ratings[origIdx]}
                        isCurrent={i === currentIndex}
                        onClick={() => jumpToCard(i)}
                    />
                ))}
            </div>

            {/* ── Card counter nav ── */}
            <div className="flex items-center justify-center gap-4 mb-6">
                <button
                    onClick={goPrev}
                    disabled={currentIndex === 0}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                        currentIndex === 0
                            ? 'text-gray-200 border-gray-100 bg-gray-50 cursor-not-allowed'
                            : 'text-gray-500 border-gray-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm'
                    }`}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-black text-gray-900 min-w-[70px] text-center">
                    {currentIndex + 1} <span className="text-gray-300 mx-1">/</span> {activeOrder.length}
                    {currentRating && (
                        <span className={`ml-2 inline-block w-2 h-2 rounded-full ${
                            currentRating === 'easy' ? 'bg-emerald-400' : currentRating === 'medium' ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                    )}
                </span>
                <button
                    onClick={goNext}
                    disabled={isLast}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                        isLast
                            ? 'text-gray-200 border-gray-100 bg-gray-50 cursor-not-allowed'
                            : 'text-gray-500 border-gray-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm'
                    }`}
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* ── Flashcard ── */}
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={`${currentIndex}-${originalIndex}`}
                    initial={{ x: direction * 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -direction * 50, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                    className="mb-8 relative"
                    style={{ perspective: "2000px" }}
                >
                    <motion.div
                        animate={{ 
                            rotateY: isRevealed ? 180 : 0,
                            scale: isRevealed ? [1, 1.02, 1] : [1, 1.02, 1], // Subtle, faster pop
                            z: isRevealed ? 10 : 0 // Less aggressive burst
                        }}
                        whileHover={{ scale: 1.01, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ 
                            type: 'spring', 
                            stiffness: 600, // Faster than default but smoother than 800
                            damping: 45, // High damping to prevent jitter
                            mass: 0.9
                        }}
                        style={{ transformStyle: "preserve-3d" }}
                        className={`relative w-full ${isExpanded ? 'min-h-[580px]' : 'min-h-[480px]'} transition-all duration-300`}
                    >
                        {/* Front Side */}
                        <div
                            className="absolute inset-0 w-full h-full"
                            style={{ 
                                backfaceVisibility: "hidden",
                                WebkitBackfaceVisibility: "hidden",
                                transform: "translateZ(2px)" // Extra separation
                            }}
                            onClick={toggleFlip}
                        >
                            <div className="h-full w-full relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-gray-100 cursor-pointer group">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 pointer-events-none" />
                                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-bl-[10rem] pointer-events-none" />
                                <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none mix-blend-overlay" />
                                
                                {/* Header HUD */}
                                <div className="absolute top-0 left-0 right-0 pt-8 pb-12 flex flex-col items-center z-20 pointer-events-none bg-gradient-to-b from-white via-white/90 to-transparent">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm flex-shrink-0 pointer-events-auto">
                                        <BrainCircuit className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <span className="inline-block text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50/80 px-3 py-1 rounded-full border border-indigo-100/50 flex-shrink-0 pointer-events-auto">Question</span>
                                </div>

                                <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                                    <div className="min-h-full w-full flex flex-col items-center justify-center text-center px-10 pt-28 pb-32 relative z-10">
                                        <h3 className={cn(
                                            "font-black text-gray-900 leading-tight tracking-tight px-4 transition-all duration-300",
                                            isExpanded ? 'text-4xl' : 'text-2xl md:text-3xl',
                                            card?.question?.length > 60 && (isExpanded ? 'text-3xl' : 'text-2xl md:text-2xl'),
                                            card?.question?.length > 120 && (isExpanded ? 'text-2xl' : 'text-xl md:text-xl'),
                                            card?.question?.length > 200 && (isExpanded ? 'text-xl' : 'text-lg')
                                        )}>
                                            {card?.question}
                                        </h3>
                                    </div>
                                </div>

                                {/* Footer HUD */}
                                <div className="absolute bottom-0 left-0 right-0 pb-10 pt-16 flex justify-center z-20 pointer-events-none bg-gradient-to-t from-white via-white/90 to-transparent">
                                    <div className="flex items-center justify-center gap-2.5 px-6 py-2.5 bg-gray-50/50 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all border border-transparent group-hover:border-indigo-100 pointer-events-auto shadow-sm backdrop-blur-sm">
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                                        <span>Press Space or Click to Flip</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Back Side */}
                        <div
                            className="absolute inset-0 w-full h-full"
                            style={{ 
                                backfaceVisibility: "hidden",
                                WebkitBackfaceVisibility: "hidden",
                                transform: "rotateY(180deg) translateZ(2px)" 
                            }}
                            onClick={toggleFlip}
                        >
                            <div className="h-full w-full relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-white border border-emerald-100 cursor-pointer group">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20 pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-tr-[10rem] pointer-events-none" />
                                
                                {/* Header HUD */}
                                <div className="absolute top-0 left-0 right-0 pt-8 pb-12 flex flex-col items-center z-20 pointer-events-none bg-gradient-to-b from-white via-white/90 to-transparent">
                                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm flex-shrink-0 pointer-events-auto">
                                        <Sparkles className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <span className="inline-block text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50/80 px-3 py-1 rounded-full border border-emerald-100/50 flex-shrink-0 pointer-events-auto">Answer</span>
                                </div>

                                <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                                    <div className="min-h-full w-full flex flex-col items-center justify-center text-center px-10 pt-28 pb-32 relative z-10">
                                        <p className={cn(
                                            "font-black text-gray-800 leading-relaxed px-4 transition-all duration-300",
                                            isExpanded ? 'text-2xl md:text-3xl' : 'text-lg md:text-2xl',
                                            card?.answer?.length > 100 && (isExpanded ? 'text-xl md:text-2xl' : 'text-base md:text-xl'),
                                            card?.answer?.length > 220 && (isExpanded ? 'text-lg md:text-xl' : 'text-base md:text-lg'),
                                            card?.answer?.length > 350 && (isExpanded ? 'text-base' : 'text-sm')
                                        )}>
                                            {card?.answer}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer HUD */}
                                <div className="absolute bottom-0 left-0 right-0 pb-10 pt-16 flex justify-center z-20 pointer-events-none bg-gradient-to-t from-white via-white/90 to-transparent">
                                    <div className="flex items-center justify-center gap-2.5 px-6 py-2.5 bg-gray-50/50 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-all border border-transparent group-hover:border-emerald-100 pointer-events-auto shadow-sm backdrop-blur-sm">
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                                        <span>Click to Flip Back</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* ── Action buttons ── */}
            <div className="flex gap-3 mb-4">
                <button
                    onClick={toggleFlip}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]",
                        !isRevealed 
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200" 
                            : "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                    )}
                >
                    <RefreshCw className={cn("w-4 h-4", isFlipping && "animate-spin")} />
                    {isRevealed ? 'Flip Back' : 'Flip Card'}
                </button>
                
                {isRevealed && (
                    <div className="flex gap-2 flex-grow animate-in slide-in-from-right-4">
                        {Object.entries(RATINGS).map(([key, cfg]) => {
                            const Icon = cfg.icon;
                            const isSelected = currentRating === key;
                            return (
                                <motion.button
                                    key={key}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => rateCard(key)}
                                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-4 rounded-2xl font-bold text-sm transition-all ${
                                        isSelected
                                            ? `bg-gradient-to-r ${cfg.gradient} text-white shadow-lg ${cfg.shadow}`
                                            : `bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100`
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-xs">{cfg.label}</span>
                                    <span className="text-[10px] opacity-60">{cfg.key}</span>
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Quick nav after rating ── */}
            {isRevealed && (
                <div className="flex gap-2">
                    {!isLast && (
                        <button
                            onClick={goNext}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-500 font-bold text-xs transition-all"
                        >
                            Skip to Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {isLast && ratedCount >= cards.length && (
                        <button
                            onClick={() => setShowSummary(true)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-200 transition-all"
                        >
                            View Summary
                            <Award className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )}

            {/* ── Keyboard hints ── */}
            <div className="flex items-center justify-center gap-2 mt-4">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-300 font-medium bg-gray-50/50 px-3 py-1 rounded-full">
                    <Keyboard className="w-3 h-3" />
                    {!isRevealed
                        ? 'Space to reveal · ← → navigate · S shuffle'
                        : '1 Know It · 2 Almost · 3 Didn\'t Know · ← → navigate'
                    }
                </div>
            </div>
            
            {/* Final bottom spacer to ensure buttons aren't cut off in the workspace */}
            <div className="h-12" />
        </div>
    );
};

export default FlashcardsView;
