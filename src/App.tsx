import React, { useCallback, useEffect, useRef, useState, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Github, Linkedin, Moon, Sun, Trophy, Briefcase, GraduationCap, Rocket, Volume2, VolumeX } from "lucide-react";

const CuriosityMap = lazy(() => import("./VisitedPlacesMap"));

// ---------- Utility ----------
const cx = (...cls: (string | boolean | undefined)[]) => cls.filter(Boolean).join(" ");

// ---------- Balloon System ----------
function useAudioPop(volume = 0.06) {
  const ctxRef = useRef<AudioContext | null>(null);
  const volRef = useRef(volume);
  useEffect(() => { volRef.current = volume; }, [volume]);

  return async () => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      }
      const ctx = ctxRef.current!;
      if (ctx.state === "suspended") {
        // Safari/iOS sometimes starts suspended until a gesture
        await ctx.resume();
      }
      const now = ctx.currentTime;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.0001, volRef.current), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

      const bufferSize = 2048;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(volRef.current * 0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      noise.connect(noiseGain);
      noiseGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
      noise.start(now);
      noise.stop(now + 0.06);
    } catch { /* noop */ }
  };
}

type Balloon = {
  id: number;
  x: number; // vw
  size: number; // px
  hue: number; // color hue
  floatSec: number; // duration to float to top
  sway: number; // horizontal sway px
  swayDir: 1 | -1; // initial sway direction for phase variety
};

type Confetti = {
  id: number;
  x: number; // px from viewport left (fixed coords)
  y: number; // px from viewport top
  hue: number;
  angle: number; // launch angle in degrees
  dist: number; // travel distance px
};

function randomBalloon(idSeed: number): Balloon {
  const size = 38 + Math.random() * 34; // 38-72px
  return {
    id: idSeed,
    x: Math.random() * 96 + 2,
    size,
    hue: Math.floor(Math.random() * 360),
    // bigger balloons float slower (more air resistance)
    floatSec: 14 + ((size - 38) / 34) * 8,
    sway: 20 + Math.random() * 60,
    swayDir: Math.random() > 0.5 ? 1 : -1,
  };
}

