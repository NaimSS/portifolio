import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Linkedin, Mail, Moon, Sun, Trophy, Briefcase, GraduationCap, Rocket } from "lucide-react";

// ---------- Utility ----------
const cx = (...cls) => cls.filter(Boolean).join(" ");

// ---------- Balloon System ----------
function useAudioPop(volume = 0.06) {
  const ctxRef = useRef<AudioContext | null>(null);
  const volRef = useRef(volume);
  useEffect(() => { volRef.current = volume; }, [volume]);

  return () => {
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = ctxRef.current!;
      const now = ctx.currentTime;

      // A tiny "pop" made with a short burst (click + damped sine)
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volRef.current, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      // Oscillator body
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

      // Add a short noise burst for the initial transient
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
};

function randomBalloon(idSeed: number): Balloon {
  const size = 36 + Math.random() * 36; // 36-72px
  return {
    id: idSeed,
    x: Math.random() * 96 + 2, // 2-98 vw
    size,
    hue: Math.floor(Math.random() * 360),
    floatSec: 10 + Math.random() * 10, // 10-20s
    sway: 20 + Math.random() * 60, // 20-80px
  };
}

function BalloonsLayer({ enabled, muted }: { enabled: boolean; muted: boolean }) {
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const pop = useAudioPop(muted ? 0 : 0.06);
  const idRef = useRef(1);

  useEffect(() => {
    if (!enabled) return; // pause spawn but keep existing
    // spawn a handful initially
    const initial: Balloon[] = Array.from({ length: 12 }, () => randomBalloon(idRef.current++));
    setBalloons((b) => [...b, ...initial]);

    const spawn = setInterval(() => {
      setBalloons((b) => (b.length > 35 ? b : [...b, randomBalloon(idRef.current++)]));
    }, 1600);
    return () => clearInterval(spawn);
  }, [enabled]);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      <AnimatePresence initial={false}>
        {balloons.map((bl) => (
          <motion.button
            key={bl.id}
            className="absolute pointer-events-auto"
            style={{ left: `${bl.x}vw`, bottom: -bl.size }}
            initial={{ y: 0, x: 0, scale: 1, opacity: 0.9 }}
            animate={{
              y: -window.innerHeight - 200,
              x: [0, bl.sway, -bl.sway * 0.6, bl.sway * 0.4, 0],
              opacity: [0.9, 1, 0.95, 1],
            }}
            transition={{ duration: bl.floatSec, ease: "linear" }}
            onAnimationComplete={() => setBalloons((b) => b.filter((x) => x.id !== bl.id))}
            onClick={(e) => {
              e.stopPropagation();
              pop();
              // pop animation by removing with scale effect
              setBalloons((b) => b.filter((x) => x.id !== bl.id));
            }}
          >
            {/* Balloon body */}
            <div
              className="relative"
              style={{ width: bl.size, height: bl.size * 1.25 }}
            >
              <div
                className="rounded-full shadow-md"
                style={{
                  width: "100%",
                  height: "100%",
                  background: `radial-gradient(circle at 35% 28%, hsl(${bl.hue} 80% 95%) 0%, hsl(${bl.hue} 95% 70%) 35%, hsl(${bl.hue} 85% 55%) 75%, hsl(${bl.hue} 90% 50%) 100%)`,
                  filter: "saturate(1.1)",
                }}
              />
              {/* Knot */}
              <div
                className="absolute left-1/2 -bottom-1 -translate-x-1/2"
                style={{
                  width: bl.size * 0.12,
                  height: bl.size * 0.12,
                  background: `hsl(${bl.hue} 90% 50%)`,
                  clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                }}
              />
              {/* String */}
              <div
                className="absolute left-1/2 -bottom-6 -translate-x-1/2 opacity-30"
                style={{ width: 1, height: bl.size * 0.9, background: "#111" }}
              />
            </div>
          </motion.button>
        ))}
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

// ---------- Main Component ----------
export default function Portfolio() {
  const [dark, setDark] = useState(true);
  const [balloonsOn, setBalloonsOn] = useState(true);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark"); else root.classList.remove("dark");
  }, [dark]);

  const nav = [
    { href: "#experience", label: "Experience" },
    { href: "#awards", label: "Awards" },
    { href: "#projects", label: "Projects" },
    { href: "#skills", label: "Skills" },
    { href: "#education", label: "Education" },
  ];

  return (
    <div className="relative min-h-screen text-zinc-800 dark:text-zinc-100">
      {/* Backdrop */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-sky-50 to-white dark:from-[#0b1020] dark:via-[#0b1020] dark:to-[#0b1020]" />
      <div className="fixed inset-0 -z-10 opacity-50 mix-blend-overlay" style={{ backgroundImage: "radial-gradient(1000px 500px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(1000px 600px at 80% 110%, rgba(99,102,241,0.18), transparent 60%)" }} />

      {/* Balloons */}
      {balloonsOn && <BalloonsLayer enabled={balloonsOn} muted={muted} />}

      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-900/40 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <a href="#top" className="font-semibold tracking-tight text-lg">Naim Shaikhzadeh</a>
          <nav className="hidden md:flex items-center gap-6">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="text-sm hover:opacity-90">{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              aria-label="Toggle balloons"
              onClick={() => setBalloonsOn((v) => !v)}
              className="rounded-full border border-zinc-300/60 dark:border-zinc-700/80 px-3 py-1 text-xs"
            >
              {balloonsOn ? "Balloons: On" : "Balloons: Off"}
            </button>
            <button
              aria-label="Mute pops"
              onClick={() => setMuted((m) => !m)}
              className="rounded-full border border-zinc-300/60 dark:border-zinc-700/80 px-3 py-1 text-xs"
            >
              {muted ? "Sound: Off" : "Sound: On"}
            </button>
            <button
              aria-label="Toggle theme"
              onClick={() => setDark((d) => !d)}
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-zinc-300/60 dark:border-zinc-700/80 px-3 py-1 text-xs"
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}<span>{dark ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main id="top" className="mx-auto max-w-6xl px-4">
        <section className="py-10 md:py-16">
          <div className="grid items-center gap-8 md:grid-cols-3">
            <div className="md:col-span-2">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
                Building reliable systems for risk, performance, and people.
              </h1>
              <p className="mt-4 text-base md:text-lg text-zinc-600 dark:text-zinc-300">
                Software engineer and competitive programmer with experience in risk/fraud systems, big data, and concurrent algorithms. Two-time ICPC World Finalist and NASA Space Apps Global Winner.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href="https://github.com/NaimSS" target="_blank" className="group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                  <Github size={16} /> GitHub
                </a>
                <a href="https://www.linkedin.com/in/naimsantos" target="_blank" className="group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                  <Linkedin size={16} /> LinkedIn
                </a>
              </div>
              <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                Tip: click the balloons to pop them ✨
              </div>
            </div>
            <div className="md:col-span-1">
              <Card>
                <div className="text-sm leading-relaxed">
                  <div className="mb-2 font-semibold">Now</div>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Rocket size={16} className="mt-1 shrink-0" />
                      <div>
                        <div className="font-medium">Coinbase — Risk Team</div>
                        <div className="text-xs text-zinc-500">Software Engineer • 2025–present</div>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <Trophy size={16} className="mt-1 shrink-0" />
                      <div>
                        <div className="font-medium">ICPC & Space Apps</div>
                        <div className="text-xs text-zinc-500">World Finals (×2) • Global Winner</div>
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
            <div className="grid gap-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Coinbase — Risk Team</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Software Engineer • 2025–present • Remote</p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    <li>Contributing to risk and fraud detection systems at scale.</li>
                    <li>Collaborating across Risk, Data, and Platform to improve reliability and signal quality.</li>
                  </ul>
                </div>
              </div>

              <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Huawei Research (Dresden, Germany)</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Research Intern • Jan 2024 – Jul 2024</p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    <li>Worked on tools for debugging concurrent algorithms via thread-interleaving simulation.</li>
                    <li>Re-implemented a state-of-the-art stateless model checking algorithm on a new scheduling paradigm.</li>
                    <li>Optimized the engine to skip uninformative paths, achieving <span className="font-medium">3–10×</span> faster verification in most scenarios (Rust & C).</li>
                  </ul>
                </div>
              </div>

              <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Incognia (São Paulo, Brazil)</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Software Engineer Intern / Junior • Apr 2022 – Jul 2023</p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    <li>Built big data pipelines for fraud prevention (Spark & Scala).</li>
                    <li>Enabled richer feature extraction and analyzed impact using Jupyter, Spark SQL.</li>
                    <li>Refactored a fragile workflow, eliminating weekly crashes and improving reliability.</li>
                  </ul>
                </div>
              </div>

              <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />

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
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Mar 2020 – Present</p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  <li>University group focused on Algorithms & Data Structures.</li>
                  <li>Taught C++ and competitive programming; organized major university contests.</li>
                  <li>As competitor: two gold medals; invited to ICPC World Finals (2022, 2024).</li>
                  <li>As coach: led teams to gold and silver.</li>
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
                  <a href="https://www.spaceappschallenge.org/2023/find-a-team/greetings-from-earth1/" target="_blank" className="text-sm underline opacity-80 hover:opacity-100">Project page ↗</a>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* Skills */}
        <Section id="skills" title="Skills">
          <Card>
            <div className="flex flex-wrap gap-2 text-sm">
              <Pill>⚙️ 5 yrs — C++</Pill>
              <Pill>🧮 2 yrs — Scala</Pill>
              <Pill>🧊 2 yrs — Spark</Pill>
              <Pill>🧵 2 yrs — C</Pill>
              <Pill>🐍 2 yrs — Python</Pill>
              <Pill>🌐 1 yr — JavaScript</Pill>
              <Pill>☕ 1 yr — Java</Pill>
              <Pill>🗃️ SQL</Pill>
              <Pill>🧪 Jupyter</Pill>
              <Pill>🔐 Risk/Fraud</Pill>
              <Pill>🔄 Concurrency</Pill>
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

        {/* Footer */}
        <footer className="py-12" aria-label="footer">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <div>© {new Date().getFullYear()} Naim Shaikhzadeh</div>
            <div className="flex items-center gap-4">
              <a className="inline-flex items-center gap-1 hover:opacity-90" href="https://github.com/NaimSS" target="_blank"><Github size={16} /> GitHub</a>
              <a className="inline-flex items-center gap-1 hover:opacity-90" href="https://www.linkedin.com/in/naimsantos" target="_blank"><Linkedin size={16} /> LinkedIn</a>
              <a className="inline-flex items-center gap-1 hover:opacity-90" href="mailto:naimsantos2002@gmail.com" target="_blank"><Mail size={16} /> Email</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
