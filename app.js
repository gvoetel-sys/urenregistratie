const KEY = "urenregistratie_paneelbouw_v1";

const state = JSON.parse(localStorage.getItem(KEY) || "null") || {
  projects: ["Geen project"],
  selected: "Geen project",
  kast: "VK1",
  positie: "A01",
  regs: [],
  running: null,
  theme: "dark",
  notes: ""
};

const $ = id => document.getElementById(id);

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function hm(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

/* =========================
   RENDER
   ========================= */

function render() {
  document.body.classList.toggle("light", state.theme === "light");

  $("projectSelect").innerHTML = state.projects
    .map(p => `<option ${p === state.selected ? "selected" : ""}>${esc(p)}</option>`)
    .join("");

  $("kast").value = state.kast;
  $("positie").value = state.positie;

  renderRegs();
  renderProjects();
  renderSummary();

  $("timer").textContent = state.running
    ? fmt((Date.now() - state.running.start) / 1000)
    : "00:00:00";
}

function renderRegs() {
  const rs = state.regs.filter(r => r.date === today());

  $("registrationList").innerHTML = rs.length
    ? rs.map(r => `
      <div class="reg">
        <div>
          <div class="reg-title">${esc(r.project)}</div>
          <div class="reg-meta">
            ${r.from}–${r.to} · ${hm(r.seconds)} ·
            ${esc(r.kast)} · ${esc(r.positie)}
            ${r.note ? " · " + esc(r.note) : ""}
          </div>
        </div>

        <div class="reg-actions">
          <button class="mini" data-edit="${r.id}">✎</button>
          <button class="mini danger" data-del="${r.id}">🗑</button>
        </div>
      </div>
    `).join("")
    : `<div class="summary">Nog geen registraties vandaag.</div>`;

  const total = rs.reduce((a, r) => a + r.seconds, 0);

  $("todayHours").textContent = hm(total);
  $("present").textContent = hm(total);
  $("break").textContent = "1:00";

  document.querySelectorAll("[data-del]").forEach(b => {
    b.onclick = () => {
      state.regs = state.regs.filter(r => r.id !== b.dataset.del);
      save();
      render();
    };
  });

  document.querySelectorAll("[data-edit]").forEach(b => {
    b.onclick = () => editReg(b.dataset.edit);
  });
}

function renderProjects() {
  $("projectList").innerHTML = state.projects
    .map((p, i) => `
      <div class="project-item">
        <b>${esc(p)}</b>
        ${i
          ? `<button class="mini danger" data-proj="${esc(p)}">🗑</button>`
          : ""}
      </div>
    `)
    .join("");

  document.querySelectorAll("[data-proj]").forEach(b => {
    b.onclick = () => deleteProject(b.dataset.proj);
  });
}

function renderSummary() {
  const by = {};

  state.regs.forEach(r => {
    by[r.project] = (by[r.project] || 0) + r.seconds;
  });

  $("summary").innerHTML = Object.keys(by).length
    ? Object.entries(by)
        .map(([p, s]) => `<div><b>${esc(p)}</b> — ${hm(s)}</div>`)
        .join("")
    : "Geen geregistreerde uren.";
}

/* =========================
   MODAL
   ========================= */

function openModal(title, body) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = body;
  $("modal").classList.remove("hidden");
}

function closeModal() {
  $("modal").classList.add("hidden");
}

/* =========================
   PROJECTEN
   ========================= */

function deleteProject(p) {
  if (
    !confirm(
      `Project "${p}" verwijderen?\n\nDe bestaande registraties blijven behouden.`
    )
  ) return;

  state.projects = state.projects.filter(x => x !== p);

  if (state.selected === p) {
    state.selected = state.projects[0] || "Geen project";
  }

  if (!state.projects.length) {
    state.projects = ["Geen project"];
  }

  save();
  render();
}

/* =========================
   REGISTRATIE
   ========================= */

function addReg(
  from,
  to,
  seconds,
  note = "",
  project = state.selected,
  kast = state.kast,
  positie = state.positie
) {
  state.regs.push({
    id: crypto.randomUUID(),
    date: today(),
    project,
    kast,
    positie,
    from,
    to,
    seconds,
    note
  });

  save();
  render();
}

/* =========================
   HANDMATIG
   ========================= */

function manual() {
  openModal(
    "Handmatige registratie",
    `
      <label>Van</label>
      <input id="mFrom" type="time">

      <label>Tot</label>
      <input id="mTo" type="time">

      <label>Notitie</label>
      <input id="mNote" placeholder="Optioneel">

      <button id="mSave" class="btn primary full">
        Opslaan
      </button>
    `
  );

  $("mSave").onclick = () => {
    const a = $("mFrom").value;
    const b = $("mTo").value;

    if (!a || !b) {
      alert("Vul beide tijden in.");
      return;
    }

    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);

    const sec = (bh * 60 + bm - ah * 60 - am) * 60;

    if (sec <= 0) {
      alert("Eindtijd moet na begintijd liggen.");
      return;
    }

    addReg(
      a,
      b,
      sec,
      $("mNote").value
    );

    closeModal();
  };
}

