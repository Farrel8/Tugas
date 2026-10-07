import { useState, useEffect, useRef } from "react";
import "./App.css";

const MOODS = [
  { id: "santai", label: "Santai", color: "#3f8f8b" },
  { id: "semangat", label: "Semangat", color: "#e0533d" },
  { id: "galau", label: "Galau", color: "#6f74c4" },
  { id: "nostalgia", label: "Nostalgia", color: "#d9a441" },
];
const MAX_LAGU = 8;
const ARM_BASE = 21; // sudut jarum pada alur terluar (derajat)
const ARM_STEP = 2; // pergeseran sudut per lagu
const SPEED = 240; // derajat per detik

const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };

// Warna otomatis dari teks suasana
const autoColor = (s) => {
  const h = [...s.toLowerCase()].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const l = 0.52, a = 0.6 * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export default function App() {
  const [tab, setTab] = useState("susun");
  const [playing, setPlaying] = useState(false); // jarum diperintah turun
  const [down, setDown] = useState(false); // jarum sudah mendarat
  const [nama, setNama] = useState("");
  const [pembuat, setPembuat] = useState("");
  const [mood, setMood] = useState(MOODS[0]);
  const [lagu, setLagu] = useState([]);
  const [aktif, setAktif] = useState(0);
  const [judul, setJudul] = useState("");
  const [artis, setArtis] = useState("");
  const [customMoods, setCustomMoods] = useState(() => load("vinyl.moods", []));
  const [moodBaru, setMoodBaru] = useState("");
  const [warnaManual, setWarnaManual] = useState(null);
  const [koleksi, setKoleksi] = useState(() => load("vinyl.playlists", []));
  const [editId, setEditId] = useState(null);
  const [newId, setNewId] = useState(null);
  const [error, setError] = useState("");
  const discRef = useRef(null);
  const spin = useRef({ a: 0, v: 0, target: 0 });
  const armRef = useRef(null);
  const arm = useRef({ a: 0, v: 0, t: 0 });
  const landed = useRef(false);
  const playingRef = useRef(false);

  const idx = lagu.length ? aktif % lagu.length : -1;
  const now = idx >= 0 ? lagu[idx] : null;
  const open = down || tab === "koleksi";
  const warnaMood = warnaManual || autoColor(moodBaru);

  useEffect(() => store("vinyl.moods", customMoods), [customMoods]);
  useEffect(() => store("vinyl.playlists", koleksi), [koleksi]);

  // Target sudut jarum; status "mendarat" ditentukan oleh loop animasi di bawah
  useEffect(() => {
    playingRef.current = playing;
    if (!playing) { landed.current = false; setDown(false); }
  }, [playing]);

  useEffect(() => {
    arm.current.t = playing ? ARM_BASE + Math.max(idx, 0) * ARM_STEP : 0;
  }, [playing, idx]);

  // Piringan berputar setelah jarum mendarat
  useEffect(() => {
    spin.current.target = down ? SPEED : 0;
  }, [down]);

  useEffect(() => {
    let last = performance.now(), id;
    const tick = (t) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      // Piringan: kecepatan naik dan turun bertahap
      const s = spin.current;
      s.v += (s.target - s.v) * Math.min(1, dt * (s.target ? 1.4 : 0.9));
      s.a = (s.a + s.v * dt) % 360;
      if (discRef.current) discRef.current.style.transform = `rotate(${s.a}deg)`;

      // Jarum: gerak pegas teredam (mengayun pelan, sedikit melampaui, lalu menetap)
      const r = arm.current;
      const acc = 5 * (r.t - r.a) - 2.9 * r.v;
      r.v += acc * dt;
      r.a += r.v * dt;
      if (armRef.current) armRef.current.style.transform = `rotate(${r.a}deg)`;
      if (playingRef.current && !landed.current && Math.abs(r.t - r.a) < 0.6 && Math.abs(r.v) < 3) {
        landed.current = true;
        setDown(true);
      }

      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  // Pindah lagu otomatis
  useEffect(() => {
    if (!down || lagu.length < 2) return;
    const t = setInterval(() => setAktif((a) => (a + 1) % lagu.length), 6000);
    return () => clearInterval(t);
  }, [down, lagu.length]);

  const tambah = () => {
    if (!judul.trim() || !artis.trim()) return setError("Judul lagu dan nama artis harus diisi.");
    if (lagu.length >= MAX_LAGU) return setError(`Satu sisi piringan memuat maksimal ${MAX_LAGU} lagu.`);
    setLagu([...lagu, { judul: judul.trim(), artis: artis.trim() }]);
    setAktif(lagu.length);
    setJudul(""); setArtis(""); setError("");
  };

  const tambahMood = () => {
    const label = moodBaru.trim();
    if (!label) return setError("Nama suasana belum diisi.");
    const m = { id: "c" + Date.now(), label, color: warnaMood };
    setCustomMoods([...customMoods, m]);
    setMood(m); setMoodBaru(""); setWarnaManual(null); setError("");
  };

  const simpan = (e) => {
    e.preventDefault();
    if (!nama.trim()) return setError("Nama playlist belum diisi.");
    if (!lagu.length) return setError("Tambahkan minimal satu lagu.");
    const p = { id: editId || Date.now(), nama: nama.trim(), pembuat: pembuat.trim(), mood, lagu };
    setKoleksi(editId ? koleksi.map((k) => (k.id === editId ? p : k)) : [p, ...koleksi]);
    setEditId(p.id); setNewId(p.id); setError(""); setTab("koleksi");
  };

  const muat = (p, ke) => {
    setNama(p.nama); setPembuat(p.pembuat); setMood(p.mood); setLagu(p.lagu);
    setAktif(0); setEditId(p.id); setError(""); setPlaying(true); setTab(ke);
  };

  const baru = () => {
    setNama(""); setPembuat(""); setLagu([]); setAktif(0); setEditId(null); setError(""); setTab("susun");
  };

  const hapusPlaylist = (id) => {
    setKoleksi(koleksi.filter((k) => k.id !== id));
    if (editId === id) setEditId(null);
  };

  return (
    <div className={`studio ${down ? "on" : ""} ${playing ? "arm-on" : ""}`} style={{ "--mood": mood.color }}>

      <section className="deck">
        <div className="turntable">
          <i className="led" /><i className="knob" />
          <div className="platter">
            <div className="disc" ref={discRef}>
              {lagu.map((_, i) => (
                <span key={i} className={`ring ${i === idx ? "cur" : ""}`}
                  style={{ width: `${86 - i * 5}%`, height: `${86 - i * 5}%` }} />
              ))}
              <div className="label">
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <defs><path id="lbl" d="M50,50 m-33,0 a33,33 0 1,1 66,0 a33,33 0 1,1 -66,0" /></defs>
                  <text><textPath href="#lbl">{(nama || "Playlist baru").slice(0, 24)}</textPath></text>
                  <text x="50" y="72" textAnchor="middle" className="mt">{mood.label.slice(0, 16)}</text>
                  <circle cx="50" cy="9" r="2.6" fill="#fff" />
                </svg>
                <i className="hole" />
              </div>
            </div>
            <div className="sheen" />
          </div>
          <button type="button" className="arm" ref={armRef} aria-pressed={playing}
            aria-label={playing ? "Angkat jarum" : "Letakkan jarum"}
            onClick={() => setPlaying(!playing)}><b /></button>
        </div>

        <div className="plate" aria-live="polite">
          <div className="eq" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ "--d": `${i * 0.13}s` }} />)}</div>
          <div className="np">
            <small>{down ? "Sedang diputar" : playing ? "Jarum sedang turun" : "Piringan berhenti"}</small>
            <strong>{down && now ? now.judul : nama || "Playlist baru"}</strong>
            <span>{down && now ? now.artis : pembuat ? `oleh ${pembuat}` : "Letakkan jarum untuk mulai"}</span>
          </div>
          <button type="button" className="needle-btn" onClick={() => setPlaying(!playing)}>
            {playing ? "Angkat jarum" : "Letakkan jarum"}
          </button>
        </div>
      </section>

      <section className={`sleeve ${open ? "open" : ""}`}>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "susun"} className={tab === "susun" ? "t sel" : "t"} onClick={() => setTab("susun")}>
            {editId ? "Ubah playlist" : "Susun playlist"}
          </button>
          <button role="tab" aria-selected={tab === "koleksi"} className={tab === "koleksi" ? "t sel" : "t"} onClick={() => setTab("koleksi")}>
            Koleksi ({koleksi.length})
          </button>
        </div>

        {tab === "susun" ? (
          <form onSubmit={simpan} noValidate className="form">
            {!down && <p className="hint">{playing ? "Jarum sedang turun, formulir segera terbuka." : "Letakkan jarum pada piringan untuk membuka formulir."}</p>}

            <div className="row f" style={{ "--i": 0 }}>
              <label>Nama playlist
                <input disabled={!down} value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Teman perjalanan sore" />
              </label>
              <label>Pembuat
                <input disabled={!down} value={pembuat} onChange={(e) => setPembuat(e.target.value)} placeholder="Nama kamu" />
              </label>
            </div>

            <fieldset disabled={!down} className="f" style={{ "--i": 1 }}>
              <legend>Suasana</legend>
              <div className="chips">
                {[...MOODS, ...customMoods].map((m) => (
                  <span key={m.id} className="mchip">
                    <button type="button" aria-pressed={mood.id === m.id}
                      className={mood.id === m.id ? "chip sel" : "chip"} onClick={() => setMood(m)}>
                      <i style={{ background: m.color }} />{m.label}
                    </button>
                    {m.id.startsWith("c") && (
                      <button type="button" className="x" aria-label={`Hapus suasana ${m.label}`}
                        onClick={() => setCustomMoods(customMoods.filter((c) => c.id !== m.id))}>×</button>
                    )}
                  </span>
                ))}
              </div>
              <div className="row mood-add">
                <input aria-label="Nama suasana baru" value={moodBaru} onChange={(e) => setMoodBaru(e.target.value)} placeholder="Suasana baru, misalnya Hujan" />
                <input type="color" aria-label="Warna suasana" className="color" value={warnaMood} onChange={(e) => setWarnaManual(e.target.value)} />
                <button type="button" className="plus" onClick={tambahMood}>Tambah</button>
              </div>
            </fieldset>

            <fieldset disabled={!down} className="f" style={{ "--i": 2 }}>
              <legend>Tambah lagu ({lagu.length}/{MAX_LAGU})</legend>
              <div className="row add">
                <input aria-label="Judul lagu" value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Judul lagu" />
                <input aria-label="Nama artis" value={artis} onChange={(e) => setArtis(e.target.value)} placeholder="Artis" />
                <button type="button" className="plus" onClick={tambah}>Tambah</button>
              </div>
            </fieldset>

            {lagu.length > 0 && (
              <ol className="tracks">
                {lagu.map((l, i) => (
                  <li key={l.judul + i} className={i === idx ? "cur" : ""}>
                    <button type="button" className="pick" onClick={() => { setAktif(i); setPlaying(true); }} aria-label={`Putar ${l.judul}`}>
                      <b>{l.judul}</b><span>{l.artis}</span>
                    </button>
                    <button type="button" className="del" aria-label={`Hapus ${l.judul}`} onClick={() => setLagu(lagu.filter((_, k) => k !== i))}>Hapus</button>
                  </li>
                ))}
              </ol>
            )}

            {error && <p className="error" role="alert" key={error}>{error}</p>}
            <div className="acts">
              <button className="save f" style={{ "--i": 3 }} type="submit" disabled={!down}>{editId ? "Perbarui playlist" : "Simpan playlist"}</button>
              {editId && <button type="button" className="ghost" onClick={baru}>Playlist baru</button>}
            </div>
          </form>
        ) : (
          <div className="form">
            {koleksi.length === 0 ? (
              <p className="empty">Belum ada playlist tersimpan. Susun satu pada tab Susun playlist, lalu simpan.</p>
            ) : (
              <ul className="coll">
                {koleksi.map((p) => (
                  <li key={p.id} className={`card ${p.id === newId ? "new" : ""} ${p.id === editId ? "cur" : ""}`}>
                    <i className="mini" style={{ "--c": p.mood.color }} />
                    <div className="info">
                      <b>{p.nama}</b>
                      <span>{p.lagu.length} lagu, {p.mood.label.toLowerCase()}{p.pembuat ? `, oleh ${p.pembuat}` : ""}</span>
                    </div>
                    <div className="cacts">
                      <button type="button" onClick={() => muat(p, "koleksi")}>Putar</button>
                      <button type="button" onClick={() => muat(p, "susun")}>Ubah</button>
                      <button type="button" onClick={() => hapusPlaylist(p.id)}>Hapus</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="save" onClick={baru}>Susun playlist baru</button>
          </div>
        )}
      </section>
    </div>
  );
}