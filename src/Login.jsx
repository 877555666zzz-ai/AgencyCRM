import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "./lib/api";
import NocturneBackground from "./components/NocturneBackground";
import { useTheme, ThemeToggle } from "./components/theme";

/* ============================================================================
   Login — AgencyCRM (dark "Nocturne" + light "Daylight", token-driven).
   ============================================================================ */
const FONT = "Inter, system-ui, sans-serif";

export default function Login() {
  const { theme } = useTheme();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setMsg(""); setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await auth.signIn(email.trim(), password);
        if (error) setErr(error.message);
      } else {
        const { error } = await auth.signUp(email.trim(), password, name.trim());
        if (error) setErr(error.message);
        else setMsg("Аккаунт создан. Если включено подтверждение почты — проверьте письмо, затем войдите.");
      }
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };

  const label = { fontSize: 12.5, fontWeight: 600, color: "var(--c-muted)", marginBottom: 7, letterSpacing: 0.1 };

  return (
    <div style={{ position: "relative", minHeight: "100vh", fontFamily: FONT, color: "var(--c-text)", overflow: "hidden" }}>
      <NocturneBackground theme={theme} />

      {/* theme toggle, top-right */}
      <div style={{ position: "fixed", top: 20, right: 22, zIndex: 5 }}><ThemeToggle /></div>

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <motion.div
          className="n-glass"
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
          style={{ width: 404, borderRadius: 22, padding: "38px 36px", position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,var(--c-blue),transparent)", opacity: 0.7 }} />

          {/* logo — текстовый AgencyCRM */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 26, color: "var(--c-text)" }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--c-text)" }}>
              Agency<span style={{ color: "var(--c-blue)" }}>CRM</span>
            </span>
          </div>

          <div style={{ fontWeight: 800, fontSize: 23, letterSpacing: -0.4, marginBottom: 6 }}>
            {mode === "signin" ? "Вход" : "Регистрация"}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--c-muted)", marginBottom: 26 }}>
            {mode === "signin" ? "Войдите в рабочее пространство" : "Создайте аккаунт сотрудника"}
          </div>

          <AnimatePresence initial={false}>
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.28 }}
                style={{ overflow: "hidden" }}
              >
                <div style={label}>Имя</div>
                <input className="n-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия" />
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ marginBottom: 16 }}>
            <div style={label}>Email</div>
            <input className="n-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.kz" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={label}>Пароль</div>
            <input className="n-in" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••" />
          </div>

          <AnimatePresence>
            {err && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ color: "var(--c-red)", fontSize: 13, marginBottom: 12, background: "color-mix(in srgb, var(--c-red) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--c-red) 35%, transparent)", borderRadius: 9, padding: "9px 12px" }}>{err}</motion.div>
            )}
            {msg && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ color: "var(--c-blue-dark)", fontSize: 13, marginBottom: 12, background: "var(--c-blue-soft)", border: "1px solid rgba(45,156,219,0.3)", borderRadius: 9, padding: "9px 12px", lineHeight: 1.45 }}>{msg}</motion.div>
            )}
          </AnimatePresence>

          <button className="n-btn n-btn-primary" onClick={submit} disabled={busy}
            style={{ width: "100%", padding: "13px", fontSize: 14.5, opacity: busy ? 0.8 : 1 }}>
            {busy
              ? <span style={{ width: 16, height: 16, borderRadius: 16, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "var(--c-on-accent)", display: "inline-block", animation: "nSpin .7s linear infinite" }} />
              : (mode === "signin" ? "Войти" : "Зарегистрироваться")}
          </button>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--c-muted)" }}>
            {mode === "signin" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
            <span onClick={() => { setErr(""); setMsg(""); setMode(mode === "signin" ? "signup" : "signin"); }}
              style={{ color: "var(--c-blue-dark)", fontWeight: 700, cursor: "pointer" }}>
              {mode === "signin" ? "Зарегистрироваться" : "Войти"}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}