/* =========================
   REGISTRATIE BEWERKEN
   ========================= */

function editReg(id) {
  const r = state.regs.find(x => x.id === id);

  if (!r) return;

  openModal(
    "Registratie aanpassen",
    `
      <label>Van</label>
      <input id="eFrom" type="time" value="${r.from}">

      <label>Tot</label>
      <input id="eTo" type="time" value="${r.to}">

      <label>Notitie</label>
      <input id="eNote" value="${esc(r.note || "")}">

      <button id="eSave" class="btn primary full">
        Opslaan
      </button>
    `
  );

  $("eSave").onclick = () => {
    const a = $("eFrom").value;
    const b = $("eTo").value;

    if (!a || !b) {
      alert("Vul beide tijden in.");
      return;
    }

    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);

    const sec = (bh * 60 + bm - ah * 60 - am) * 60;

    if (sec <= 0) {
      alert("Ongeldige tijden.");
      return;
    }

    Object.assign(r, {
      from: a,
      to: b,
      seconds: sec,
      note: $("eNote").value
    });

    save();
    closeModal();
    render();
  };
}

/* =========================
   DAG AFSLUITEN
   ========================= */

function roundUp15(seconds) {
  if (seconds <= 0) return 0;

  const quarter = 15 * 60;

  return Math.ceil(seconds / quarter) * quarter;
}

function timeNow() {
  return new Date().toTimeString().slice(0, 5);
}

function closeDay() {
  if (state.running) {
    alert(
      "De timer loopt nog.\n\nStop eerst de timer voordat je de dag afsluit."
    );
    return;
  }

  const rs = state.regs.filter(r => r.date === today());

  let total = rs.reduce((sum, r) => sum + r.seconds, 0);

  /* =========================
     MEER DAN 8 UUR
     ========================= */

  if (total > 8 * 3600) {
    const extra = total - 8 * 3600;

    const akkoord = confirm(
      `Je hebt ${hm(total)} geregistreerd.\n\n` +
      `Dat is ${hm(extra)} meer dan 8 uur.\n\n` +
      `Klopt dit?\n\n` +
      `OK = Ja\n` +
      `Annuleren = Nee`
    );

    if (!akkoord) {
      return;
    }
  }

  /* =========================
     MINDER DAN 8 UUR
     080 ALGEMEEN
     ========================= */

  if (total < 8 * 3600) {
    const tekort = 8 * 3600 - total;

    const toevoegen = confirm(
      `Je hebt ${hm(total)} geregistreerd.\n\n` +
      `Er ontbreekt ${hm(tekort)} tot 8:00 uur.\n\n` +
      `Dit wordt toegevoegd als:\n` +
      `080 Algemeen\n\n` +
      `OK = Toevoegen\n` +
      `Annuleren = Niet toevoegen`
    );

    if (toevoegen) {
      const from = timeNow();

      addReg(
        from,
        from,
        tekort,
        "Automatisch aangevuld bij dag afsluiten",
        "080 Algemeen",
        "",
        ""
      );

      total += tekort;
    }
  }

  /* =========================
     PROJECTTOTALEN AFRONDEN
     ========================= */

  const todayRegs = state.regs.filter(r => r.date === today());

  const projects = {};

  todayRegs.forEach(r => {
    if (!projects[r.project]) {
      projects[r.project] = {
        seconds: 0,
        records: []
      };
    }

    projects[r.project].seconds += r.seconds;
    projects[r.project].records.push(r);
  });

  let summary = [];
  let roundedTotal = 0;

  Object.entries(projects).forEach(([project, data]) => {
    const rounded = roundUp15(data.seconds);

    if (rounded !== data.seconds) {
      const verschil = rounded - data.seconds;

      const last = data.records[data.records.length - 1];

      last.seconds += verschil;
      last.to = last.to || last.from;
    }

    roundedTotal += rounded;

    summary.push(
      `${project}: ${hm(data.seconds)} → ${hm(rounded)}`
    );
  });

  save();
  render();

  openModal(
    "Dag afgesloten",
    `
      <div class="summary">
        <h3>Dag afgesloten</h3>

        <p>
          De registraties zijn berekend en afgerond
          op kwartieren.
        </p>

        ${summary.map(x => `<div>${esc(x)}</div>`).join("")}

        <hr>

        <b>
          Totaal afgerond: ${hm(roundedTotal)}
        </b>
      </div>

      <button id="closeDayOk" class="btn primary full">
        Sluiten
      </button>
    `
  );

  $("closeDayOk").onclick = closeModal;
}

/* =========================
   EVENTS
   ========================= */

$("projectSelect").onchange = e => {
  state.selected = e.target.value;
  save();
  render();
};

