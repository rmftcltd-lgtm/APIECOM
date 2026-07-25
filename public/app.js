const SLOTS = [
  { slot: "front", label: "1. Front", prompt: "Front of the item, well lit", accept: "image/*", capture: "environment" },
  { slot: "back", label: "2. Back", prompt: "Back of the item", accept: "image/*", capture: "environment" },
  { slot: "detail", label: "3. Detail", prompt: "Close-up of texture / stitching / flaws", accept: "image/*", capture: "environment" },
  { slot: "bottom_mark", label: "4. Label / maker’s mark", prompt: "Bottom, care label, size tag, or stamp", accept: "image/*", capture: "environment" },
  { slot: "context", label: "5. Context / scale", prompt: "On hanger, table, or flat lay with scale", accept: "image/*", capture: "environment" },
  { slot: "video", label: "6. 10s walkaround video", prompt: "Slow orbit, max ~10 seconds", accept: "video/*", capture: "environment" },
];

const state = {
  sessionId: null,
  draft: null,
  files: {},
};

const els = {
  steps: [...document.querySelectorAll("#steps li")],
  start: document.getElementById("step-start"),
  photos: document.getElementById("step-photos"),
  draft: document.getElementById("step-draft"),
  done: document.getElementById("step-done"),
  slots: document.getElementById("slots"),
  btnStart: document.getElementById("btn-start"),
  btnUpload: document.getElementById("btn-upload"),
  btnComplete: document.getElementById("btn-complete"),
  btnReanalyze: document.getElementById("btn-reanalyze"),
  btnAgain: document.getElementById("btn-again"),
  sessionMeta: document.getElementById("session-meta"),
  photoMeta: document.getElementById("photo-meta"),
  draftMeta: document.getElementById("draft-meta"),
  draftForm: document.getElementById("draft-form"),
  assumptions: document.getElementById("assumptions"),
  doneMessage: document.getElementById("done-message"),
  doneJson: document.getElementById("done-json"),
};

function setStep(n) {
  els.steps.forEach((li) => {
    const s = Number(li.dataset.step);
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
  });
  els.start.hidden = n !== 1;
  els.photos.hidden = n !== 2;
  els.draft.hidden = n !== 3;
  els.done.hidden = n !== 4;
}

async function api(path, options = {}) {
  const res = await fetch(`/api/v1${path}`, options);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text || res.statusText };
  }
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

function renderSlots() {
  els.slots.innerHTML = "";
  for (const item of SLOTS) {
    const card = document.createElement("div");
    card.className = "slot";
    card.dataset.slot = item.slot;
    card.innerHTML = `
      <h3>${item.label}</h3>
      <p>${item.prompt}</p>
      <input type="file" accept="${item.accept}" ${item.slot === "video" ? "" : `capture="${item.capture}"`} />
      <img class="preview" alt="" />
      <video class="preview" controls muted playsinline></video>
    `;
    const input = card.querySelector('input[type="file"]');
    const img = card.querySelector("img");
    const video = card.querySelector("video");
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      state.files[item.slot] = file;
      card.classList.add("ready");
      const url = URL.createObjectURL(file);
      if (item.slot === "video") {
        video.src = url;
        video.style.display = "block";
        img.style.display = "none";
      } else {
        img.src = url;
        img.style.display = "block";
        video.style.display = "none";
      }
      updateUploadEnabled();
    });
    els.slots.appendChild(card);
  }
}

function updateUploadEnabled() {
  const ready = SLOTS.every((s) => Boolean(state.files[s.slot]));
  els.btnUpload.disabled = !ready;
  const count = Object.keys(state.files).length;
  els.photoMeta.textContent = ready
    ? "All 6 captures ready — upload & continue."
    : `${count}/6 ready. Add the missing photos/video.`;
}