function BalloonsLayer({ enabled, muted, onPop }: { enabled: boolean; muted: boolean; onPop: () => void }) {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [confettis, setConfettis] = useState<Confetti[]>([]);
  const pop = useAudioPop(muted ? 0 : 0.06);
  const idRef = useRef(1);
  const confettiIdRef = useRef(1);

  useEffect(() => {
    if (!enabled) { setBalloons([]); return; }
    setBalloons((b) => b.concat(Array.from({ length: 3 }, () => randomBalloon(idRef.current++))));
    const spawn = setInterval(
      () => setBalloons((b) => (b.length > 35 ? b : b.concat(randomBalloon(idRef.current++)))),
      1600
    );
    return () => clearInterval(spawn);
  }, [enabled]);

  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
      {/* Confetti burst particles */}
      <AnimatePresence>
        {confettis.map((c) => (
          <motion.div
            key={c.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: c.x,
              top: c.y,
              width: 7,
              height: 7,
              background: `hsl(${c.hue} 90% 62%)`,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos((c.angle * Math.PI) / 180) * c.dist,
              y: Math.sin((c.angle * Math.PI) / 180) * c.dist + 55,
              opacity: 0,
              scale: 0.2,
            }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            onAnimationComplete={() => setConfettis((p) => p.filter((x) => x.id !== c.id))}
          />
        ))}
      </AnimatePresence>

      {/* Balloons */}
      <AnimatePresence initial={false}>
        {balloons.map((bl) => {
          const bodyH = bl.size * 1.28;
          const containerH = bodyH + bl.size * 0.95;
          const d = bl.swayDir;

          return (
            <motion.button
              key={bl.id}
              className="absolute pointer-events-auto cursor-pointer select-none"
              style={{ left: `${bl.x}vw`, bottom: -containerH }}
              initial={{ y: 0, x: 0, scale: 1, opacity: 0.96 }}
              animate={{
                y: -window.innerHeight - containerH,
                x: [0, bl.sway * d, -bl.sway * d * 0.6, bl.sway * d * 0.4, 0],
                opacity: [0.96, 1, 0.98, 1],
              }}
              exit={{ scale: 0.2, opacity: 0, transition: { duration: 0.3, ease: "easeOut" } }}
              transition={{ duration: bl.floatSec, ease: "linear" }}
              onAnimationComplete={() => setBalloons((b) => b.filter((x) => x.id !== bl.id))}
              whileTap={{ scale: 0.8 }}
              onClick={async (e) => {
                e.stopPropagation();
                // capture position BEFORE any await — currentTarget is nullified after async yield
                const rect = e.currentTarget.getBoundingClientRect();
                try { await pop(); } catch { /* noop */ }
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const count = 9;
                setConfettis((p) => [
                  ...p,
                  ...Array.from({ length: count }, (_, i) => ({
                    id: confettiIdRef.current++,
                    x: cx,
                    y: cy,
                    hue: bl.hue + Math.random() * 60 - 30,
                    angle: (360 / count) * i + Math.random() * 20 - 10,
                    dist: 40 + Math.random() * 55,
                  })),
                ]);

                onPop();
                setBalloons((p) => p.filter((x) => x.id !== bl.id));
              }}
              aria-label="Pop balloon"
            >
              <div className="relative pointer-events-none" style={{ width: bl.size, height: containerH }}>
                {/* String */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 opacity-30 pointer-events-none"
                  style={{ top: bodyH - 1, width: 1.2, height: bl.size * 0.95, background: "rgba(17,17,17,0.9)", zIndex: 0 }}
                />
                {/* Balloon body */}
                <div
                  className="relative shadow-md pointer-events-none"
                  style={{
                    zIndex: 2,
                    width: bl.size,
                    height: bodyH,
                    borderRadius: "50% 50% 43% 43% / 62% 62% 38% 38%",
                    background: `radial-gradient(circle at 35% 28%, hsl(${bl.hue} 80% 95%) 0%, hsl(${bl.hue} 92% 72%) 34%, hsl(${bl.hue} 85% 58%) 74%, hsl(${bl.hue} 88% 50%) 100%)`,
                    filter: "saturate(1.05)",
                  }}
                />
                {/* Specular highlight */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    zIndex: 3,
                    top: bodyH * 0.18,
                    left: bl.size * 0.24,
                    width: bl.size * 0.22,
                    height: bl.size * 0.28,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.45)",
                    filter: "blur(4px)",
                  }}
                />
                {/* Knot */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                  style={{
                    zIndex: 3,
                    top: bodyH - bl.size * 0.015,
                    width: bl.size * 0.14,
                    height: bl.size * 0.14,
                    background: `hsl(${bl.hue} 88% 48%)`,
                    clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                  }}
                />
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ---------- Sections ----------
function Section({ id, title, icon, children }: { id: string; title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-6 flex items-center gap-3">
        {icon}
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx(
      "rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/65 dark:bg-zinc-900/40 backdrop-blur p-5 shadow-sm",
      className
    )}>
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-300/60 dark:border-zinc-700/80 px-3 py-1 text-xs font-medium">
      {children}
    </span>
  );
}

//

// ---------- Skills Grid with Logos & Sorting ----------
function LangLogo({ k }: { k: string }) {
  const size = 36;
  const common = { width: size, height: size, viewBox: "0 0 48 48", role: "img", "aria-hidden": true };
  const basePath = import.meta.env.BASE_URL;
  switch (k) {
    case "python":
      return (
        <svg {...common}>
          <image href={`${basePath}python-original.svg`} width={size} height={size} />
        </svg>
      );
    case "javascript":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="40" height="40" rx="6" fill="#F7DF1E" />
          <text x="11" y="33" fontFamily="ui-sans-serif, system-ui" fontWeight="800" fontSize="20" fill="#111">JS</text>
        </svg>
      );
    case "java":
      return (
        <svg {...common}>
          <path d="M18 34h12c0 4-12 4-12 0Z" fill="#0B84F3"/>
          <path d="M24 12c4 4-4 5 0 9c3 3-3 4 0 6" fill="none" stroke="#EA2D2E" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case "go":
      return (
        <svg {...common}>
          <image href={`${basePath}go-original.svg`} width={size} height={size} />
        </svg>
      );
    case "rust":
      return (
        <svg {...common}>
          <image href={`${basePath}rust-original.svg`} width={size} height={size} />
        </svg>
      );
    case "cpp":
      return (
        <svg {...common}>
          <image href={`${basePath}cpp.svg`} width={size} height={size} />
        </svg>
      );
    case "c":
      return (
        <svg {...common}>
          <image href={`${basePath}c-original.svg`} width={size} height={size} />
        </svg>
      );
    case "git":
      return (
        <svg {...common}>
          <image href={`${basePath}github-original.svg`} width={size} height={size} />
        </svg>
      );
    case "scala":
      return (
        <svg {...common}>
          <rect x="16" y="10" width="16" height="6" rx="2" fill="#DC322F" />
          <rect x="16" y="20" width="16" height="6" rx="2" fill="#DC322F" />
          <rect x="16" y="30" width="16" height="6" rx="2" fill="#DC322F" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M24 8l3 7l7 3l-7 3l-3 7l-3-7l-7-3l7-3z" fill="#F77700" />
        </svg>
      );
    case "sql":
      return (
        <svg {...common}>
          <ellipse cx="24" cy="12" rx="14" ry="6" fill="#1E88E5" />
          <rect x="10" y="12" width="28" height="18" fill="#1976D2" />
          <ellipse cx="24" cy="30" rx="14" ry="6" fill="#0D47A1" />
        </svg>
      );
    case "jupyter":
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="8" fill="#f5f5f5" />
          <path d="M10 18a16 8 0 0 1 28 0" fill="none" stroke="#FF7F2A" strokeWidth="3"/>
          <path d="M10 30a16 8 0 0 0 28 0" fill="none" stroke="#FF7F2A" strokeWidth="3"/>
        </svg>
      );
    default:
      return null;
  }
}

interface Skill {
  key: string;
  name: string;
  years: number | null; // null -> 'familiar'
  market: number;
}

function SkillBadge({ skill }: { skill: Skill }) {
  return (
    <motion.div
      className="flex items-center gap-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/40 px-3 py-2 hover:shadow-md transition-all duration-200"
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <LangLogo k={skill.key} />
      <div className="leading-tight">
        <div className="text-sm font-medium">{skill.name}</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {skill.years ? `${skill.years} ${skill.years > 1 ? "yrs" : "yr"}` : "familiar"}
        </div>
      </div>
    </motion.div>
  );
}

function LanguagesGrid() {
  // fixed order by market value
  const skills: Skill[] = [
    { key: "python",     name: "Python",     years: 2,    market: 95 },
    { key: "javascript", name: "JavaScript", years: 1,    market: 94 },
    { key: "java",       name: "Java",       years: 1,    market: 92 },
    { key: "sql",        name: "SQL",        years: 2,    market: 90 },
    { key: "go",         name: "Go",         years: 1,    market: 88 },
    { key: "rust",       name: "Rust",       years: 1,    market: 86 },
    { key: "cpp",        name: "C++",        years: 5,    market: 85 },
    { key: "c",          name: "C",          years: 2,    market: 80 },
    { key: "scala",      name: "Scala",      years: 2,    market: 78 },
    { key: "spark",      name: "Spark",      years: 2,    market: 76 },
    { key: "jupyter",    name: "Jupyter",    years: 2,    market: 70 },
    { key: "git",        name: "Git",        years: 5,    market: 68 },
    
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {skills.map((s) => <SkillBadge key={s.key} skill={s} />)}
      </div>
    </div>
  );
}

// ---------- Main Component ----------
export default function Portfolio() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const dark = theme === "dark";
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", theme);
  }, [theme, dark]);

  // Respect prefers-reduced-motion — users can still opt in via toggle
  const [balloonsOn, setBalloonsOn] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  });
  const [muted, setMuted] = useState(false);
  const [popCount, setPopCount] = useState(0);
  const handlePop = useCallback(() => setPopCount((n) => n + 1), []);

  // Active nav section via IntersectionObserver
  const [activeSection, setActiveSection] = useState("");
  useEffect(() => {
    const sections = ["experience", "awards", "projects", "skills", "education"];
    const observers = sections.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const ob = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
      );
      ob.observe(el);
      return ob;
    });
    return () => observers.forEach((ob) => ob?.disconnect());
  }, []);

  // Scroll-to-top button visibility
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nav = [
    { href: "#experience", label: "Experience" },
    { href: "#awards", label: "Awards" },
    { href: "#projects", label: "Projects" },
    { href: "#skills", label: "Skills" },
    { href: "#education", label: "Education" },
  ];

  const pillCls = "rounded-full border border-zinc-300/60 dark:border-zinc-700/80 px-3 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors";

  return (
    <div className="relative min-h-screen text-zinc-800 dark:text-zinc-100">
      {/* Backdrop */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-sky-50 to-white dark:from-[#0b1020] dark:via-[#0b1020] dark:to-[#0b1020]" />
      <div className="fixed inset-0 -z-10 opacity-50 mix-blend-overlay" style={{ backgroundImage: "radial-gradient(1000px 500px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(1000px 600px at 80% 110%, rgba(99,102,241,0.18), transparent 60%)" }} />

      {/* Balloons */}
      {balloonsOn && <BalloonsLayer enabled={balloonsOn} muted={muted} onPop={handlePop} />}

      {/* Scroll-to-top FAB */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Scroll to top"
            className="fixed bottom-6 right-6 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/80 shadow-md hover:shadow-lg transition-shadow"
          >
            <ArrowUp size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/60 dark:bg-zinc-900/40 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <a href="#top" className="font-semibold tracking-tight text-lg">Naim Shaikhzadeh</a>
          <nav className="hidden md:flex items-center gap-6">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className={cx(
                  "text-sm transition-all duration-150",
                  activeSection === n.href.slice(1)
                    ? "text-zinc-900 dark:text-white font-medium"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              aria-label="Toggle balloons"
              onClick={() => setBalloonsOn((v) => !v)}
              className={pillCls}
            >
              {balloonsOn ? `🎈 ${popCount} · turn off` : "Balloons: Off"}
            </button>
            <button
              aria-label={muted ? "Unmute pops" : "Mute pops"}
              onClick={() => setMuted((m) => !m)}
              className={cx(pillCls, "inline-flex items-center gap-1")}
            >
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              <span className="hidden lg:inline">{muted ? "Muted" : "Sound"}</span>
            </button>
            <button
              aria-label="Toggle theme"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={cx(pillCls, "inline-flex items-center gap-1")}
            >
              {dark ? <Sun size={13} /> : <Moon size={13} />}
              <span className="hidden lg:inline">{dark ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main id="top" className="mx-auto max-w-6xl px-4">
        <section className="py-12 md:py-20">
          <div className="grid items-center gap-10 md:grid-cols-3">
            <div className="md:col-span-2">
              <motion.h1 
                className="text-4xl md:text-6xl font-bold tracking-tight leading-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                Building reliable systems for{" "}
                <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  performance and people
                </span>
                .
              </motion.h1>
              <motion.p 
                className="mt-6 text-lg md:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                Software engineer and competitive programmer with experience in risk/fraud systems, big data, and concurrent algorithms. Two-time ICPC World Finalist and NASA Space Apps Global Winner.
              </motion.p>
              <motion.div 
                className="mt-8 flex flex-wrap items-center gap-4"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                <a href="https://github.com/NaimSS" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 rounded-full bg-black dark:bg-white text-white dark:text-black px-6 py-3 text-sm font-medium hover:scale-105 transition-transform duration-200">
                  <Github size={16} /> GitHub
                </a>
                <a href="https://www.linkedin.com/in/naimsantos" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 px-6 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors duration-200">
                  <Linkedin size={16} /> LinkedIn
                </a>
              </motion.div>
              <motion.div 
                className="mt-6 text-sm text-zinc-500 dark:text-zinc-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              >
                💡 Tip: click the balloons to pop them ✨
              </motion.div>
            </div>
            <div className="md:col-span-1">
              <Card>
                <div className="text-sm leading-relaxed">
                  <div className="mb-2 font-semibold">Now</div>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Rocket size={16} className="mt-1 shrink-0" />
                      <div>
                        <div className="font-medium">Coinbase</div>
                        <div className="text-xs text-zinc-500">Backend Software Engineer • 2025-present</div>
                      </div>
                    </li>
                    {/* Split achievements */}
                    <li className="flex items-start gap-2">
                      <Trophy size={16} className="mt-1 shrink-0" />
                      <div>
                        <div className="font-medium">ICPC</div>
                        <div className="text-xs text-zinc-500">World Finals x2 (2022, 2024)</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <Trophy size={16} className="mt-1 shrink-0" />
                      <div>
                        <div className="font-medium">NASA Space Apps</div>
                        <div className="text-xs text-zinc-500">Global Winner (Top 10) • 2023</div>
                      </div>
                    </li>
                  </ul>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Experience */}
        <Section id="experience" title="Experience" icon={<Briefcase className="h-6 w-6" /> }>
          <Card>
            {/* coinbase */}
  
            <div className="grid gap-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Coinbase</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Software Engineer • Apr 2025-present • Remote</p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    <li>Backend Software Engineer (Go): design, build, and operate services that detect and prevent fraud at scale.</li>
                  </ul>
                </div>
              </div>

              <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />
              {/* Griaule */ }
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Griaule</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Software Engineer • Aug 2024-Apr 2025</p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    <li>Research + backend work at Brazil’s largest biometric provider (fingerprint and face).</li>
                    <li>Built reproducible workflows to train and evaluate AI models for fingerprint alignment/feature extraction and face liveness detection.</li>
                    <li>Integrated high-performance C++ biometric libraries into backend services and user applications via WebAssembly (WASM).</li>
                  </ul>
                </div>
              </div>

              <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />
              {/* Huawei */ }

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Huawei - Dresden Research Center</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Research Intern • Jan 2024 - Jul 2024 • Dresden, Germany</p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    <li>Worked on tools for debugging concurrent algorithms via thread-interleaving simulation.</li>
                    <li>Re-implemented a state-of-the-art stateless model checking algorithm on a new scheduling paradigm.</li>
                    <li>Optimized the engine to skip uninformative paths, achieving <span className="font-medium">3-10x</span> faster verification in most scenarios (Rust & C).</li>
                  </ul>
                </div>
              </div>

              <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />

              {/* Incognia */ }

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Incognia</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Software Engineer Intern / Junior • Apr 2022 - Jul 2023 • Remote </p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    <li>Built big data pipelines for fraud prevention (Spark & Scala).</li>
                    <li>Enabled richer feature extraction and analyzed impact using Jupyter, Spark SQL.</li>
                    <li>Refactored a fragile workflow, eliminating weekly crashes and improving reliability.</li>
                  </ul>
                </div>
              </div>

              <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />

              {/* Competitive programming */ }

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">UNICAMP — Competitive Programming Teacher</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">May 2021, May 2022, Dec 2022, Dec 2023</p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    <li>Taught algorithms & data structures in training camps.</li>
                    <li>Co-authored IOI selection tests (statements, test data, official & invalid solutions).</li>
                    <li>Supported students who went on to win 6 🥈 & 6 🥉 at IOI.</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* Awards */}
        <Section id="awards" title="Awards" icon={<Trophy className="h-6 w-6" /> }>
          <Card>
            <ul className="grid gap-2 text-sm md:grid-cols-2">
              <li>ICPC World Finals — Egypt (2024) — Successful participation</li>
              <li>NASA International Space Apps Challenge (2023) — <span className="font-semibold">Global Winner (Top 10)</span></li>
              <li>ICPC World Finals — Bangladesh (2022) — Successful participation</li>
              <li>ICPC Brazil Regional (2023) — <span className="font-semibold">Gold</span> (3rd of 60)</li>
              <li>ICPC Brazil Subregional (2023) — <span className="font-semibold">1st</span> of 556 teams</li>
              <li>ICPC Brazil Regional (2021) — <span className="font-semibold">Gold</span> (2nd of 64)</li>
              <li>ICPC Brazil Subregional (2021) — <span className="font-semibold">1st</span> of 764 teams</li>
              <li>Brazilian Olympiad in Informatics (OBI, 2020) — <span className="font-semibold">1st</span> of 1512</li>
            </ul>
          </Card>
        </Section>

        {/* Projects */}
        <Section id="projects" title="Projects" icon={<Rocket className="h-6 w-6" /> }>
          <Card>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="font-semibold">MaratonIC</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Mar 2020 - Present</p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  <li>University group focused on Algorithms & Data Structures.</li>
                  <li>Taught C++ and competitive programming; organized major university contests.</li>
                    <li>As competitor: two gold medals 🥇; invited to ICPC World Finals (2022, 2024).</li>
                    <li>As coach: led teams to gold (🥇 x3) and bronze (🥉 x3), and 2 times to ICPC World Finals</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">NASA Space Apps — “Greetings from Earth”</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Oct 2023</p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  <li>Interactive React website teaching the importance of oceans.</li>
                  <li>Team project published via GitHub Pages.</li>
                  <li>Recognized as <span className="font-medium">Global Winners</span> (Top 10).</li>
                </ul>
                <div className="mt-3">
                  <a href="https://www.spaceappschallenge.org/2023/find-a-team/greetings-from-earth1/" target="_blank" rel="noopener noreferrer" className="text-sm underline opacity-80 hover:opacity-100">Project page ↗</a>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* Skills */}
        <Section id="skills" title="Skills">
          <Card>
            {/* Sort + Logos grid */}
            <LanguagesGrid />
            <div className="mt-5 h-px bg-zinc-200/70 dark:bg-zinc-800/70" />
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold opacity-80">Other</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                <Pill>Risk/Fraud</Pill>
                <Pill>Concurrency</Pill>
                <Pill>Big Data</Pill>
                <Pill>Distributed Systems</Pill>
              </div>
            </div>
          </Card>
        </Section>

        {/* Education */}
        <Section id="education" title="Education" icon={<GraduationCap className="h-6 w-6" /> }>
          <Card>
            <div>
              <h3 className="font-semibold">Universidade Estadual de Campinas (UNICAMP)</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">B.Sc. in Computer Engineering • Graduation: 2025 • GPA 9.6/10</p>
            </div>
          </Card>
        </Section>

        {/* Places visited */ }
        <Suspense fallback={<div className="h-[520px] rounded-2xl bg-zinc-100 dark:bg-zinc-900/40 animate-pulse" />}>
          <CuriosityMap />
        </Suspense>

        {/* Footer */}
        <footer className="py-12" aria-label="footer">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <div>© {new Date().getFullYear()} Naim Shaikhzadeh</div>
            <div className="flex items-center gap-4">
              <a className="inline-flex items-center gap-1 hover:opacity-90" href="https://github.com/NaimSS" target="_blank" rel="noopener noreferrer"><Github size={16} /> GitHub</a>
              <a className="inline-flex items-center gap-1 hover:opacity-90" href="https://www.linkedin.com/in/naimsantos" target="_blank" rel="noopener noreferrer"><Linkedin size={16} /> LinkedIn</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
// Note: This was vibe coded :)