$("kast").oninput = e => {
  state.kast = e.target.value;
  save();
};

$("positie").oninput = e => {
  state.positie = e.target.value;
  save();
};

/* START */

$("startBtn").onclick = () => {
  if (state.running) return;

  state.running = {
    start: Date.now(),
    from: new Date().toTimeString().slice(0, 5),
    project: state.selected,
    kast: state.kast,
    positie: state.positie
  };

  save();
  render();
};

/* STOP */

$("stopBtn").onclick = () => {
  if (!state.running) return;

  const r = state.running;
  const end = new Date();

  const sec = Math.max(
    1,
    Math.round((Date.now() - r.start) / 1000)
  );

  addReg(
    r.from,
    end.toTimeString().slice(0, 5),
    sec,
    "",
    r.project,
    r.kast,
    r.positie
  );

  state.running = null;

  save();
  render();
};

/* HANDMATIG */

$("manualBtn").onclick = manual;

/* NOTITIE */

$("noteBtn").onclick = () => {
  openModal(
    "Notitie",
    `
      <textarea
        id="noteText"
        style="
          width:100%;
          min-height:140px;
          background:var(--card2);
          color:var(--text);
          border:2px solid var(--line);
          border-radius:15px;
          padding:12px
        "
      >${esc(state.notes)}</textarea>

      <button id="noteSave" class="btn primary full">
        Opslaan
      </button>
    `
  );

  $("noteSave").onclick = () => {
    state.notes = $("noteText").value;
    save();
    closeModal();
  };
};

/* PROJECT VERWIJDEREN */

$("deleteProjectBtn").onclick = () => {
  if (state.selected !== "Geen project") {
    deleteProject(state.selected);
  }
};

/* PROJECT TOEVOEGEN */

$("addProjectBtn").onclick = () => {
  const p = $("newProject").value.trim();

  if (!p) return;

  if (!state.projects.includes(p)) {
    state.projects.push(p);
  }

  state.selected = p;

  $("newProject").value = "";

  save();
  render();
};

/* ALLE REGISTRATIES VANDAAG WISSEN */

$("clearTodayBtn").onclick = () => {
  if (
    confirm("Alle registraties van vandaag verwijderen?")
  ) {
    state.regs = state.regs.filter(
      r => r.date !== today()
    );

    save();
    render();
  }
};

/* ALLE APPDATA WISSEN */

$("resetBtn").onclick = () => {
  if (
    confirm("Alle appgegevens verwijderen?")
  ) {
    localStorage.removeItem(KEY);
    location.reload();
  }
};

/* THEMA */

$("themeBtn").onclick = () => {
  state.theme =
    state.theme === "dark"
      ? "light"
      : "dark";

  save();
  render();
};

/* MODAL */

$("closeModal").onclick = closeModal;

$("modal").onclick = e => {
  if (e.target === $("modal")) {
    closeModal();
  }
};

/* DAG AFSLUITEN */

$("finishDayBtn").onclick = closeDay;

/* PRINT */

$("printBtn").onclick = () => {
  window.print();
};

/* EXPORT */

$("exportBtn").onclick = () => {
  const blob = new Blob(
    [JSON.stringify(state, null, 2)],
    { type: "application/json" }
  );

  const a = document.createElement("a");

  a.href = URL.createObjectURL(blob);
  a.download = "urenregistratie-export.json";

  a.click();

  URL.revokeObjectURL(a.href);
};

/* WEEK */

$("weekBtn").onclick = () => showPeriod(7);

/* MAAND */

$("monthBtn").onclick = () => showPeriod(31);

function showPeriod(days) {
  const now = Date.now();
  const from = now - days * 864e5;

  const rs = state.regs.filter(
    r => new Date(r.date).getTime() >= from
  );

  openModal(
    days === 7
      ? "Weekoverzicht"
      : "Maandoverzicht",

    rs.length
      ? rs.map(r => `
        <div class="reg">
          <div>
            <b>
              ${esc(r.date)} · ${esc(r.project)}
            </b>

            <div class="reg-meta">
              ${hm(r.seconds)} ·
              ${esc(r.kast)} ·
              ${esc(r.positie)}
            </div>
          </div>
        </div>
      `).join("")
      : "Geen registraties."
  );
}

/* TABS */

document.querySelectorAll(".tab").forEach(t => {
  t.onclick = () => {
    document
      .querySelectorAll(".tab")
      .forEach(x => x.classList.remove("active"));

    t.classList.add("active");

    document
      .querySelectorAll(".view")
      .forEach(x => x.classList.remove("active"));

    $(t.dataset.view).classList.add("active");
  };
});

/* TIMER */

setInterval(() => {
  if (state.running) {
    $("timer").textContent =
      fmt((Date.now() - state.running.start) / 1000);
  }
}, 500);

/* SERVICE WORKER */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .catch(() => {});
}

/* START */

render();
