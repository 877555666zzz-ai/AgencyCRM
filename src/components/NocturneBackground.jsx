import { useEffect, useRef } from "react";

/* ============================================================================
   NocturneBackground — animated canvas backdrop, theme-aware.
   • dark  : drifting glow stars + slow blue nebulae over a dark wash.
   • light : very delicate pale-blue motes, no dark wash — stays clean + airy.
   Mount once behind the app (give the app position:relative; z-index:1):
       <NocturneBackground theme={theme} />
   Perf: capped DPR, count scaled to area, pauses when tab hidden, light pointer
   parallax, honours prefers-reduced-motion (single static frame). Re-inits when
   `theme` changes.
   ============================================================================ */
export default function NocturneBackground({ theme = "dark" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const light = theme === "light";

    let W = 0, H = 0, DPR = 1, stars = [], nebulae = [], raf = null, running = true;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const rand = (a, b) => a + Math.random() * (b - a);

    // palette per theme
    const STAR = light ? [60, 130, 190] : [214, 228, 244];
    const STAR_A = light ? 0.16 : 0.6;
    const ACCENT = [45, 156, 219];
    const ACCENT_A = light ? 0.10 : 0.5;
    const DENSITY = light ? 22000 : 14000;     // larger = fewer particles
    const CAP = light ? 90 : 140;

    function build() {
      DPR = Math.min(window.devicePixelRatio || 1, 1.6);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const target = Math.min(CAP, Math.round((W * H) / DENSITY));
      stars = new Array(target).fill(0).map(() => ({
        x: rand(0, W), y: rand(0, H), z: rand(0.25, 1), r: rand(0.5, 1.7),
        tw: rand(0, Math.PI * 2), tws: rand(0.6, 1.8),
        vx: rand(-0.08, 0.08), vy: rand(-0.05, 0.05),
      }));
      nebulae = light
        ? [
            { x: W * 0.20, y: H * 0.22, r: Math.max(W, H) * 0.40, col: ACCENT, a: 0.05, t: rand(0, 6.28), spd: 0.00008 },
            { x: W * 0.82, y: H * 0.78, r: Math.max(W, H) * 0.46, col: [120, 180, 230], a: 0.05, t: rand(0, 6.28), spd: 0.00006 },
          ]
        : [
            { x: W * 0.18, y: H * 0.24, r: Math.max(W, H) * 0.42, col: ACCENT, a: 0.16, t: rand(0, 6.28), spd: 0.00009 },
            { x: W * 0.82, y: H * 0.72, r: Math.max(W, H) * 0.50, col: [88, 120, 230], a: 0.13, t: rand(0, 6.28), spd: 0.00007 },
            { x: W * 0.62, y: H * 0.12, r: Math.max(W, H) * 0.34, col: [30, 90, 160], a: 0.12, t: rand(0, 6.28), spd: 0.00011 },
          ];
    }
    function drawNebula(n, now) {
      const px = n.x + Math.cos(now * n.spd + n.t) * (W * 0.04) + pointer.x * 13;
      const py = n.y + Math.sin(now * n.spd * 1.3 + n.t) * (H * 0.04) + pointer.y * 13;
      const g = ctx.createRadialGradient(px, py, 0, px, py, n.r);
      const [r, gg, b] = n.col;
      g.addColorStop(0, `rgba(${r},${gg},${b},${n.a})`);
      g.addColorStop(0.45, `rgba(${r},${gg},${b},${n.a * 0.35})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, n.r, 0, Math.PI * 2); ctx.fill();
    }
    function frame(now) {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      if (!light) {
        const base = ctx.createLinearGradient(0, 0, 0, H);
        base.addColorStop(0, "rgba(13,20,34,0)"); base.addColorStop(1, "rgba(8,12,22,0.45)");
        ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = light ? "source-over" : "lighter";
      for (const n of nebulae) drawNebula(n, now);
      pointer.x += (pointer.tx - pointer.x) * 0.04; pointer.y += (pointer.ty - pointer.y) * 0.04;
      const [sr, sg, sb] = STAR, [ar, ag, ab] = ACCENT;
      for (const s of stars) {
        s.x += s.vx * s.z; s.y += s.vy * s.z;
        if (s.x < -4) s.x = W + 4; if (s.x > W + 4) s.x = -4;
        if (s.y < -4) s.y = H + 4; if (s.y > H + 4) s.y = -4;
        const tw = 0.55 + 0.45 * Math.sin(now * 0.001 * s.tws + s.tw);
        const px = s.x + pointer.x * 26 * s.z, py = s.y + pointer.y * 26 * s.z, rr = s.r * s.z;
        const accentish = s.z > 0.82;
        ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2);
        ctx.fillStyle = accentish ? `rgba(${ar},${ag},${ab},${ACCENT_A * tw})` : `rgba(${sr},${sg},${sb},${STAR_A * tw})`;
        ctx.fill();
        if (!light && s.z > 0.7) {
          ctx.beginPath(); ctx.arc(px, py, rr * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = accentish ? `rgba(${ar},${ag},${ab},${0.06 * tw})` : `rgba(180,205,235,${0.05 * tw})`;
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }
    function staticFrame() {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = light ? "source-over" : "lighter";
      for (const n of nebulae) drawNebula(n, 0);
      const [sr, sg, sb] = STAR;
      for (const s of stars) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${sr},${sg},${sb},${STAR_A * 0.8})`; ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    const onMove = (e) => { pointer.tx = (e.clientX / window.innerWidth) * 2 - 1; pointer.ty = (e.clientY / window.innerHeight) * 2 - 1; };
    const onResize = () => { build(); if (reduce) staticFrame(); };
    const onVis = () => {
      if (document.hidden) { running = false; if (raf) cancelAnimationFrame(raf); }
      else if (!reduce) { running = true; raf = requestAnimationFrame(frame); }
    };

    build();
    if (reduce) { staticFrame(); }
    else { window.addEventListener("pointermove", onMove, { passive: true }); document.addEventListener("visibilitychange", onVis); raf = requestAnimationFrame(frame); }
    window.addEventListener("resize", onResize);

    return () => {
      running = false; if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [theme]);

  return (
    <canvas ref={canvasRef} aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />
  );
}