function fillDraftForm(draft) {
  const f = els.draftForm;
  f.title.value = draft.title || "";
  f.description.value = draft.description || "";
  f.tags.value = (draft.tags || []).join(", ");
  f.materials.value = (draft.materials || []).join(", ");
  f.price.value = draft.pricing?.suggestedPrice ?? "";
  f.currency.value = draft.pricing?.currency || "AUD";
  f.quantity.value = draft.quantity ?? 1;
  f.brandOrMaker.value = draft.brandOrMaker || "";
  f.conditionNotes.value = draft.conditionNotes || "";
  f.whoMade.value = draft.whoMade || "someone_else";
  f.whenMade.value = draft.whenMade || "";
  f.taxonomyId.value = draft.taxonomyId ?? "";

  const bits = [
    ...(draft.assumptions || []),
    draft.pricing?.rationale,
    draft.shipping?.rationale,
  ].filter(Boolean);

  els.assumptions.innerHTML = bits.length
    ? `<strong>AI assumptions</strong><ul>${bits.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
    : "";
}

function readDraftForm() {
  const f = els.draftForm;
  const tags = f.tags.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 13);
  const materials = f.materials.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 13);
  const taxonomyRaw = f.taxonomyId.value.trim();
  return {
    title: f.title.value.trim(),
    description: f.description.value.trim(),
    tags,
    materials,
    quantity: Number(f.quantity.value) || 1,
    brandOrMaker: f.brandOrMaker.value.trim() || null,
    conditionNotes: f.conditionNotes.value.trim(),
    whoMade: f.whoMade.value,
    whenMade: f.whenMade.value.trim(),
    taxonomyId: taxonomyRaw === "" ? null : Number(taxonomyRaw),
    pricing: {
      suggestedPrice: Number(f.price.value),
      currency: f.currency.value.trim().toUpperCase() || "AUD",
    },
  };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

els.btnStart.addEventListener("click", async () => {
  els.btnStart.disabled = true;
  els.sessionMeta.hidden = false;
  els.sessionMeta.textContent = "Creating session…";
  try {
    const session = await api("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: "AUD", markupPercent: 45, whoMadeDefault: "someone_else" }),
    });
    state.sessionId = session.id;
    state.files = {};
    renderSlots();
    updateUploadEnabled();
    els.sessionMeta.textContent = `Session ${session.id}`;
    setStep(2);
  } catch (err) {
    els.sessionMeta.textContent = String(err.message || err);
  } finally {
    els.btnStart.disabled = false;
  }
});

els.btnUpload.addEventListener("click", async () => {
  els.btnUpload.disabled = true;
  els.photoMeta.textContent = "Uploading media…";
  try {
    const form = new FormData();
    const slotNames = [];
    for (const item of SLOTS) {
      form.append("files", state.files[item.slot], state.files[item.slot].name);
      slotNames.push(item.slot);
    }
    form.append("slots", slotNames.join(","));
    await api(`/sessions/${state.sessionId}/media`, { method: "POST", body: form });

    els.photoMeta.textContent = "Analyzing with AI… (may take a moment)";
    const analyzed = await api(`/sessions/${state.sessionId}/analyze`, { method: "POST" });
    state.draft = analyzed.draft;
    fillDraftForm(analyzed.draft);
    els.draftMeta.textContent = `Confidence ${Math.round((analyzed.draft.confidence || 0) * 100)}% · status ${analyzed.status}`;
    setStep(3);
  } catch (err) {
    els.photoMeta.textContent = String(err.message || err);
    updateUploadEnabled();
  }
});

els.btnReanalyze.addEventListener("click", async () => {
  els.draftMeta.textContent = "Re-analyzing…";
  try {
    const analyzed = await api(`/sessions/${state.sessionId}/analyze`, { method: "POST" });
    state.draft = analyzed.draft;
    fillDraftForm(analyzed.draft);
    els.draftMeta.textContent = "Draft refreshed from media.";
  } catch (err) {
    els.draftMeta.textContent = String(err.message || err);
  }
});

els.btnComplete.addEventListener("click", async () => {
  els.btnComplete.disabled = true;
  els.draftMeta.textContent = "Saving edits…";
  try {
    const patch = readDraftForm();
    await api(`/sessions/${state.sessionId}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    els.draftMeta.textContent = "Completing listing…";
    const result = await api(`/sessions/${state.sessionId}/complete`, { method: "POST" });
    els.doneMessage.textContent =
      result.etsy?.message ||
      "Draft completed. If Etsy credentials are configured, a draft listing was created.";
    els.doneJson.textContent = JSON.stringify(result, null, 2);
    setStep(4);
  } catch (err) {
    els.draftMeta.textContent = String(err.message || err);
  } finally {
    els.btnComplete.disabled = false;
  }
});

els.btnAgain.addEventListener("click", () => {
  state.sessionId = null;
  state.draft = null;
  state.files = {};
  els.sessionMeta.hidden = true;
  setStep(1);
});

setStep(1);
