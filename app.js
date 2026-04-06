// Simple Estimate Builder

const state = {
  client: {
    name: "",
    planner: "",
    date: "",
    guests: 0, // global fallback; each event can override via ev.guests
    phone: "",
    address: "",
    comment: "",
    events: [], // [{ id, date, guests?: number, fees?: { labor, chafing, travel, kitchen } }]
  },
  stations: [], // [{ name: string, items: [{ name, price }], eventId?: string }]
  autoPricePerPerson: false,
  pricePerPerson: 0,
  fees: {
    labor: 0,
    chafing: 0,
    travel: 0,
    kitchen: 0,
  },
  taxRate: 0.06,
  chargeTax: true,
  paymentMade: 0,
  activeEventId: "",
  dataFolderHandle: null,
  // UI-only state
  ui: {
    eventDateDraft: "",
    draftGuests: 0,
    draftType: "",
    draftTiming: "",
    draftAddress: "",
  },
};

// Utilities
const currency = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
};
const numVal = (el) => Number(el.value || 0);

function init() {
  // Try restoring previously chosen data folder (async, non-blocking)
  restoreDataFolderHandle();
  // Attempt to load estimates/autosave from the folder or static files if local storage is empty
  loadPortableDataIfAvailable();
  // Client info bindings
  el("clientName").addEventListener("input", (e) => {
    state.client.name = e.target.value.trim();
  });
  el("plannerName").addEventListener("input", (e) => {
    state.client.planner = e.target.value.trim();
  });
  if (el("clientPhone")) {
    el("clientPhone").addEventListener("input", (e) => {
      state.client.phone = (e.target.value || "").trim();
    });
  }
  if (el("clientComment")) {
    el("clientComment").addEventListener("input", (e) => {
      state.client.comment = (e.target.value || "").trim();
    });
  }
  el("eventDate").addEventListener("change", (e) => {
    const date = e.target.value;
    if (state.ui) state.ui.eventDateDraft = date;
    state.client.date = date;
    // If an existing event matches this date, make it active so
    // the guest count and event type inputs reflect that event.
    const match = state.client.events.find((ev) => ev.date === date);
    if (match) {
      state.activeEventId = match.id;
      state.ui.draftGuests = 0;
      state.ui.draftType = "";
      state.ui.draftTiming = "";
      state.ui.draftAddress = "";
    }
    // Re-render to sync inputs and meta with the active event
    renderAll();
  });
  // Track live typing so we don't overwrite with active event's date
  el("eventDate").addEventListener("input", (e) => {
    const date = e.target.value || "";
    if (state.ui) state.ui.eventDateDraft = date;
  });
  el("guestCount").addEventListener("input", (e) => {
    const date = (state.ui && state.ui.eventDateDraft) || "";
    const match = (state.client.events || []).find((ev) => ev.date === date);
    const val = Number(e.target.value || 0);
    if (match) {
      setGuestsForActiveEvent(val);
    } else {
      state.ui.draftGuests = val;
    }
    calculateTotals();
    renderActiveEventMeta();
  });
  el("eventType").addEventListener("input", (e) => {
    const date = (state.ui && state.ui.eventDateDraft) || "";
    const match = (state.client.events || []).find((ev) => ev.date === date);
    const val = (e.target.value || "").trim();
    if (match) {
      setEventTypeForActiveEvent(val);
    } else {
      state.ui.draftType = val;
    }
    renderActiveEventMeta();
  });
  el("eventTiming").addEventListener("input", (e) => {
    const date = (state.ui && state.ui.eventDateDraft) || "";
    const match = (state.client.events || []).find((ev) => ev.date === date);
    const val = (e.target.value || "").trim();
    if (match) {
      setEventTimingForActiveEvent(val);
    } else {
      state.ui.draftTiming = val;
    }
    renderActiveEventMeta();
  });
  el("eventAddress").addEventListener("input", (e) => {
    const date = (state.ui && state.ui.eventDateDraft) || "";
    const match = (state.client.events || []).find((ev) => ev.date === date);
    const val = (e.target.value || "").trim();
    if (match) {
      setEventAddressForActiveEvent(val);
    } else {
      state.ui.draftAddress = val;
    }
  });

  // Events controls
  const addEventBtn = el("addEventBtn");
  if (addEventBtn) {
    addEventBtn.addEventListener("click", () => {
      // Ensure the picker is a full date selector and open it for convenience
      const dateInput = el("eventDate");
      if (dateInput) {
        dateInput.setAttribute("type", "date");
      }
      const date = (el("eventDate").value || "").trim();
      if (!date) {
        alert("Please enter an event date in 'Event Date' first.");
        return;
      }
      const existing = state.client.events.find((ev) => ev.date === date);
      if (existing) {
        state.activeEventId = existing.id;
        if (state.ui) state.ui.eventDateDraft = existing.date || date;
        existing.guests = Number((el("guestCount").value || "").trim()) || 0;
        existing.type = (el("eventType").value || "").trim();
        existing.timing = (el("eventTiming").value || "").trim();
        existing.address = (el("eventAddress").value || "").trim();
        renderAll();
        return;
      }
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      // Seed new event with current input values so they persist
      const seedGuests = Number((el("guestCount").value || "").trim()) || 0;
      const seedType = (el("eventType").value || "").trim();
      const seedTiming = (el("eventTiming").value || "").trim();
      const seedAddress = (el("eventAddress").value || "").trim();
      const seedNote = (el("eventNote") && (el("eventNote").value || "").trim()) || "";
      const seedCustomNote = (el("customChargeNote") && (el("customChargeNote").value || "").trim()) || "";
      const seedCustomAmount = (el("customChargeAmount") && Number((el("customChargeAmount").value || "").trim())) || 0;
      state.client.events.push({ id, date, guests: seedGuests, fees: { ...state.fees, custom: seedCustomAmount }, type: seedType, timing: seedTiming, address: seedAddress, note: seedNote, customNote: seedCustomNote });
      state.activeEventId = id;
      if (state.ui) state.ui.eventDateDraft = date;
      state.ui.draftGuests = 0;
      state.ui.draftType = "";
      state.ui.draftTiming = "";
      state.ui.draftAddress = "";
      renderAll();
    });
  }
  const eventSelect = el("eventSelect");
  if (eventSelect) {
    eventSelect.addEventListener("change", (e) => {
      state.activeEventId = e.target.value || "";
      const dateInput = el("eventDate");
      if (dateInput) dateInput.setAttribute("type", "date");
      // Sync the visible date with the newly selected active event
      const ev = getActiveEvent();
      if (state.ui) state.ui.eventDateDraft = (ev && ev.date) || state.client.date || "";
      // Re-render to sync fee inputs with selected event
      renderAll();
    });
  }

  // Update and delete active event actions
  const updateEventDateBtn = el("updateEventDateBtn");
  if (updateEventDateBtn) {
    updateEventDateBtn.addEventListener("click", () => {
      if (!state.activeEventId) {
        alert("Please select an active event to update.");
        return;
      }
      const dateInput = el("eventDate");
      if (dateInput) dateInput.setAttribute("type", "date");
      const newDate = (el("eventDate").value || "").trim();
      if (!newDate) {
        alert("Please enter a date in 'Event Date' first.");
        return;
      }
      const conflict = (state.client.events || []).find((ev) => ev.date === newDate && ev.id !== state.activeEventId);
      if (conflict) {
        alert("Another event already uses this date. Please choose a different date.");
        return;
      }
      const ev = (state.client.events || []).find((ev) => ev.id === state.activeEventId);
      if (ev) {
        ev.date = newDate;
        // Keep global client date in sync with the selected event for convenience
        state.client.date = newDate;
        if (state.ui) state.ui.eventDateDraft = newDate;
        renderEventsUI();
        renderActiveEventMeta();
        renderAll();
      }
    });
  }
  const deleteEventBtn = el("deleteEventBtn");
  if (deleteEventBtn) {
    deleteEventBtn.addEventListener("click", () => {
      if (!state.activeEventId) {
        alert("Please select an active event to delete.");
        return;
      }
      const confirmDelete = confirm("Delete the active event and its stations? This cannot be undone.");
      if (!confirmDelete) return;
      const id = state.activeEventId;
      // Remove stations tied to this event
      state.stations = state.stations.filter((st) => st.eventId !== id);
      // Remove the event
      state.client.events = (state.client.events || []).filter((ev) => ev.id !== id);
      // Pick next event if any
      const next = ([...(state.client.events || [])].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))[0]) || null;
      state.activeEventId = next ? next.id : "";
      renderEventsUI();
      renderStations();
      calculateTotals();
      renderActiveEventMeta();
    });
  }

  // Actions
  el("addStationBtn").addEventListener("click", addStation);
  el("newEstimateBtn").addEventListener("click", () => {
    const sel = el("savedEstimatesSelect");
    const shouldSave = confirm("Save the current estimate before starting a new one?");
    if (shouldSave) {
      // Only save if both client name and an event/client date are present
      const nameOk = !!(state.client.name && state.client.name.trim());
      const activeEv = getActiveEvent();
      const dateRaw = ((activeEv && activeEv.date) || state.client.date || '').trim();
      const dateOk = !!dateRaw;
      if (nameOk && dateOk) {
        // Save normally: updates if a selection exists, otherwise creates new
        saveEstimate();
      } else {
        alert("Not saved: please ensure Client Name and Event Date are set.");
      }
    }
    // Clear saved estimate selection/name indicator before rerender to avoid re-preserving
    if (sel) sel.value = "";
    resetState();
    renderAll();
  });
  el("saveEstimateBtn").addEventListener("click", saveEstimate);
  el("saveAsNewBtn").addEventListener("click", saveAsNewEstimate);
  el("loadEstimateBtn").addEventListener("click", loadSelectedEstimate);
  el("updateEstimateBtn").addEventListener("click", updateSelectedEstimate);
  el("deleteEstimateBtn").addEventListener("click", deleteSelectedEstimate);
  el("printBtn").addEventListener("click", async () => {
    document.body.classList.remove("printing-contract");
    document.body.classList.add("printing-estimate");
    document.body.classList.add("estimate-compact");
    const prevTitle = document.title;
    document.title = makeEstimateTitle();
    const hideOpt = el("hidePrintTotal");
    if (hideOpt && hideOpt.checked) {
      document.body.classList.add("hide-print-total");
    } else {
      document.body.classList.remove("hide-print-total");
    }
    buildPrintView();
    // Ensure brand logo images have a moment to load before printing
    const logos = Array.from(document.querySelectorAll('#printView .brand-logo'));
    const waits = logos.map((img) => new Promise((resolve) => {
      if (!img || !img.getAttribute('src')) return resolve();
      if (img.complete && img.naturalWidth > 0) return resolve();
      const done = () => {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        resolve();
      };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
      // Fallback in case events never fire
      setTimeout(done, 800);
    }));
    try { await Promise.all(waits); } catch {}
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
      document.body.classList.remove("printing-estimate");
      document.body.classList.remove("estimate-compact");
      document.body.classList.remove("hide-print-total");
    }, 1000);
  });
  el("contractBtn").addEventListener("click", () => {
    document.body.classList.remove("printing-estimate");
    document.body.classList.add("printing-contract");
    document.body.classList.add("contract-compact");
    buildContractView();
    const prevTitle = document.title;
    document.title = makeContractTitle();
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
      document.body.classList.remove("printing-contract");
      document.body.classList.remove("contract-compact");
    }, 1000);
  });
  // Export/Import
  const exportBtnEl = el("exportBtn");
  if (exportBtnEl) exportBtnEl.addEventListener("click", exportEstimate);
  const exportAllToFolderBtn = el("exportAllToFolderBtn");
  if (exportAllToFolderBtn) exportAllToFolderBtn.addEventListener("click", exportAllEstimatesToFolder);
  const exportAllFilesToFolderBtn = el("exportAllFilesToFolderBtn");
  if (exportAllFilesToFolderBtn) exportAllFilesToFolderBtn.addEventListener("click", exportAllEstimatesFilesToFolder);
  const exportExcelBtn = el("exportEstimateExcelBtn");
  if (exportExcelBtn) exportExcelBtn.addEventListener("click", exportEstimateToExcel);
  const exportWordBtn = el("exportContractWordBtn");
  if (exportWordBtn) exportWordBtn.addEventListener("click", exportContractToWord);
  const syncDbBtn = el("syncDbBtn");
  if (syncDbBtn) syncDbBtn.addEventListener("click", syncEstimateToServer);
  el("importBtn").addEventListener("click", () => el("importFile").click());
  const importFromFolderBtn = el("importFromFolderBtn");
  if (importFromFolderBtn) importFromFolderBtn.addEventListener("click", importEstimateFromFolder);
  el("importFile").addEventListener("change", handleImportFile);
  const exportToFolderBtn = el("exportToFolderBtn");
  if (exportToFolderBtn) exportToFolderBtn.addEventListener("click", exportEstimateToFolder);
  // Contract editor actions
  el("editContractBtn").addEventListener("click", openContractEditor);
  el("closeContractEditor").addEventListener("click", closeContractEditor);
  el("saveContractTemplateBtn").addEventListener("click", saveContractTemplate);
  const saveContractBtnEl = el("saveContractBtn");
  if (saveContractBtnEl) saveContractBtnEl.addEventListener("click", saveCurrentContract);
  // Header editor actions
  const editHeaderBtn = el("editHeaderBtn");
  if (editHeaderBtn) editHeaderBtn.addEventListener("click", openHeaderEditor);
  const closeHeaderEditorBtn = el("closeHeaderEditor");
  if (closeHeaderEditorBtn) closeHeaderEditorBtn.addEventListener("click", closeHeaderEditor);
  const saveHeaderBtn = el("saveHeaderBtn");
  if (saveHeaderBtn) saveHeaderBtn.addEventListener("click", saveCompanyHeader);
  // Brand logo actions
  el("setLogoBtn").addEventListener("click", () => el("brandLogoInput").click());
  el("brandLogoInput").addEventListener("change", handleBrandLogoInput);
  // PDF actions
  el("saveEstimatePdfBtn").addEventListener("click", saveEstimatePdf);
  el("saveContractPdfBtn").addEventListener("click", saveContractPdf);
  // Data folder selection
  const setFolderBtn = el("setDataFolderBtn");
  if (setFolderBtn) setFolderBtn.addEventListener("click", chooseDataFolder);

  // API Base URL configuration
  const setApiBaseBtn = el("setApiBaseBtn");
  if (setApiBaseBtn) {
    setApiBaseBtn.addEventListener('click', () => {
      const current = (typeof getApiBaseUrl === 'function') ? getApiBaseUrl() : (window.API_BASE_URL || localStorage.getItem('API_BASE_URL') || '/api');
      const next = prompt('API Base URL', current);
      if (!next) return;
      localStorage.setItem('API_BASE_URL', next.trim());
      alert(`API base set to: ${(typeof getApiBaseUrl === 'function') ? getApiBaseUrl() : (window.API_BASE_URL || localStorage.getItem('API_BASE_URL') || '/api')}\nTry “Sync to DB” again.`);
    });
  }

  // "More" dropdown toggle and close behavior
  const moreDropdown = document.getElementById("moreDropdown");
  const moreBtn = document.getElementById("moreBtn");
  if (moreDropdown && moreBtn) {
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      moreDropdown.classList.toggle("open");
    });
    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (!moreDropdown.contains(e.target)) {
        moreDropdown.classList.remove("open");
      }
    });
    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") moreDropdown.classList.remove("open");
    });
  }
  // Saved select change: toggle Update/Delete availability
  const savedSel = el("savedEstimatesSelect");
  if (savedSel) {
    savedSel.addEventListener('change', () => {
      const hasSelection = !!savedSel.value;
      const updateBtn = el("updateEstimateBtn");
      const deleteBtn = el("deleteEstimateBtn");
      if (updateBtn) updateBtn.disabled = !hasSelection;
      if (deleteBtn) deleteBtn.disabled = !hasSelection;
    });
  }

  // Totals bindings
  // Removed per-person input; totals auto-calculate from items × guests
  // Fees inputs: bind to active event fees if an event is selected
  const laborCostEl = el("laborCost");
  if (laborCostEl) {
    laborCostEl.addEventListener("input", (e) => {
      setFeeForActiveEvent("labor", numVal(e.target));
      calculateTotals();
    });
  }
  el("chafingCharges").addEventListener("input", (e) => {
    setFeeForActiveEvent("chafing", numVal(e.target));
    calculateTotals();
  });
  el("travelCharges").addEventListener("input", (e) => {
    setFeeForActiveEvent("travel", numVal(e.target));
    calculateTotals();
  });
  el("kitchenOnWheels").addEventListener("input", (e) => {
    setFeeForActiveEvent("kitchen", numVal(e.target));
    calculateTotals();
  });
  const addCCBtn = el("addCustomChargeBtn");
  if (addCCBtn) {
    addCCBtn.addEventListener("click", () => {
      const ev = getActiveEvent();
      if (!ev) return;
      const list = ensureEventCustomCharges(ev);
      list.push({ note: "", amount: 0, taxable: true });
      renderCustomChargesList();
    });
  }
  el("taxRate").addEventListener("input", (e) => {
    const pct = Number(e.target.value || 0);
    state.taxRate = pct / 100;
    calculateTotals();
  });
  const chargeTaxEl = el("chargeTax");
  if (chargeTaxEl) {
    chargeTaxEl.checked = (state.chargeTax !== false);
    chargeTaxEl.addEventListener("change", (e) => {
      state.chargeTax = !!e.target.checked;
      calculateTotals();
    });
  }
  const paymentEl = el("paymentMade");
  if (paymentEl) {
    paymentEl.addEventListener("input", (e) => {
      const val = Number(e.target.value || 0);
      state.paymentMade = isNaN(val) ? 0 : val;
      calculateTotals();
    });
  }
  const discDescEl = el("discountDescription");
  if (discDescEl) {
    discDescEl.addEventListener("input", (e) => {
      const ev = getActiveEvent();
      if (!ev) return;
      const d = ensureEventDiscount(ev);
      d.description = String((e.target.value || '').trim());
    });
  }
  const discAmtEl = el("discountAmount");
  if (discAmtEl) {
    discAmtEl.addEventListener("input", (e) => {
      const ev = getActiveEvent();
      if (!ev) return;
      const d = ensureEventDiscount(ev);
      d.amount = Number(e.target.value || 0);
      calculateTotals();
    });
  }
  const eventNoteEl = el("eventNote");
  if (eventNoteEl) {
    eventNoteEl.addEventListener("input", (e) => {
      setEventNoteForActiveEvent((e.target.value || '').trim());
      renderTotalsNote();
    });
  }

  // Restore last autosaved session before initial render
  restoreAutosave();
  renderAll();
}

function el(id) {
  return document.getElementById(id);
}

// Date formatting helpers
function formatDateUS(dateStr) {
  if (!dateStr) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (m) {
    return `${m[2]}/${m[3]}/${m[1]}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
  return dateStr;
}

// Event fee helpers
function getActiveEvent() {
  const events = (state.client.events || []);
  if (state.activeEventId) {
    const byId = events.find((ev) => ev.id === state.activeEventId);
    if (byId) return byId;
  }
  const sorted = [...events].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  return sorted[0] || null;
}
function ensureEventFees(ev) {
  if (ev && !ev.fees) {
    ev.fees = { labor: 0, chafing: 0, travel: 0, kitchen: 0, custom: 0 };
  }
  return ev ? ev.fees : null;
}
function ensureEventCustomCharges(ev) {
  if (!ev) return [];
  if (!Array.isArray(ev.customCharges)) ev.customCharges = [];
  return ev.customCharges;
}
function ensureEventDiscount(ev) {
  if (!ev) return { description: "", amount: 0 };
  if (!ev.discount || typeof ev.discount !== 'object') {
    ev.discount = { description: "", amount: 0 };
  } else {
    ev.discount.description = String(ev.discount.description || '');
    ev.discount.amount = Number(ev.discount.amount || 0);
  }
  return ev.discount;
}
function getCustomTotalsForEvent(ev) {
  const list = ensureEventCustomCharges(ev);
  let total = 0;
  let taxableTotal = 0;
  list.forEach((ch) => {
    const amt = Number(ch && ch.amount || 0);
    total += amt;
    if (!ch || ch.taxable !== false) taxableTotal += amt;
  });
  // Back-compat: include single fees.custom if present but not duplicated in list
  const fallback = Number((ev && ev.fees && ev.fees.custom) || 0);
  if (fallback > 0 && total <= 0) { total += fallback; taxableTotal += fallback; }
  return { total, taxableTotal };
}
function getCustomTotalsForActiveEvent() {
  const ev = getActiveEvent();
  return getCustomTotalsForEvent(ev || {});
}
function getFeesForActiveEvent() {
  const ev = getActiveEvent();
  if (ev) {
    return ensureEventFees(ev);
  }
  return state.fees;
}
function setFeeForActiveEvent(key, value) {
  const ev = getActiveEvent();
  if (ev) {
    const fees = ensureEventFees(ev);
    fees[key] = value;
  } else {
    state.fees[key] = value;
  }
}

// Event guests helpers
function getGuestsForActiveEvent() {
  const ev = getActiveEvent();
  if (ev && typeof ev.guests === 'number') {
    // If event guests not set or zero, fallback to global client guests
    return ev.guests > 0 ? ev.guests : (state.client.guests || 0);
  }
  return state.client.guests || 0;
}
function setGuestsForActiveEvent(value) {
  const ev = getActiveEvent();
  if (ev) {
    ev.guests = Number(value || 0);
  } else {
    state.client.guests = Number(value || 0);
  }
}
// Event type helpers
function getEventTypeForActiveEvent() {
  const ev = getActiveEvent();
  return (ev && typeof ev.type === 'string') ? ev.type : '';
}
function setEventTypeForActiveEvent(value) {
  const ev = getActiveEvent();
  if (ev) {
    ev.type = String(value || '');
  }
}
// Event timing helpers
function getEventTimingForActiveEvent() {
  const ev = getActiveEvent();
  return (ev && typeof ev.timing === 'string') ? ev.timing : '';
}
function setEventTimingForActiveEvent(value) {
  const ev = getActiveEvent();
  if (ev) {
    ev.timing = String(value || '');
  }
}

// Event address helpers
function getEventAddressForActiveEvent() {
  const ev = getActiveEvent();
  return (ev && typeof ev.address === 'string') ? ev.address : (state.client.address || '');
}
function setEventAddressForActiveEvent(value) {
  const ev = getActiveEvent();
  if (ev) {
    ev.address = String(value || '');
  } else {
    state.client.address = String(value || '');
  }
}
// Event note helpers
function getEventNoteForActiveEvent() {
  const ev = getActiveEvent();
  return (ev && typeof ev.note === 'string') ? ev.note : '';
}
function setEventNoteForActiveEvent(value) {
  const ev = getActiveEvent();
  if (ev) {
    ev.note = String(value || '');
  }
}

function resetState() {
  state.client = { name: "", planner: "", date: "", guests: 0, address: "", events: [] };
  state.stations = [];
  state.autoPricePerPerson = false;
  state.pricePerPerson = 0;
  state.fees = { labor: 0, chafing: 0, travel: 0, kitchen: 0 };
  state.taxRate = 0.06;
  state.activeEventId = "";
}

// Station and items
function addStation() {
  if (!state.activeEventId) {
    alert("Please select or add an event date before adding stations.");
    return;
  }
  state.stations.push({ name: "", items: [], eventId: state.activeEventId, laborCount: 0, laborCost: 250, hideFromPrint: false });
  renderStations();
  calculateTotals();
}

function removeStation(idx) {
  state.stations.splice(idx, 1);
  renderStations();
  calculateTotals();
}

function addItemToStation(idx) {
  state.stations[idx].items.push({ name: "", price: 0, labor: 0 });
  renderStations();
  calculateTotals();
}

function removeItem(stationIdx, itemIdx) {
  state.stations[stationIdx].items.splice(itemIdx, 1);
  renderStations();
  calculateTotals();
}

function renderStations() {
  const container = el("stationsContainer");
  container.innerHTML = "";
  const visibleStations = state.activeEventId ? state.stations.filter((st) => st.eventId === state.activeEventId) : state.stations;

  if (state.activeEventId) {
    const ev = state.client.events.find((ev) => ev.id === state.activeEventId);
    if (ev) {
      const banner = document.createElement("div");
      banner.className = "rooms-line";
      const guests = (typeof ev.guests === 'number') ? ev.guests : (state.client.guests || 0);
      banner.textContent = `Showing stations for event date: ${ev.date} — Guests: ${guests}`;
      container.appendChild(banner);
    }
  }

  visibleStations.forEach((station) => {
    const sIdx = state.stations.indexOf(station);
    const wrapper = document.createElement("div");
    wrapper.className = "station";
    // Tag wrapper with station index to allow focusing after re-render
    wrapper.dataset.sidx = String(sIdx);

    const header = document.createElement("div");
    header.className = "station-header";
    // Labor fields (column before station name)
  const laborWrap = document.createElement("div");
  laborWrap.className = "station-labor";
  const laborLabel = document.createElement("label");
  laborLabel.textContent = "Total Labor";
  const laborInput = document.createElement("input");
    laborInput.type = "number";
    laborInput.min = "0";
    laborInput.step = "1";
    // Initialize from item-level labor sum and make read-only
    const initialLaborSum = station.items.reduce((sum, it) => sum + Number(it.labor || 0), 0);
    station.laborCount = initialLaborSum;
    laborInput.value = Number(station.laborCount || 0);
    laborInput.readOnly = true;
    laborInput.tabIndex = -1;
    const laborCostLabel = document.createElement("label");
    laborCostLabel.textContent = "Labor Cost";
    const laborCostInput = document.createElement("input");
    laborCostInput.type = "number";
    laborCostInput.min = "0";
    laborCostInput.step = "0.01";
    laborCostInput.value = Number(station.laborCost || 0);
    laborCostInput.addEventListener("input", (e) => {
      station.laborCost = Number(e.target.value || 0);
      calculateTotals();
    });
    laborWrap.appendChild(laborLabel);
    laborWrap.appendChild(laborInput);
    laborWrap.appendChild(laborCostLabel);
    laborWrap.appendChild(laborCostInput);
    const nameInput = document.createElement("input");
    nameInput.className = "station-name";
    nameInput.type = "text";
    nameInput.placeholder = "Station name (e.g., Cocktail, Main)";
    nameInput.value = station.name;
    if ((station.name || '').trim()) {
      nameInput.classList.add('has-text');
    }
    nameInput.addEventListener("input", (e) => {
      const raw = e.target.value || '';
      station.name = raw.trim();
      if (raw.trim()) {
        nameInput.classList.add('has-text');
      } else {
        nameInput.classList.remove('has-text');
      }
    });

    const addItemBtn = document.createElement("button");
    addItemBtn.textContent = "Add Item";
    addItemBtn.addEventListener("click", () => addItemToStation(sIdx));

    const removeStationBtn = document.createElement("button");
    removeStationBtn.textContent = "Remove Station";
    removeStationBtn.className = "danger";
    removeStationBtn.addEventListener("click", () => removeStation(sIdx));

    header.appendChild(nameInput);
    header.appendChild(addItemBtn);
    header.appendChild(removeStationBtn);
    wrapper.appendChild(header);

    const table = document.createElement("table");
    table.className = "items-table";
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th style="width:65%">Item</th><th style="width:15%">Price</th><th style="width:10%">Labor</th><th style="width:10%"></th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement("tbody");

    station.items.forEach((item, iIdx) => {
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      const priceTd = document.createElement("td");
      const laborTd = document.createElement("td");
      const actionTd = document.createElement("td");

      const itemName = document.createElement("input");
      itemName.type = "text";
      itemName.className = "item-name";
      itemName.placeholder = "Item name";
      itemName.value = item.name;
      itemName.addEventListener("input", (e) => {
        item.name = e.target.value.trim();
      });
      nameTd.appendChild(itemName);

      const itemPrice = document.createElement("input");
      itemPrice.type = "number";
      itemPrice.step = "0.01";
      itemPrice.min = "0";
      itemPrice.className = "item-price";
      // Show blank when the value is 0; keep non-zero values visible
      itemPrice.value = (Number(item.price || 0) !== 0) ? String(item.price) : "";
      itemPrice.addEventListener("input", (e) => {
        item.price = Number(e.target.value || 0);
        calculateTotals();
      });
      // Tab from Price should move focus to Labor (same row)
      let tabHandled = false;
      itemPrice.addEventListener("keydown", (e) => {
        if ((e.key === "Tab" || e.keyCode === 9) && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          tabHandled = true;
          // Move focus to the Labor input for this row and select its value
          try {
            if (itemLabor) {
              itemLabor.focus();
              // Ensure selection after focus for consistent behavior
              setTimeout(() => {
                try { itemLabor.select(); } catch (_) {}
              }, 0);
            }
          } catch (_) {}
        }
      });
      // Extra safety: prevent default Tab on keyup to avoid jumping to Remove
      itemPrice.addEventListener("keyup", (e) => {
        if ((e.key === "Tab" || e.keyCode === 9) && !e.shiftKey) {
          if (tabHandled) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      });
      // Arrow key navigation for Price: Up/Down move within the column
      itemPrice.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.keyCode === 38) {
          e.preventDefault();
          e.stopPropagation();
          const stationEl = document.querySelector(`.station[data-sidx="${sIdx}"]`);
          if (!stationEl) return;
          const rows = stationEl.querySelectorAll('.items-table tbody tr');
          const targetIndex = iIdx - 1;
          if (targetIndex >= 0) {
            const r = rows[targetIndex];
            if (r) {
              const priceInput = r.querySelector('input.item-price');
              if (priceInput) priceInput.focus();
            }
          }
        } else if (e.key === "ArrowDown" || e.keyCode === 40) {
          e.preventDefault();
          e.stopPropagation();
          const stationEl = document.querySelector(`.station[data-sidx="${sIdx}"]`);
          if (!stationEl) return;
          const rows = stationEl.querySelectorAll('.items-table tbody tr');
          const targetIndex = iIdx + 1;
          if (targetIndex < rows.length) {
            const r = rows[targetIndex];
            if (r) {
              const priceInput = r.querySelector('input.item-price');
              if (priceInput) priceInput.focus();
            }
          }
        }
      });
      priceTd.appendChild(itemPrice);

      // Per-item labor input
      const itemLabor = document.createElement("input");
      itemLabor.type = "number";
      itemLabor.step = "1";
      itemLabor.min = "0";
      itemLabor.className = "item-labor";
      // Show blank when the value is 0; keep non-zero values visible
      itemLabor.value = (Number(item.labor || 0) !== 0) ? String(item.labor) : "";
      itemLabor.addEventListener("input", (e) => {
        item.labor = Number(e.target.value || 0);
        // Sum item labor into station total labor
        const sumLabor = state.stations[sIdx].items.reduce((acc, it) => acc + Number(it.labor || 0), 0);
        station.laborCount = sumLabor;
        laborInput.value = Number(station.laborCount || 0);
        calculateTotals();
      });
      // Tab from Labor should auto-add new item row (previous behavior moved here)
      let laborTabHandled = false;
      itemLabor.addEventListener("keydown", (e) => {
        if ((e.key === "Tab" || e.keyCode === 9) && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          laborTabHandled = true;
          // Insert a new item directly after the current row
          state.stations[sIdx].items.splice(iIdx + 1, 0, { name: "", price: 0, labor: 0 });
          renderStations();
          calculateTotals();
          // Focus the newly inserted row's item name input
          setTimeout(() => {
            const stationEl = document.querySelector(`.station[data-sidx="${sIdx}"]`);
            if (!stationEl) return;
            const rows = stationEl.querySelectorAll('.items-table tbody tr');
            const targetIndex = iIdx + 1; // new row position after current
            const r = rows[targetIndex];
            if (r) {
              const nameInput = r.querySelector('td:first-child input[type="text"]');
              if (nameInput) nameInput.focus();
            }
          }, 0);
        }
      });
      itemLabor.addEventListener("keyup", (e) => {
        if ((e.key === "Tab" || e.keyCode === 9) && !e.shiftKey) {
          if (laborTabHandled) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      });
      // Arrow key navigation for Labor: Up/Down move within the column
      itemLabor.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.keyCode === 38) {
          e.preventDefault();
          e.stopPropagation();
          const stationEl = document.querySelector(`.station[data-sidx="${sIdx}"]`);
          if (!stationEl) return;
          const rows = stationEl.querySelectorAll('.items-table tbody tr');
          const targetIndex = iIdx - 1;
          if (targetIndex >= 0) {
            const r = rows[targetIndex];
            if (r) {
              const laborInputEl = r.querySelector('input.item-labor');
              if (laborInputEl) laborInputEl.focus();
            }
          }
        } else if (e.key === "ArrowDown" || e.keyCode === 40) {
          e.preventDefault();
          e.stopPropagation();
          const stationEl = document.querySelector(`.station[data-sidx="${sIdx}"]`);
          if (!stationEl) return;
          const rows = stationEl.querySelectorAll('.items-table tbody tr');
          const targetIndex = iIdx + 1;
          if (targetIndex < rows.length) {
            const r = rows[targetIndex];
            if (r) {
              const laborInputEl = r.querySelector('input.item-labor');
              if (laborInputEl) laborInputEl.focus();
            }
          }
        }
      });
      laborTd.appendChild(itemLabor);

      const removeItemBtn = document.createElement("button");
      removeItemBtn.textContent = "Remove";
      removeItemBtn.className = "secondary";
      removeItemBtn.addEventListener("click", () => removeItem(sIdx, iIdx));
      actionTd.appendChild(removeItemBtn);

      tr.appendChild(nameTd);
      tr.appendChild(priceTd);
      tr.appendChild(laborTd);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    // Place labor controls at the bottom of items for this station
    wrapper.appendChild(laborWrap);

    // Print options: hide station from printing
    const optionsWrap = document.createElement("div");
    optionsWrap.className = "station-options";
    const hideLabel = document.createElement("label");
    hideLabel.className = "inline-input";
    const hideCb = document.createElement("input");
    hideCb.type = "checkbox";
    hideCb.checked = !!station.hideFromPrint;
    hideCb.addEventListener("change", (e) => {
      station.hideFromPrint = !!e.target.checked;
    });
    const hideText = document.createElement("span");
    hideText.textContent = "Hide this station in print";
    hideLabel.appendChild(hideCb);
    hideLabel.appendChild(hideText);
    optionsWrap.appendChild(hideLabel);
    wrapper.appendChild(optionsWrap);

    const stationTotal = station.items.reduce((sum, it) => sum + Number(it.price || 0), 0);
    const totalEl = document.createElement("div");
    totalEl.className = "station-total";
    totalEl.textContent = `Station Total: ${currency(stationTotal)}`;
    wrapper.appendChild(totalEl);

    container.appendChild(wrapper);
  });
}

function computeTotalsForStations(stations, fees, guestsCount) {
  // Include all stations in financial calculations; hide flag is for display only
  const stationsForCalc = Array.isArray(stations) ? stations : [];
  const totalItems = stationsForCalc.reduce(
    (sum, st) => sum + st.items.reduce((s, it) => s + Number(it.price || 0), 0),
    0
  );

  // Labor totals from stations: sum(count × cost) and aggregated count
  const laborCalculated = stationsForCalc.reduce((sum, st) => {
    const count = Number(st.laborCount || 0);
    const cost = Number(st.laborCost || 0);
    return sum + (count * cost);
  }, 0);
  const laborCountTotal = stationsForCalc.reduce((sum, st) => sum + Number(st.laborCount || 0), 0);
  const f = fees || state.fees;
  const laborTotal = laborCalculated;

  const guests = typeof guestsCount === 'number' ? guestsCount : (state.client.guests || 0);
  const totalFoodCost = totalItems * guests;
  const baseSubtotal = totalFoodCost + laborTotal + (f.chafing || 0) + (f.travel || 0) + (f.kitchen || 0);
  // Derive custom totals when available
  let customTotal = Number(f.custom || 0);
  let taxableCustom = customTotal;
  if (typeof f._customTotals === 'object') {
    customTotal = Number(f._customTotals.total || 0);
    taxableCustom = Number(f._customTotals.taxableTotal || 0);
  }
  const discountAmt = Number(f._discountAmount || 0);
  const subtotal = baseSubtotal + customTotal - discountAmt;
  const taxBase = totalFoodCost + Number(f.chafing || 0) + Number(f.travel || 0) + Number(f.kitchen || 0) + Number(taxableCustom || 0);
  const appliedRate = (state.chargeTax === false) ? 0 : (state.taxRate || 0);
  const taxAmount = taxBase * appliedRate;
  const grandTotal = subtotal + taxAmount;

  return { totalItems, totalFoodCost, laborTotal, laborCalculated, laborCountTotal, subtotal, taxAmount, grandTotal };
}

// Compute a weighted average labor rate from station-level labor costs
function deriveLaborRateFromStations(stations) {
  const stationsForCalc = Array.isArray(stations) ? stations : [];
  const totalCount = stationsForCalc.reduce((sum, st) => sum + Number(st.laborCount || 0), 0);
  if (totalCount <= 0) return 0;
  const weightedSum = stationsForCalc.reduce((sum, st) => sum + (Number(st.laborCount || 0) * Number(st.laborCost || 0)), 0);
  return weightedSum / totalCount;
}

function computeTotals() {
  const stations = state.activeEventId ? state.stations.filter((st) => st.eventId === state.activeEventId) : state.stations;
  const fees = state.activeEventId ? getFeesForActiveEvent() : state.fees;
  const ev = getActiveEvent();
  const customTotals = ev ? getCustomTotalsForEvent(ev) : { total: Number(fees.custom || 0), taxableTotal: Number(fees.custom || 0) };
  fees._customTotals = customTotals;
  const disc = ev ? ensureEventDiscount(ev) : { amount: 0 };
  fees._discountAmount = Number(disc.amount || 0);
  const guests = state.activeEventId ? getGuestsForActiveEvent() : (state.client.guests || 0);
  return computeTotalsForStations(stations, fees, guests);
}

function calculateTotals() {
  const t = computeTotals();
  el("totalItemsPrice").textContent = currency(t.totalItems);
  el("totalFoodCost").textContent = currency(t.totalFoodCost);
  // Show the calculation formula inline: Items × Guests = Total
  const guestsNow = getGuestsForActiveEvent();
  const formulaEl = el("foodCostFormula");
  if (formulaEl) {
    const itemsStr = currency(t.totalItems);
    const totalStr = currency(t.totalFoodCost);
    formulaEl.textContent = `Items ${itemsStr} × Guests ${guestsNow} = ${totalStr}`;
  }
  // Reflect manual labor fee in totals input
  const laborInput = el("laborCost");
  if (laborInput) {
    const stations = state.activeEventId ? state.stations.filter((st) => st.eventId === state.activeEventId) : state.stations;
    const derived = deriveLaborRateFromStations(stations);
    laborInput.value = derived;
    // Persist the derived rate into fees so export/import reflect the current average
    setFeeForActiveEvent("labor", derived);
  }
  // Show calculated labor for reference
  const calcLaborEl = el("calculatedLaborValue");
  if (calcLaborEl) {
    const stations = state.activeEventId ? state.stations.filter((st) => st.eventId === state.activeEventId) : state.stations;
    const rateNow = deriveLaborRateFromStations(stations);
    calcLaborEl.textContent = `Calculated Labor: ${currency(t.laborCalculated || 0)} (Rate ${currency(rateNow)} × Count ${Number(t.laborCountTotal || 0)})`;
  }
  const laborCountEl = el("totalLaborCount");
  if (laborCountEl) laborCountEl.textContent = String(Number(t.laborCountTotal || 0));
  const calcLaborCountEl = el("calculatedLaborCount");
  if (calcLaborCountEl) calcLaborCountEl.textContent = `Calculated Count: ${Number(t.laborCountTotal || 0)}`;
  el("subtotal").textContent = currency(t.subtotal);
  el("taxAmount").textContent = currency(t.taxAmount);
  el("grandTotal").textContent = currency(t.grandTotal);
  const balance = Number(t.grandTotal || 0) - Number(state.paymentMade || 0);
  if (el("balanceLeft")) el("balanceLeft").textContent = currency(balance);
}

function renderTotalsNote() {
  const display = el("totalsNoteDisplay");
  if (!display) return;
  const note = getEventNoteForActiveEvent().trim();
  if (note) {
    display.textContent = `Note: ${note}`;
    display.style.display = '';
  } else {
    display.textContent = '';
    display.style.display = 'none';
  }
}

function buildPrintView() {
  const events = (state.client.events || []);
  if (events.length > 1) {
    // Build multi-page estimate: one page per event
    const root = document.getElementById('printView');
    if (!root) return;
    const originalChildren = Array.from(root.children);
    originalChildren.forEach((child) => child.setAttribute('data-hidden', 'true'));
    originalChildren.forEach((child) => child.style.display = 'none');
    // Remove any previous generated pages
    Array.from(root.querySelectorAll('.estimate-page')).forEach((n) => n.remove());

    let grandTotalSum = 0;
    [...events].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)).forEach((ev) => {
      // Filter stations for this event and compute totals with event-specific fees
      const stationsForEvent = state.stations.filter((st) => st.eventId === ev.id);
      const fees = ensureEventFees(ev) || state.fees;
      fees._customTotals = getCustomTotalsForEvent(ev);
      const guests = typeof ev.guests === 'number' ? ev.guests : (state.client.guests || 0);
      const type = (typeof ev.type === 'string') ? ev.type : '';
      const timing = (typeof ev.timing === 'string') ? ev.timing : '';
      const totals = computeTotalsForStations(stationsForEvent, fees, guests);
      grandTotalSum += Number(totals.grandTotal || 0);

      const page = document.createElement('div');
      page.className = 'estimate-page';

      // Header
      const header = document.createElement('div');
      header.className = 'print-header';
      const brand = document.createElement('div');
      brand.className = 'brand';
      const brandImg = document.createElement('img');
      brandImg.className = 'brand-logo';
      brandImg.alt = 'Brand Logo';
      const brandText = document.createElement('span');
      brandText.className = 'brand-text';
      brandText.textContent = 'Peri Peri Catering';
      brand.appendChild(brandImg);
      brand.appendChild(brandText);
      const company = document.createElement('div');
      company.className = 'company';
      company.innerHTML = '<div>4450 Nelson Brogdon Blvd</div><div>Suite A-10-C</div><div>Buford, GA 30518</div><div>www.peripericatering.com</div><div>Raj Chahal : 404-771-9803</div>';
      header.appendChild(brand);
      header.appendChild(company);
      page.appendChild(header);

      const title = document.createElement('h1');
      title.className = 'print-title';
      title.textContent = 'Estimate';
      page.appendChild(title);

      // Client block
      const client = document.createElement('div');
      client.className = 'print-client';
      const dateDisplay = formatDateUS(ev.date || '');
      const commentText = (state.client.comment || '').trim();
      const commentHtml = commentText ? `<div class="full"><span>Comment:</span> <span>${commentText}</span></div>` : '';
      client.innerHTML = `
        <div><span>Client:</span> <span>${state.client.name || ''}</span></div>
        <div><span>Planner:</span> <span>${state.client.planner || ''}</span></div>
        <div><span>Contact:</span> <span>${state.client.phone || ''}</span></div>
        <div><span>Date:</span> <span>${dateDisplay}</span></div>
        <div><span>Guests:</span> <span>${String(guests)}</span></div>
        <div><span>Timing:</span> <span>${timing}</span></div>
        <div><span>Event Type:</span> <span>${type}</span></div>
        <div class="full"><span>Address:</span> <span>${(typeof ev.address === 'string' && ev.address) || state.client.address || ''}</span></div>
        ${commentHtml}
      `;
      page.appendChild(client);

      // Items table: group each station in its own tbody to avoid page breaks
      const table = document.createElement('table');
      table.className = 'print-table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Description</th></tr>';
      stationsForEvent.forEach((st) => {
        if (st.hideFromPrint) return;
        if (!st.name && st.items.length === 0) return;
        const tbodyGroup = document.createElement('tbody');
        tbodyGroup.className = 'keep-together';
        const sectionRow = document.createElement('tr');
        const sectionCell = document.createElement('td');
        sectionCell.className = 'station-title-row';
        sectionCell.textContent = st.name || 'Station';
        sectionCell.style.color = '#b91c1c';
        sectionCell.style.fontWeight = '600';
        sectionCell.style.textAlign = 'center';
        sectionRow.appendChild(sectionCell);
        tbodyGroup.appendChild(sectionRow);
        st.items.forEach((it) => {
          if (!it.name) return;
          const r = document.createElement('tr');
          const c = document.createElement('td');
          c.textContent = it.name;
          r.appendChild(c);
          tbodyGroup.appendChild(r);
        });
        // Divider line under the station block
        const dividerRow = document.createElement('tr');
        dividerRow.className = 'station-divider';
        const dividerCell = document.createElement('td');
        dividerCell.textContent = '';
        dividerRow.appendChild(dividerCell);
        tbodyGroup.appendChild(dividerRow);
        table.appendChild(tbodyGroup);
      });
      table.appendChild(thead);
      page.appendChild(table);

      // Totals table (wrapped to avoid page break)
      const totalsTable = document.createElement('table');
      totalsTable.className = 'print-totals';
      const tb = document.createElement('tbody');
      const rows = [];
      if (Number(totals.totalFoodCost || 0) > 0) rows.push(['Total Food Cost (items × guests)', currency(totals.totalFoodCost)]);
      if (Number(totals.laborTotal || 0) > 0) rows.push(['Labor', currency(totals.laborTotal)]);
      if (Number(fees.chafing || 0) > 0) rows.push(['Chafing charges', currency(fees.chafing)]);
      if (Number(fees.travel || 0) > 0) rows.push(['Travel charges', currency(fees.travel)]);
      if (Number(fees.kitchen || 0) > 0) rows.push(['Kitchen on wheels', currency(fees.kitchen)]);
      const discRowAmt = Number((ev && ev.discount && ev.discount.amount) || 0);
      if (discRowAmt > 0) {
        const label = (ev && ev.discount && typeof ev.discount.description === 'string' && ev.discount.description.trim()) ? ev.discount.description.trim() : 'Discount';
        rows.push([label, currency(-discRowAmt)]);
      }
      const customList = ensureEventCustomCharges(ev);
      customList.forEach((ch) => {
        const amt = Number(ch && ch.amount || 0);
        if (amt > 0) {
          const label = (ch && typeof ch.note === 'string' && ch.note.trim()) ? ch.note.trim() : 'Custom charge';
          rows.push([label, currency(amt)]);
        }
      });
      if (Number(totals.subtotal || 0) > 0) rows.push(['Subtotal', currency(totals.subtotal)]);
      if (Number(totals.taxAmount || 0) > 0) rows.push(['Tax', currency(totals.taxAmount)]);
      if (Number(totals.grandTotal || 0) > 0) rows.push(['Total Price', currency(totals.grandTotal)]);
      
      // Removed per-event payment/balance deduction to avoid double counting
      
      rows.forEach(([label, value], idx) => {
        const tr = document.createElement('tr');
        if (idx === rows.length - 1) tr.className = 'grand';
        const td1 = document.createElement('td');
        td1.textContent = label;
        const td2 = document.createElement('td');
        td2.className = 'amount';
        td2.textContent = value;
        tr.appendChild(td1);
        tr.appendChild(td2);
        tb.appendChild(tr);
      });
      totalsTable.appendChild(tb);
      const totalsWrap = document.createElement('div');
      totalsWrap.className = 'keep-together';
      totalsWrap.appendChild(totalsTable);
      page.appendChild(totalsWrap);
      const noteText = (typeof ev.note === 'string') ? ev.note.trim() : '';
      if (noteText) {
        const noteRow = document.createElement('tr');
        noteRow.className = 'note';
        const noteCell = document.createElement('td');
        noteCell.colSpan = 2;
        noteCell.textContent = `Note: ${noteText}`;
        tb.appendChild(noteRow);
        noteRow.appendChild(noteCell);
      }

      root.appendChild(page);
    });

    // Append Summary Page
    const summaryPage = document.createElement('div');
    summaryPage.className = 'estimate-page';
    const sHeader = document.createElement('div');
    sHeader.className = 'print-header';
    sHeader.innerHTML = `<div class="brand"><img class="brand-logo" alt="Brand Logo" /><span class="brand-text">Peri Peri Catering</span></div><div class="company"><div>4450 Nelson Brogdon Blvd</div><div>Suite A-10-C</div><div>Buford, GA 30518</div><div>www.peripericatering.com</div><div>Raj Chahal : 404-771-9803</div></div>`;
    summaryPage.appendChild(sHeader);
    const sTitle = document.createElement('h1');
    sTitle.className = 'print-title';
    sTitle.textContent = 'Estimate Summary';
    summaryPage.appendChild(sTitle);
    
    const sClient = document.createElement('div');
    sClient.className = 'print-client';
    sClient.innerHTML = `
        <div><span>Client:</span> <span>${state.client.name || ''}</span></div>
        <div><span>Date:</span> <span>${formatDateUS(state.client.date || '')}</span></div>
    `;
    summaryPage.appendChild(sClient);
    
    const sTable = document.createElement('table');
    sTable.className = 'print-totals';
    const sTb = document.createElement('tbody');
    const sRows = [];
    sRows.push(['Total Estimate (All Events)', currency(grandTotalSum)]);
    const paySum = Number(state.paymentMade || 0);
    if (paySum > 0) sRows.push(['Payment Received', currency(paySum)]);
    const balSum = grandTotalSum - paySum;
    if (balSum > 0) sRows.push(['Balance Due', currency(balSum)]);
    else if (balSum <= 0) sRows.push(['Balance Due', currency(0)]);

    sRows.forEach(([label, value], idx) => {
        const tr = document.createElement('tr');
        if (idx === sRows.length - 1) tr.className = 'grand';
        const td1 = document.createElement('td');
        td1.textContent = label;
        const td2 = document.createElement('td');
        td2.className = 'amount';
        td2.textContent = value;
        tr.appendChild(td1);
        tr.appendChild(td2);
        sTb.appendChild(tr);
    });
    sTable.appendChild(sTb);
    summaryPage.appendChild(sTable);
    root.appendChild(summaryPage);

    applyBrandLogo();
    applyCompanyHeader();
    // Cleanup after print: remove generated pages and restore original content visibility
    const cleanup = () => {
      const root = document.getElementById('printView');
      if (!root) return;
      Array.from(root.querySelectorAll('.estimate-page')).forEach((n) => n.remove());
      Array.from(root.children).forEach((child) => {
        if (child.getAttribute('data-hidden') === 'true') {
          child.style.display = '';
          child.removeAttribute('data-hidden');
        }
      });
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
  } else {
    // Single-event saved Estimate: generate multi-page export (one page per station + totals)
    const root = document.getElementById('printView');
    if (!root) return;
    const originalChildren = Array.from(root.children);
    originalChildren.forEach((child) => child.setAttribute('data-hidden', 'true'));
    originalChildren.forEach((child) => child.style.display = 'none');
    // Remove any previous generated pages
    Array.from(root.querySelectorAll('.estimate-page')).forEach((n) => n.remove());

    const evForPrint = state.activeEventId ? (state.client.events || []).find((ev) => ev.id === state.activeEventId) : null;
    const guests = getGuestsForActiveEvent();
    const type = getEventTypeForActiveEvent() || '';
    const timing = (evForPrint && typeof evForPrint.timing === 'string') ? evForPrint.timing : '';
    const dateDisplay = formatDateUS(((evForPrint && evForPrint.date) || state.client.date || ''));
    const stationsForPrint = state.activeEventId ? state.stations.filter((st) => st.eventId === state.activeEventId) : state.stations;

    const makeHeader = () => {
      const header = document.createElement('div');
      header.className = 'print-header';
      const brand = document.createElement('div');
      brand.className = 'brand';
      const brandImg = document.createElement('img');
      brandImg.className = 'brand-logo';
      brandImg.alt = 'Brand Logo';
      const brandText = document.createElement('span');
      brandText.className = 'brand-text';
      brandText.textContent = 'Peri Peri Catering';
      brand.appendChild(brandImg);
      brand.appendChild(brandText);
      const company = document.createElement('div');
      company.className = 'company';
      const h = getCompanyHeader();
      company.innerHTML = (h.lines || []).map((l) => `<div>${l}</div>`).join('');
      header.appendChild(brand);
      header.appendChild(company);
      return header;
    };
    const makeClient = () => {
      const client = document.createElement('div');
      client.className = 'print-client';
      const commentText = (state.client.comment || '').trim();
      const commentHtml = commentText ? `<div class="full"><span>Comment:</span> <span>${commentText}</span></div>` : '';
      client.innerHTML = `
        <div><span>Client:</span> <span>${state.client.name || ''}</span></div>
        <div><span>Planner:</span> <span>${state.client.planner || ''}</span></div>
        <div><span>Contact:</span> <span>${state.client.phone || ''}</span></div>
        <div><span>Date:</span> <span>${dateDisplay}</span></div>
        <div><span>Guests:</span> <span>${String(guests)}</span></div>
        <div><span>Timing:</span> <span>${timing}</span></div>
        <div><span>Event Type:</span> <span>${type}</span></div>
        <div class="full"><span>Address:</span> <span>${(evForPrint && evForPrint.address) || state.client.address || ''}</span></div>
        ${commentHtml}
      `;
      return client;
    };

    const printableStations = stationsForPrint.filter((st) => !st.hideFromPrint && (st.name || st.items.length));
    const page = document.createElement('div');
    page.className = 'estimate-page';
    const title = document.createElement('h1');
    title.className = 'print-title';
    title.textContent = 'Estimate';
    page.appendChild(makeHeader());
    page.appendChild(title);
    page.appendChild(makeClient());
    const table = document.createElement('table');
    table.className = 'print-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Description</th></tr>';
    table.appendChild(thead);
    printableStations.forEach((st) => {
      const tbodyGroup = document.createElement('tbody');
      tbodyGroup.className = 'keep-together';
      const sectionRow = document.createElement('tr');
      const sectionCell = document.createElement('td');
      sectionCell.className = 'station-title-row';
      sectionCell.textContent = st.name || 'Station';
      sectionCell.style.color = '#b91c1c';
      sectionCell.style.textAlign = 'center';
      sectionRow.appendChild(sectionCell);
      tbodyGroup.appendChild(sectionRow);
      st.items.forEach((it) => {
        if (!it.name) return;
        const r = document.createElement('tr');
        const c = document.createElement('td');
        c.textContent = it.name;
        r.appendChild(c);
        tbodyGroup.appendChild(r);
      });
      const dividerRow = document.createElement('tr');
      dividerRow.className = 'station-divider';
      const dividerCell = document.createElement('td');
      dividerCell.textContent = '';
      dividerRow.appendChild(dividerCell);
      tbodyGroup.appendChild(dividerRow);
      table.appendChild(tbodyGroup);
    });
    page.appendChild(table);
    root.appendChild(page);

    // Final totals page (skip entirely when hide-total is enabled)
    const hideTotals = document.body.classList.contains('hide-print-total');
    if (!hideTotals) {
      const totals = computeTotals();
      const fees = getFeesForActiveEvent();
      const totalsPage = document.createElement('div');
      totalsPage.className = 'estimate-page';
      const totalsTitle = document.createElement('h1');
      totalsTitle.className = 'print-title';
      totalsTitle.textContent = 'Estimate';
      totalsPage.appendChild(makeHeader());
      totalsPage.appendChild(totalsTitle);
      totalsPage.appendChild(makeClient());
      const totalsTable = document.createElement('table');
      totalsTable.className = 'print-totals';
      const tb = document.createElement('tbody');
      const rows = [];
      if (Number(totals.totalFoodCost || 0) > 0) rows.push(['Total Food Cost (items × guests)', currency(totals.totalFoodCost)]);
      if (Number(totals.laborTotal || 0) > 0) rows.push(['Labor', currency(totals.laborTotal)]);
      if (Number(fees.chafing || 0) > 0) rows.push(['Chafing charges', currency(fees.chafing)]);
      if (Number(fees.travel || 0) > 0) rows.push(['Travel charges', currency(fees.travel)]);
      if (Number(fees.kitchen || 0) > 0) rows.push(['Kitchen on wheels', currency(fees.kitchen)]);
      const discRowAmt2 = Number(((evForPrint && evForPrint.discount && evForPrint.discount.amount) || 0));
      if (discRowAmt2 > 0) {
        const label2 = (evForPrint && evForPrint.discount && typeof evForPrint.discount.description === 'string' && evForPrint.discount.description.trim()) ? evForPrint.discount.description.trim() : 'Discount';
        rows.push([label2, currency(-discRowAmt2)]);
      }
      const customList2 = ensureEventCustomCharges(evForPrint || {});
      customList2.forEach((ch) => {
        const amt = Number(ch && ch.amount || 0);
        if (amt > 0) {
          const label = (ch && typeof ch.note === 'string' && ch.note.trim()) ? ch.note.trim() : 'Custom charge';
          rows.push([label, currency(amt)]);
        }
      });
      if (Number(totals.subtotal || 0) > 0) rows.push(['Subtotal', currency(totals.subtotal)]);
      if (Number(totals.taxAmount || 0) > 0) rows.push(['Tax', currency(totals.taxAmount)]);
      if (Number(totals.grandTotal || 0) > 0) rows.push(['Total Price', currency(totals.grandTotal)]);
      const pay2 = Number(state.paymentMade || 0);
      if (pay2 > 0) rows.push(['Payment Received', currency(pay2)]);
      const bal2 = Number(totals.grandTotal || 0) - pay2;
      if (Number(bal2 || 0) > 0) rows.push(['Balance', currency(bal2)]);
      rows.forEach(([label, value], idx) => {
        const tr = document.createElement('tr');
        if (idx === rows.length - 1) tr.className = 'grand';
        const td1 = document.createElement('td');
        td1.textContent = label;
        const td2 = document.createElement('td');
        td2.className = 'amount';
        td2.textContent = value;
        tr.appendChild(td1);
        tr.appendChild(td2);
        tb.appendChild(tr);
      });
      totalsTable.appendChild(tb);
      const totalsWrap = document.createElement('div');
      totalsWrap.className = 'keep-together';
      totalsWrap.appendChild(totalsTable);
      totalsPage.appendChild(totalsWrap);
      const noteText = (evForPrint && typeof evForPrint.note === 'string') ? evForPrint.note.trim() : '';
      if (noteText) {
        const tb2 = totalsTable.querySelector('tbody') || tb;
        const noteRow = document.createElement('tr');
        noteRow.className = 'note';
        const noteCell = document.createElement('td');
        noteCell.colSpan = 2;
        noteCell.textContent = `Note: ${noteText}`;
        tb2.appendChild(noteRow);
        noteRow.appendChild(noteCell);
      }
      root.appendChild(totalsPage);
    }

    applyBrandLogo();
    // Cleanup after print: remove generated pages and restore original content visibility
    const cleanup = () => {
      const root2 = document.getElementById('printView');
      if (!root2) return;
      Array.from(root2.querySelectorAll('.estimate-page')).forEach((n) => n.remove());
      Array.from(root2.children).forEach((child) => {
        if (child.getAttribute('data-hidden') === 'true') {
          child.style.display = '';
          child.removeAttribute('data-hidden');
        }
      });
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
  }
}

function buildContractView() {
  // Aggregate totals across all events using the active event's guest count
  const events = (state.client.events || []);
  // Sort events by date ascending for contract page order
  const sortedEvents = [...events].sort((a, b) => {
    const ad = new Date(a.date || 0).getTime();
    const bd = new Date(b.date || 0).getTime();
    return ad - bd;
  });
  const primaryEv = sortedEvents[0] || null; // earliest event for page 1 & 2
  const uniformGuests = getGuestsForActiveEvent();
  let totalsForContract = null;
  if (sortedEvents.length > 0) {
    let subtotalSum = 0;
    let taxSum = 0;
    sortedEvents.forEach((ev) => {
      const stationsForEvent = state.stations.filter((st) => st.eventId === ev.id);
      const fees = ensureEventFees(ev) || state.fees;
      fees._customTotals = getCustomTotalsForEvent(ev);
      const disc = ensureEventDiscount(ev);
      fees._discountAmount = Number(disc.amount || 0);
      const guestsForEvent = (typeof ev.guests === 'number') ? ev.guests : uniformGuests;
      const t = computeTotalsForStations(stationsForEvent, fees, guestsForEvent);
      subtotalSum += t.subtotal;
      taxSum += t.taxAmount;
    });
    const grandTotal = subtotalSum + taxSum;
    totalsForContract = { subtotal: subtotalSum, taxAmount: taxSum, grandTotal };
  } else {
    totalsForContract = computeTotals();
  }
  // Page 1: client/event meta
  el("c_clientName").textContent = state.client.name || "";
  el("c_plannerName").textContent = state.client.planner || "";
  if (el("c_clientPhone")) el("c_clientPhone").textContent = state.client.phone || "";
  if (el("c_clientPhone")) el("c_clientPhone").textContent = state.client.phone || "";
  const evDate = (primaryEv && primaryEv.date) || state.client.date || "";
  el("c_eventDate").textContent = formatDateUS(evDate);
  const primaryGuests = (primaryEv && typeof primaryEv.guests === 'number') ? primaryEv.guests : uniformGuests;
  const typesList = sortedEvents.map((ev) => (typeof ev.type === 'string') ? ev.type : '').filter((t) => t && t.trim()).join(', ');
  const guestsList = sortedEvents.map((ev) => {
    const g = (typeof ev.guests === 'number') ? ev.guests : uniformGuests;
    return String(g);
  }).join(', ');
  el("c_guestCount").textContent = guestsList || String(primaryGuests);
  if (el("c_eventTiming")) {
    el("c_eventTiming").textContent = (primaryEv && typeof primaryEv.timing === 'string') ? primaryEv.timing : '';
  }
  el("c_eventType").textContent = typesList || ((primaryEv && typeof primaryEv.type === 'string') ? primaryEv.type : "");
  const addressesList = Array.from(new Set(sortedEvents.map((ev) => {
    return (typeof ev.address === 'string' && ev.address) ? ev.address.trim() : '';
  }).filter((a) => a && a.length)));
  el("c_eventAddress").textContent = (addressesList.length ? addressesList.join(', ') : (state.client.address || ""));
  const commentVal = (state.client.comment || '').trim();
  const cRow = el("c_clientCommentRow");
  const cText = el("c_clientComment");
  if (cRow && cText) {
    if (commentVal) {
      cText.textContent = commentVal;
      cRow.style.display = '';
    } else {
      cText.textContent = '';
      cRow.style.display = 'none';
    }
  }

  // Page 2: header meta
  el("c_eventDate2").textContent = formatDateUS(evDate || "");
  el("c_guestCount2").textContent = guestsList || String(primaryGuests);
  el("c_eventType2").textContent = typesList || ((primaryEv && typeof primaryEv.type === 'string') ? primaryEv.type : "");
  if (el("c_timing2")) {
    el("c_timing2").textContent = (primaryEv && typeof primaryEv.timing === 'string') ? primaryEv.timing : (el("c_timing2").textContent || 'TBD');
  }

  // Build menu sections without prices
  const menuRoot = el("contractMenu");
  menuRoot.innerHTML = "";
  const stationsForContract = primaryEv ? state.stations.filter((st) => st.eventId === primaryEv.id) : [];
  stationsForContract.forEach((st) => {
    if (st.hideFromPrint) return;
    if (!st.name && st.items.length === 0) return;
    const title = document.createElement("div");
    title.className = "station-title";
    title.textContent = st.name || "Station";
    menuRoot.appendChild(title);
    const list = document.createElement("div");
    list.className = "menu-items";
    st.items.forEach((it) => {
      if (!it.name) return;
      const row = document.createElement("div");
      row.textContent = it.name;
      list.appendChild(row);
    });
    menuRoot.appendChild(list);
  });

  // Append additional pages for each other event (menu without prices)
  const contractRoot = el("contractView");
  // Remove previously appended event pages to avoid duplication
  Array.from(contractRoot.querySelectorAll('.contract-page.event-page')).forEach((node) => node.remove());
  const otherEvents = sortedEvents.slice(1);
  otherEvents.forEach((ev) => {
    const page = document.createElement('div');
    page.className = 'contract-page event-page';
    // Header
    const header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = `
      <div class="brand"><img class="brand-logo" alt="Brand Logo" /><span class="brand-text">Peri Peri Catering</span></div>
      <div class="company"></div>`;
    const h = getCompanyHeader();
    const companyEl = header.querySelector('.company');
    companyEl.innerHTML = (h.lines || []).map((l) => `<div>${l}</div>`).join('');
    page.appendChild(header);
    // Meta
    const meta = document.createElement('div');
    meta.className = 'contract-meta';
    const guestsForEvent = (typeof ev.guests === 'number' && ev.guests > 0) ? ev.guests : 0;
    const type = (typeof ev.type === 'string') ? ev.type : '';
    const timing = (typeof ev.timing === 'string') ? ev.timing : 'TBD';
    const dateDisplay = formatDateUS(ev.date || '');
    meta.innerHTML = `
      <div>${dateDisplay}</div>
      <div>Guest count <span>${guestsForEvent}</span></div>
      <div>Event Type: <span>${type}</span></div>
      <div>Timing: <span>${timing}</span></div>`;
    page.appendChild(meta);
    // Menu
    const menu = document.createElement('div');
    const stationsForEvent = state.stations.filter((st) => st.eventId === ev.id);
    stationsForEvent.forEach((st) => {
      if (st.hideFromPrint) return;
      if (!st.name && st.items.length === 0) return;
      const title = document.createElement('div');
      title.className = 'station-title';
      title.textContent = st.name || 'Station';
      menu.appendChild(title);
      const list = document.createElement('div');
      list.className = 'menu-items';
      st.items.forEach((it) => {
        if (!it.name) return;
        const row = document.createElement('div');
        row.textContent = it.name;
        list.appendChild(row);
      });
      menu.appendChild(list);
    });
    page.appendChild(menu);
    // Footer signature line
    const footer = document.createElement('div');
    footer.className = 'footer-sign';
    footer.innerHTML = '<span>Client____</span><span>PR____</span>';
    page.appendChild(footer);
    // Append to contract view
    contractRoot.appendChild(page);
  });

  // Ensure the total price page is last
  const pricingPage = el("c_price").closest('.contract-page');
  if (pricingPage && pricingPage.parentElement === contractRoot) {
    contractRoot.appendChild(pricingPage);
  }

  // Page 3: pricing
  const taxRatePct = (((state.chargeTax === false) ? 0 : (state.taxRate || 0)) * 100).toFixed(0);
  el("c_taxRateDisplay").textContent = `${taxRatePct}%`;
  el("c_price").textContent = currency(totalsForContract.subtotal);
  el("c_taxAmount").textContent = currency(totalsForContract.taxAmount);
  el("c_total").textContent = currency(totalsForContract.grandTotal);
  const pay = Number(state.paymentMade || 0);
  el("c_payment").textContent = currency(pay);
  el("c_balance").textContent = currency(Number(totalsForContract.grandTotal || 0) - pay);
  const kitchenIncludedEl = el("c_kitchenIncluded");
  if (kitchenIncludedEl) {
    const hasKitchenFeeForAny = sortedEvents.length
      ? sortedEvents.some((ev) => Number(((ensureEventFees(ev) || state.fees).kitchen) || 0) > 0)
      : Number(((ensureEventFees(primaryEv) || state.fees).kitchen) || 0) > 0;
    if (hasKitchenFeeForAny) {
      kitchenIncludedEl.textContent = 'Kitchen on Wheels Included';
      kitchenIncludedEl.style.display = '';
    } else {
      kitchenIncludedEl.textContent = '';
      kitchenIncludedEl.style.display = 'none';
    }
  }
  const customIncludedEl = el("c_customIncluded");
  if (customIncludedEl) {
    const charges = [];
    if (sortedEvents.length > 0) {
      sortedEvents.forEach((ev) => {
        ensureEventCustomCharges(ev).forEach((ch) => {
          const amt = Number(ch && ch.amount || 0);
          const note = (ch && typeof ch.note === 'string' && ch.note.trim()) ? ch.note.trim() : '';
          if (amt > 0 && note) charges.push({ note, amt });
        });
        // Fallback single fees.custom with customNote
        const fallbackAmt = Number((ev && ev.fees && ev.fees.custom) || 0);
        const fallbackNote = (ev && typeof ev.customNote === 'string' && ev.customNote.trim()) ? ev.customNote.trim() : '';
        if (fallbackAmt > 0 && fallbackNote) charges.push({ note: fallbackNote, amt: fallbackAmt });
      });
    } else {
      const ev = primaryEv;
      if (ev) {
        ensureEventCustomCharges(ev).forEach((ch) => {
          const amt = Number(ch && ch.amount || 0);
          const note = (ch && typeof ch.note === 'string' && ch.note.trim()) ? ch.note.trim() : '';
          if (amt > 0 && note) charges.push({ note, amt });
        });
        const fallbackAmt = Number((ev && ev.fees && ev.fees.custom) || 0);
        const fallbackNote = (ev && typeof ev.customNote === 'string' && ev.customNote.trim()) ? ev.customNote.trim() : '';
        if (fallbackAmt > 0 && fallbackNote) charges.push({ note: fallbackNote, amt: fallbackAmt });
      }
    }
    if (charges.length > 0) {
      customIncludedEl.innerHTML = charges.map((c) => `<div>${c.note} <span class="amount">${currency(c.amt)}</span></div>`).join('');
      customIncludedEl.style.display = '';
    } else {
      customIncludedEl.textContent = '';
      customIncludedEl.style.display = 'none';
    }
  }
  const discountIncludedEl = el("c_discountIncluded");
  if (discountIncludedEl) {
    const discounts = [];
    if (sortedEvents.length > 0) {
      sortedEvents.forEach((ev) => {
        const d = ensureEventDiscount(ev);
        const amt = Number(d.amount || 0);
        const note = (typeof d.description === 'string' && d.description.trim()) ? d.description.trim() : '';
        if (amt > 0) discounts.push({ note: note || 'Discount', amt });
      });
    } else {
      const d = ensureEventDiscount(primaryEv || {});
      const amt = Number(d.amount || 0);
      const note = (typeof d.description === 'string' && d.description.trim()) ? d.description.trim() : '';
      if (amt > 0) discounts.push({ note: note || 'Discount', amt });
    }
    if (discounts.length > 0) {
      discountIncludedEl.innerHTML = discounts.map((c) => `<div>${c.note} <span class="amount">${currency(-c.amt)}</span></div>`).join('');
      discountIncludedEl.style.display = '';
    } else {
      discountIncludedEl.textContent = '';
      discountIncludedEl.style.display = 'none';
    }
  }

  // Apply custom wording if present
  const tpl = getContractTemplate();
  if (tpl && tpl.termsText) {
    const ol = document.querySelector('#contractView .terms');
    renderTermsFromText(tpl.termsText, ol);
  }
  const hasKitchenFee = sortedEvents.length
    ? sortedEvents.some((ev) => Number(((ensureEventFees(ev) || state.fees).kitchen) || 0) > 0)
    : Number(((ensureEventFees(primaryEv) || state.fees).kitchen) || 0) > 0;
  const includesEl = document.querySelector('#contractView .notes');
  applyBrandLogo();
  applyCompanyHeader();
}

// Contract template storage
const CONTRACT_TEMPLATE_KEY = 'contract_template_v1';

function getContractTemplate() {
  try {
    const raw = localStorage.getItem(CONTRACT_TEMPLATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setContractTemplate(tpl) {
  localStorage.setItem(CONTRACT_TEMPLATE_KEY, JSON.stringify(tpl));
}

function defaultContractTemplate() {
  return {
    termsText: `Punjabi Rasoi will not provide the following list of items:\n- Tables, Table Clothes\n- Cutlery or Disposables (optional when requested for extra charges)\n- Trash removal (optional when requested for extra charges)\n- Cleaning and Bussing (optional when requested for extra charges)\n\nPunjabi Rasoi requires to be informed of any changes to the menu or number of guests 4 weeks prior to the event date. Guest can make changes or substitute menu items with similar food items 4 weeks before the event date. Punjabi Rasoi LLC keeps the right to charge the client for total number of guest count based on total seats reserved in the venue. Punjabi Rasoi LLC wants to keep the rights to inquire the venue for this information so that Punjabi Rasoi LLC can prepare food for your guest accordingly. If guest count goes down only food cost changes, other cost remains unchanged.\n\nCancellation Policy: After booking the event if for any reason client decides not to go with Punjabi Rasoi LLC, Punjabi Rasoi keeps the right to keep the total deposit for the effort, time spent on planning the event and holding the date. If event is postponed due to any reason other than act of God (pandemic, storms etc.) Punjabi Rasoi LLC keeps the right to keep 30% of total event amount for the date reserved for the event. If for any reason Punjabi Rasoi decides to cancel the event full amount is refunded to the client.\n\nLoad in and load time can change based on timeline. Punjabi Rasoi will notify if we cannot reach on time for load in and load out, due to circumstances (traffic, bad weather, vehicle broke down etc.) but will strive to serve the guest food on time no matter what. If customer entrance and loading dock are same then Punjabi Rasoi has to load in front of guest unless otherwise notified.\n\nPunjabi Rasoi Team Members:\n- Will provide service only behind the food counters\n- Will not be responsible for any cleaning/removal of trash in the facility where the event is held unless agreed and paid for the services\n- Will only clean tables when full service is ordered through Punjabi Rasoi LLC\n\nPunjabi Rasoi keeps the right to pre-cook the food and do the final cooking at the event if weather or location does not permit LIVE cooking. Client is required to provide a designated space free from any flammable items which is needed for LIVE cooking. Punjabi Rasoi LLC will provide drop cloths to place under the grill for LIVE cooking and is not liable for any damage caused to grass or concrete surface.\n\nPunjabi Rasoi always strives to make the client’s event a wonderful memory with great food, presentation, and service. Punjabi Rasoi Will Not Setup and serve food provided by other vender or household, if other than Punjabi Rasoi LLC food is served, Punjabi Rasoi Will Not be Liable for any Food born illness caused to the Guest, as it becomes hard to distinguish Which food caused the illness. Clients Have to take Full Responsibility for any damage caused by illness, when outside food is served with Punjabi Rasoi LLC Food.\n\nPunjabi Rasoi will provide food for the number of guests stated by the client 4 Weeks before the event date. Should the number of guests be less than the stated number, Punjabi Rasoi will not refund any amount to the client. However, Punjabi Rasoi is not responsible for shortage of food above the stated number of guests. Client is responsible to add all venders to the guest list, Punjabi Rasoi LLC can refuse to serve vender otherwise.\n\nPunjabi Rasoi will provide required insurance proof to event center and client naming of policy including liability Insurance.\n\nAny Delay or Extended Time for any event will be charged 10% of the total amount of that event in 30 minutes increments, if not Notified of any delay, 2 hours prior to the event start. If anytime Appetizers time need to be extended, we require 30 minutes notice prior to end time of appetizer, and the dinner will be pushed back the same extended time.\n\nFood Setup and serving: Punjabi Rasoi Will Need Minimum of 1 hour to setup for single Buffett after appetizer and 1.5 hour for 2 buffets. As per Food Safety Regulations the Stations cannot serve hot food for more than 3 hours, keeping that in mind the Max serving time for any continuous Station Cannot Exceed more than 3 hours. Dinner Buffet is served for max of 2 hours and Appetizer for Max 1.5 hour.\n\nPayment & Terms of Payment: Punjabi Rasoi Requires 30% payment at time of confirming the booking and 70% Three Weeks Before the event.`,
    notesText: `Price includes Refrigerator Truck, Labor, Truck, travel, Kitchen on wheels\nPlease make the check only via Fed-ex or UPS to Punjabi Rasoi LLC (Mail To: 1680 Terrace Lake Dr, Lawrenceville, GA 30043)\nPLEASE NOTE: If the menu for any Event changes, the per person price will change and the payment will change accordingly.\nAnything over number of guests given will be charged per person price based on total price`
  };
}

function openContractEditor() {
  const tpl = getContractTemplate() || defaultContractTemplate();
  el('contractTermsInput').value = tpl.termsText || '';
  el('contractNotesInput').value = tpl.notesText || '';
  const editor = el('contractEditor');
  editor.setAttribute('aria-hidden', 'false');
}

function closeContractEditor() {
  const editor = el('contractEditor');
  editor.setAttribute('aria-hidden', 'true');
}

function saveContractTemplate() {
  const termsText = el('contractTermsInput').value || '';
  const notesText = el('contractNotesInput').value || '';
  setContractTemplate({ termsText, notesText });
  closeContractEditor();
  buildContractView();
  alert('Contract wording saved.');
}

function renderTermsFromText(text, ol) {
  if (!ol) return;
  ol.innerHTML = '';
  const lines = (text || '').split(/\r?\n/);
  let currentLi = null;
  let currentUl = null;
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) { currentLi = null; currentUl = null; return; }
    if (line.startsWith('- ')) {
      if (!currentLi) {
        currentLi = document.createElement('li');
        ol.appendChild(currentLi);
      }
      if (!currentUl) {
        currentUl = document.createElement('ul');
        currentLi.appendChild(currentUl);
      }
      const sub = document.createElement('li');
      sub.textContent = line.slice(2);
      currentUl.appendChild(sub);
    } else {
      currentLi = document.createElement('li');
      currentLi.textContent = line;
      ol.appendChild(currentLi);
      currentUl = null;
    }
  });
}

function renderNotesFromText(text, container) {
  if (!container) return;
  container.innerHTML = '';
  const lines = (text || '').split(/\r?\n/).filter((l) => l.trim().length);
  lines.forEach((l) => {
    const div = document.createElement('div');
    div.textContent = l.trim();
    container.appendChild(div);
  });
}

function renderCustomChargesList() {
  const container = el("customChargesContainer");
  if (!container) return;
  container.innerHTML = "";
  const ev = getActiveEvent();
  if (!ev) return;
  const list = ensureEventCustomCharges(ev);
  list.forEach((ch, idx) => {
    const row = document.createElement("div");
    row.className = "custom-charge-row";
    const note = document.createElement("textarea");
    note.rows = 3;
    note.placeholder = "Charge description";
    note.value = ch.note || "";
    note.addEventListener("input", (e) => {
      ch.note = (e.target.value || "").trim();
    });
    const amt = document.createElement("input");
    amt.type = "number";
    amt.min = "0";
    amt.step = "0.01";
    amt.value = (Number(ch.amount || 0) !== 0) ? String(ch.amount) : "";
    amt.addEventListener("input", (e) => {
      ch.amount = Number(e.target.value || 0);
      calculateTotals();
    });
    const taxableWrap = document.createElement("label");
    taxableWrap.className = "taxable";
    const taxable = document.createElement("input");
    taxable.type = "checkbox";
    taxable.checked = (ch.taxable !== false);
    taxable.addEventListener("change", (e) => {
      ch.taxable = !!e.target.checked;
      calculateTotals();
    });
    const taxText = document.createElement("span");
    taxText.textContent = "Taxable";
    taxableWrap.appendChild(taxable);
    taxableWrap.appendChild(taxText);
    const removeBtn = document.createElement("button");
    removeBtn.className = "secondary";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      list.splice(idx, 1);
      renderCustomChargesList();
      calculateTotals();
    });
    row.appendChild(note);
    row.appendChild(amt);
    row.appendChild(taxableWrap);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

function saveCurrentContract() {
  const t = computeTotals();
  const tpl = getContractTemplate() || defaultContractTemplate();
  const contract = {
    id: `${Date.now()}`,
    client: { ...state.client },
    stations: state.stations.map((s) => ({ name: s.name, hideFromPrint: !!s.hideFromPrint, items: s.items.map((it) => ({ ...it })) })),
    totals: { subtotal: t.subtotal, taxAmount: t.taxAmount, grandTotal: t.grandTotal, taxRate: state.taxRate },
    wording: { termsText: tpl.termsText, notesText: tpl.notesText },
  };
  const key = 'saved_contracts_v1';
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.unshift(contract);
    localStorage.setItem(key, JSON.stringify(list));
    alert('Contract saved.');
  } catch {
    localStorage.setItem(key, JSON.stringify([contract]));
    alert('Contract saved.');
  }
}

function renderAll() {
  // Client info
  el("clientName").value = state.client.name;
  el("plannerName").value = state.client.planner;
  if (el("clientPhone")) el("clientPhone").value = state.client.phone || "";
  if (el("clientComment")) el("clientComment").value = state.client.comment || "";
  const activeEvForInputs = getActiveEvent();
  // Force input back to date type to avoid any browser quirks
  if (el("eventDate")) el("eventDate").setAttribute("type", "date");
  const draftDate = (state.ui && typeof state.ui.eventDateDraft === 'string') ? state.ui.eventDateDraft : '';
  el("eventDate").value = draftDate || ((activeEvForInputs && activeEvForInputs.date) || state.client.date);
  const matchByDate = (state.client.events || []).find((ev) => ev.date === draftDate);
  const evForInputs = matchByDate || activeEvForInputs;
  const evGuestsForInput = (evForInputs && typeof evForInputs.guests === 'number' && evForInputs.guests > 0) ? String(evForInputs.guests) : "";
  if (matchByDate) {
    el("guestCount").value = evGuestsForInput;
    el("eventType").value = (evForInputs && typeof evForInputs.type === 'string') ? evForInputs.type : "";
    const timingVal = (evForInputs && typeof evForInputs.timing === 'string') ? evForInputs.timing : "";
    if (el("eventTiming")) el("eventTiming").value = timingVal;
    el("eventAddress").value = (evForInputs && typeof evForInputs.address === 'string') ? evForInputs.address : '';
    if (el("eventNote")) el("eventNote").value = (evForInputs && typeof evForInputs.note === 'string') ? evForInputs.note : '';
    if (el("customChargeNote")) el("customChargeNote").value = (evForInputs && typeof evForInputs.customNote === 'string') ? evForInputs.customNote : '';
    const feesForEv = ensureEventFees(evForInputs) || state.fees;
    if (el("customChargeAmount")) el("customChargeAmount").value = (Number((feesForEv && feesForEv.custom) || 0) !== 0) ? String(feesForEv.custom) : "";
    const disc = ensureEventDiscount(evForInputs || {});
    if (el("discountDescription")) el("discountDescription").value = disc.description || "";
    if (el("discountAmount")) el("discountAmount").value = (Number(disc.amount || 0) !== 0) ? String(disc.amount) : "";
  } else if (draftDate) {
    el("guestCount").value = (state.ui && typeof state.ui.draftGuests === 'number' && state.ui.draftGuests > 0) ? String(state.ui.draftGuests) : "";
    el("eventType").value = (state.ui && typeof state.ui.draftType === 'string') ? state.ui.draftType : "";
    const timingVal = (state.ui && typeof state.ui.draftTiming === 'string') ? state.ui.draftTiming : "";
    if (el("eventTiming")) el("eventTiming").value = timingVal;
    el("eventAddress").value = (state.ui && typeof state.ui.draftAddress === 'string') ? state.ui.draftAddress : '';
    if (el("eventNote")) el("eventNote").value = '';
    if (el("customChargeNote")) el("customChargeNote").value = '';
    if (el("customChargeAmount")) el("customChargeAmount").value = '';
    if (el("discountDescription")) el("discountDescription").value = '';
    if (el("discountAmount")) el("discountAmount").value = '';
  } else {
    // No draft typed: show active event values
    el("guestCount").value = evGuestsForInput;
    el("eventType").value = (activeEvForInputs && typeof activeEvForInputs.type === 'string') ? activeEvForInputs.type : "";
    const timingVal2 = (activeEvForInputs && typeof activeEvForInputs.timing === 'string') ? activeEvForInputs.timing : "";
    if (el("eventTiming")) el("eventTiming").value = timingVal2;
    el("eventAddress").value = (activeEvForInputs && typeof activeEvForInputs.address === 'string') ? activeEvForInputs.address : (state.client.address || '');
    if (el("eventNote")) el("eventNote").value = (activeEvForInputs && typeof activeEvForInputs.note === 'string') ? activeEvForInputs.note : '';
    if (el("customChargeNote")) el("customChargeNote").value = (activeEvForInputs && typeof activeEvForInputs.customNote === 'string') ? activeEvForInputs.customNote : '';
    const feesForEv2 = ensureEventFees(activeEvForInputs) || state.fees;
    if (el("customChargeAmount")) el("customChargeAmount").value = (Number((feesForEv2 && feesForEv2.custom) || 0) !== 0) ? String(feesForEv2.custom) : "";
    const disc2 = ensureEventDiscount(activeEvForInputs || {});
    if (el("discountDescription")) el("discountDescription").value = disc2.description || "";
    if (el("discountAmount")) el("discountAmount").value = (Number(disc2.amount || 0) !== 0) ? String(disc2.amount) : "";
  }
  renderEventsUI();
  renderActiveEventMeta();

  // Fees and tax
  // Removed per-person input; totals auto-calc from items × guests
  const fees = getFeesForActiveEvent();
  // Display aggregated labor cost across stations in totals input
  const totalsNow = computeTotals();
  // For manual labor cost (rate) input, always show fee value
  if (el("laborCost")) {
    el("laborCost").value = Number((fees && fees.labor) || 0);
  }
  const calcLaborEl = el("calculatedLaborValue");
  if (calcLaborEl) calcLaborEl.textContent = `Calculated Labor: ${currency(totalsNow.laborCalculated || 0)}`;
  const calcLaborCountEl = el("calculatedLaborCount");
  if (calcLaborCountEl) calcLaborCountEl.textContent = `Calculated Count: ${Number(totalsNow.laborCountTotal || 0)}`;
  // Show blanks for zero-valued fees (chafing, travel, kitchen)
  el("chafingCharges").value = (Number((fees && fees.chafing) || 0) !== 0) ? String(fees.chafing) : "";
  el("travelCharges").value = (Number((fees && fees.travel) || 0) !== 0) ? String(fees.travel) : "";
  el("kitchenOnWheels").value = (Number((fees && fees.kitchen) || 0) !== 0) ? String(fees.kitchen) : "";
  if (el("customChargeAmount")) el("customChargeAmount").value = (Number((fees && fees.custom) || 0) !== 0) ? String(fees.custom) : "";
  el("taxRate").value = ((state.taxRate || 0) * 100).toFixed(2);
  if (el("paymentMade")) {
    const pm = Number(state.paymentMade || 0);
    el("paymentMade").value = (pm !== 0) ? String(pm) : "";
  }

  renderStations();
  renderSavedEstimatesList();
  calculateTotals();
  applyBrandLogo();
  renderTotalsNote();
  renderCustomChargesList();
}

function renderActiveEventMeta() {
  const meta = el("activeEventMeta");
  if (!meta) return;
  const ev = getActiveEvent();
  if (ev) {
    const date = formatDateUS(ev.date || "");
    const guests = (typeof ev.guests === "number") ? ev.guests : (state.client.guests || 0);
    const type = (typeof ev.type === "string") ? ev.type : "";
    meta.textContent = `Selected: ${date} • Guests: ${guests} • Type: ${type || "—"}`;
  } else {
    meta.textContent = "No event selected";
  }
}

// Brand logo storage and rendering
const BRAND_LOGO_KEY = 'brand_logo_v1';

function getBrandLogo() {
  try {
    return localStorage.getItem(BRAND_LOGO_KEY) || '';
  } catch { return ''; }
}

function setBrandLogo(dataUrl) {
  localStorage.setItem(BRAND_LOGO_KEY, dataUrl || '');
}

function handleBrandLogoInput(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (typeof dataUrl === 'string') {
      setBrandLogo(dataUrl);
      applyBrandLogo();
      alert('Logo set successfully. It will appear on Estimate and Contract.');
    }
    e.target.value = '';
  };
  reader.readAsDataURL(file);
}

function applyBrandLogo() {
  const dataUrl = getBrandLogo();
  const brands = document.querySelectorAll('.print-header .brand');
  brands.forEach((brand) => {
    const img = brand.querySelector('.brand-logo');
    const text = brand.querySelector('.brand-text');
    if (!img) return;
    // Hint to browser to use anonymous CORS when a remote URL is used
    img.crossOrigin = 'anonymous';
    if (dataUrl) {
      img.src = dataUrl;
      brand.classList.add('has-logo');
    } else {
      img.removeAttribute('src');
      brand.classList.remove('has-logo');
      if (text) text.style.display = '';
    }
  });
}

// Company header storage and rendering
const COMPANY_HEADER_KEY = 'company_header_v1';
function defaultCompanyHeader() {
  return {
    lines: ['Punjabi Rasoi LLC','4450 Nelson Brogdon Blvd','Suite A-10-C','Buford, GA 30518','404-771-9803']
  };
}
function getCompanyHeader() {
  try {
    const raw = localStorage.getItem(COMPANY_HEADER_KEY);
    if (!raw) return defaultCompanyHeader();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.lines)) return defaultCompanyHeader();
    return { lines: parsed.lines.map((l) => String(l || '').trim()).filter((l) => l.length) };
  } catch { return defaultCompanyHeader(); }
}
function setCompanyHeader(h) {
  try {
    const clean = { lines: (h && Array.isArray(h.lines)) ? h.lines.map((l) => String(l || '').trim()).filter((l) => l.length) : [] };
    localStorage.setItem(COMPANY_HEADER_KEY, JSON.stringify(clean));
  } catch {}
}
function applyCompanyHeader() {
  const h = getCompanyHeader();
  const html = (h.lines || []).map((l) => `<div>${l}</div>`).join('');
  document.querySelectorAll('.print-header .company').forEach((el) => { el.innerHTML = html; });
}
function openHeaderEditor() {
  const h = getCompanyHeader();
  el('headerAddressInput').value = (h.lines || []).join('\n');
  el('headerEditor').setAttribute('aria-hidden', 'false');
}
function closeHeaderEditor() {
  el('headerEditor').setAttribute('aria-hidden', 'true');
}
function saveCompanyHeader() {
  const raw = el('headerAddressInput').value || '';
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length);
  setCompanyHeader({ lines });
  closeHeaderEditor();
  applyCompanyHeader();
  alert('Header address saved.');
}

// Print-to-PDF helpers using file picker and generated PDF
async function savePdfFromElementToFolder(element, suggestedName) {
  try {
    const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDF || typeof html2canvas !== 'function') {
      alert('PDF export libraries not loaded. Please try again.');
      return;
    }
    const pdf = new jsPDF('p', 'pt', 'letter');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const defaultName = suggestedName.endsWith('.pdf') ? suggestedName : `${suggestedName}.pdf`;
    // Open the save picker first so the window appears immediately (Chrome/Edge)
    let earlyWritable = null;
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]
        });
        earlyWritable = await handle.createWritable();
      } catch (e) {
        if (e && e.name === 'AbortError') return; // user canceled
      }
    }
    showPdfProgress('Generating PDF…');
    // Temporarily bump fonts for export
    // Estimate: +4pt overall with header tweaks (already in CSS)
    // Contract: +9pt overall (new rule)
    let appliedPlus = false;
    if (element && (element.id === 'printView' || element.id === 'contractView')) {
      try {
        element.classList.add('pdf-plus');
        element.classList.add('pdf-tight');
        appliedPlus = true;
      } catch {}
    }
    const isContract = !!(element && element.id === 'contractView');

    // Detect generated pages to avoid oversized canvas snapshots
    const pages = element.querySelectorAll('.contract-page, .estimate-page');
    const targets = pages.length ? Array.from(pages) : [element];
    // Ensure the root element is visible during capture (print-only CSS won't apply)
    const originalElementDisplay = element.style.display;
    const originalElementVisibility = element.style.visibility;
    const originalAriaHidden = element.getAttribute('aria-hidden');
    element.style.display = 'block';
    element.style.visibility = 'visible';
    if (originalAriaHidden !== null) { try { element.removeAttribute('aria-hidden'); } catch {} }
    // Ensure print-view is visible for accurate capture
    // Prepare brand logo (data URL) for stamping into PDF to ensure visibility
    const brandLogoData = (typeof getBrandLogo === 'function') ? getBrandLogo() : '';
    let logoImg = null;
    let logoNaturalW = 0;
    let logoNaturalH = 0;
    let logoFormat = 'PNG';
    if (brandLogoData) {
      logoFormat = brandLogoData.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = brandLogoData;
      try {
        await new Promise((resolve, reject) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => resolve(); // continue even if it fails
        });
        logoNaturalW = Number(logoImg.naturalWidth || 0);
        logoNaturalH = Number(logoImg.naturalHeight || 0);
      } catch {}
    }
    // Temporarily hide potentially cross-origin images to avoid tainted canvas errors
    const imgs = element.querySelectorAll('img');
    const hiddenImgs = [];
    imgs.forEach((img) => {
      try {
        const src = img.getAttribute('src') || '';
        // Hide non-data URLs that might be cross-origin
        // Never hide the brand logo; we want it in the PDF
        if (img.classList && img.classList.contains('brand-logo')) return;
        if (src && !src.startsWith('data:') && !src.startsWith(window.location.origin)) {
          hiddenImgs.push(img);
          img.style.visibility = 'hidden';
        }
      } catch {}
    });
    // Track exported pages for accurate page numbering
    let exportedPageCounter = 0;
    for (let i = 0; i < targets.length; i++) {
      const node = targets[i];
      showPdfProgress(`Generating PDF… Page ${i + 1} of ${targets.length}`);
      await new Promise((r) => setTimeout(r, 0));
      // Increase capture scale for crisper text; helps avoid perceived letter gaps
      let canvas = await html2canvas(node, { scale: 1, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', imageTimeout: 3000, removeContainer: true, logging: false });
      // If zero-size canvas due to hidden node, force display for a second capture
      if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        const prevNodeDisplay = node.style.display;
        const prevNodeVisibility = node.style.visibility;
        node.style.display = 'block';
        node.style.visibility = 'visible';
        canvas = await html2canvas(node, { scale: 1, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', imageTimeout: 3000, removeContainer: true, logging: false });
        node.style.display = prevNodeDisplay;
        node.style.visibility = prevNodeVisibility;
      }
      // Crop content only for Estimate pages; keep full canvas for Contract to avoid blank pages
      if (!isContract) {
        try {
          // Track vertical crop offset (in canvas pixels) so block positions align with the cropped canvas
          var cropOffsetYpx = 0;
          const nodeRect = node.getBoundingClientRect();
          const parts = ['.print-header', '.print-title', '.print-client', '.print-table', '.print-totals'];
          const rects = parts.map((sel) => node.querySelector(sel)).filter(Boolean).map((el) => el.getBoundingClientRect());
          if (rects.length) {
            const top = Math.min(...rects.map((r) => r.top));
            const bottom = Math.max(...rects.map((r) => r.bottom));
            const left = Math.min(...rects.map((r) => r.left));
            const right = Math.max(...rects.map((r) => r.right));
            const relLeft = Math.max(0, left - nodeRect.left);
            const relTop = Math.max(0, top - nodeRect.top);
            const relW = Math.max(1, right - left);
            const relH = Math.max(1, bottom - top);
            const sx = canvas.width / Math.max(1, nodeRect.width);
            const sy = canvas.height / Math.max(1, nodeRect.height);
            const cropX = Math.floor(relLeft * sx);
            const cropY = Math.floor(relTop * sy);
            const cropW = Math.floor(relW * sx);
            const cropH = Math.floor(relH * sy);
            if (cropW > 0 && cropH > 0) {
              const cropped = document.createElement('canvas');
              cropped.width = cropW;
              cropped.height = cropH;
              const ctx2 = cropped.getContext('2d');
              ctx2.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              canvas = cropped;
              cropOffsetYpx = cropY; // store offset to align subsequent block detection
            }
          }
        } catch (e) {
          console.warn('PDF content crop skipped', e);
        }
      }
      let imgData;
      try {
        imgData = canvas.toDataURL('image/jpeg', 0.72);
      } catch (e) {
        imgData = canvas.toDataURL('image/png');
      }
      const imgFormat = imgData.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      // Map CSS px to PDF pt so CSS font sizes (e.g., 15pt) render true-to-size
      const safeW = Math.max(1, canvas.width);
      const safeH = Math.max(1, canvas.height);
      const baseMarginPt = (10 * 72) / 25.4; // 10mm in points
      const firstContractMarginPt = (3 * 72) / 25.4; // 3mm for wider contract pages
      const marginPt = isContract ? firstContractMarginPt : baseMarginPt;
      const scaleFactor = 1;
      const pxToPt = 72 / 96; // CSS 96dpi to PDF 72pt/in
      // Desired output size based on CSS pixel dimensions, preserving perceived font size
      let outW = Math.max(1, Math.floor((safeW / scaleFactor) * pxToPt));
      let outH = Math.max(1, Math.floor((safeH / scaleFactor) * pxToPt));
      // Fit width if necessary, but do NOT shrink height; instead slice into multiple pages
      const maxW = Math.max(1, Math.floor(pageWidth - marginPt * 2));
      const maxH = Math.max(1, Math.floor(pageHeight - marginPt * 2));
      let ratioW = 1;
      if (outW > maxW) {
        ratioW = maxW / outW;
        outW = Math.max(1, Math.floor(outW * ratioW));
        outH = Math.max(1, Math.floor(outH * ratioW));
      }
      // For Contract first page, scale proportionally to fill available width while respecting height
      if (isContract && i === 0) {
        const fitScale = Math.min(maxW / outW, maxH / outH);
        if (fitScale && fitScale !== 1) {
          outW = Math.max(1, Math.floor(outW * fitScale));
          outH = Math.max(1, Math.floor(outH * fitScale));
        }
      }
      const offsetX = Math.max(marginPt, Math.floor((pageWidth - outW) / 2));
      const offsetY = marginPt; // anchor near top like printed page
      if (outH <= maxH) {
        // Single page image
        if (exportedPageCounter === 0 && i === 0) {
          pdf.addImage(imgData, imgFormat, offsetX, offsetY, outW, outH, undefined, 'FAST');
        } else {
          pdf.addPage();
          pdf.addImage(imgData, imgFormat, offsetX, offsetY, outW, outH, undefined, 'FAST');
        }
        exportedPageCounter++;
        if (isContract && i !== 0) {
          try {
            pdf.setTextColor(55, 55, 55);
            pdf.setFontSize(12);
            const footY = pageHeight - (marginPt + 14);
            pdf.text('Client ____', marginPt, footY);
            pdf.text('PR ____', pageWidth - marginPt, footY, { align: 'right' });
          } catch {}
        }
        try {
          pdf.setTextColor(85, 85, 85);
          pdf.setFontSize(11);
          const pageLabel = String(exportedPageCounter);
          pdf.text(pageLabel, pageWidth - marginPt, pageHeight - (marginPt / 2), { align: 'right' });
        } catch (e) {
          console.warn('Failed to stamp page number into PDF', e);
        }
      } else {
        // Slice tall content across multiple pages without shrinking fonts
        const slicePx = Math.max(1, Math.floor(maxH * scaleFactor / pxToPt / ratioW));
        let yPx = 0;
        // Compute totals block position to avoid splitting it
        let totalsTopPx = null;
        let totalsHpx = null;
        // Compute station block positions (all tbody.keep-together) to avoid splitting any station
        let stationBlocks = [];
        try {
          const nodeRect = node.getBoundingClientRect();
          const totalsEl = node.querySelector('.print-totals');
          if (totalsEl) {
            const tRect = totalsEl.getBoundingClientRect();
            totalsTopPx = Math.max(0, Math.floor((tRect.top - nodeRect.top) * scaleFactor));
            totalsHpx = Math.max(1, Math.floor(tRect.height * scaleFactor));
          }
          const stationEls = node.querySelectorAll('.print-table tbody.keep-together');
          stationBlocks = Array.from(stationEls).map((el) => {
            const sRect = el.getBoundingClientRect();
            return {
              topPx: Math.max(0, Math.floor((sRect.top - nodeRect.top) * scaleFactor)),
              heightPx: Math.max(1, Math.floor(sRect.height * scaleFactor))
            };
          }).sort((a, b) => a.topPx - b.topPx);
        } catch {}
        // Adjust for earlier crop offset so positions match the cropped canvas coordinates
        if (typeof cropOffsetYpx === 'number' && cropOffsetYpx > 0) {
          if (totalsTopPx !== null) totalsTopPx = Math.max(0, totalsTopPx - cropOffsetYpx);
          if (stationBlocks && stationBlocks.length) {
            stationBlocks = stationBlocks.map((b) => ({ topPx: Math.max(0, b.topPx - cropOffsetYpx), heightPx: b.heightPx }));
          }
        }
        while (yPx < safeH) {
          let sliceHpx = Math.min(slicePx, safeH - yPx);
          // If this slice would cut through any station block, end the slice before that station
          if (stationBlocks && stationBlocks.length) {
            // Find the first station whose top lies inside the current slice range
            const crossing = stationBlocks.find((b) => (yPx < b.topPx) && ((yPx + sliceHpx) > b.topPx));
            if (crossing) {
              const remainingPxInSlice = Math.max(0, slicePx - (crossing.topPx - yPx));
              const stationFitsHere = crossing.heightPx <= remainingPxInSlice;
              if (!stationFitsHere) {
                sliceHpx = Math.max(1, crossing.topPx - yPx);
              }
            } else {
              // If starting exactly at a station, try to keep it together when it fits
              const starting = stationBlocks.find((b) => yPx === b.topPx);
              if (starting) {
                sliceHpx = Math.min(slicePx, starting.heightPx);
              }
            }
          }
          // If this slice would cut through the totals block, end the slice before totals
          if (totalsTopPx !== null && totalsHpx !== null) {
            const wouldCrossTotals = (yPx < totalsTopPx) && ((yPx + sliceHpx) > totalsTopPx);
            if (wouldCrossTotals) {
              // Only move totals to next page if it cannot fully fit in the remaining space
              const remainingPxInSlice = Math.max(0, slicePx - (totalsTopPx - yPx));
              const totalsFitsHere = totalsHpx <= remainingPxInSlice;
              if (!totalsFitsHere) {
                sliceHpx = Math.max(1, totalsTopPx - yPx);
              }
            } else if (yPx === totalsTopPx) {
              // Ensure totals fits entirely in one page if possible
              sliceHpx = Math.min(Math.max(slicePx, totalsHpx), safeH - yPx);
            }
          }
          const cropped = document.createElement('canvas');
          cropped.width = safeW;
          cropped.height = sliceHpx;
          const ctx2 = cropped.getContext('2d');
          ctx2.drawImage(canvas, 0, yPx, safeW, sliceHpx, 0, 0, safeW, sliceHpx);
          let sliceData;
          try {
            sliceData = cropped.toDataURL('image/jpeg', 0.72);
          } catch (e) {
            sliceData = cropped.toDataURL('image/png');
          }
          const slicePtH = Math.max(1, Math.floor((sliceHpx / scaleFactor) * pxToPt * ratioW));
          if (exportedPageCounter === 0 && i === 0) {
            pdf.addImage(sliceData, imgFormat, offsetX, offsetY, outW, slicePtH, undefined, 'FAST');
          } else {
            pdf.addPage();
            pdf.addImage(sliceData, imgFormat, offsetX, offsetY, outW, slicePtH, undefined, 'FAST');
          }
          exportedPageCounter++;
          if (isContract && i !== 0) {
            try {
              pdf.setTextColor(55, 55, 55);
              pdf.setFontSize(12);
              const footY2 = pageHeight - (marginPt + 14);
              pdf.text('Client ____', marginPt, footY2);
              pdf.text('PR ____', pageWidth - marginPt, footY2, { align: 'right' });
            } catch {}
          }
          try {
            pdf.setTextColor(85, 85, 85);
            pdf.setFontSize(11);
            const pageLabel = String(exportedPageCounter);
            pdf.text(pageLabel, pageWidth - marginPt, pageHeight - (marginPt / 2), { align: 'right' });
          } catch (e) {
            console.warn('Failed to stamp page number into PDF', e);
          }
          yPx += sliceHpx;
          // If we just ended right before totals, start next slice at totals top
          if (totalsTopPx !== null && yPx === totalsTopPx) {
            // No-op: next iteration will capture totals with adjusted height
          }
        }
      }
      // Stamp brand logo only if the DOM logo is not present/visible in this page
      const hasDomLogo = !!node.querySelector('.brand.has-logo .brand-logo[src]');
      if (brandLogoData && !hasDomLogo) {
        const targetW = 180; // points
        const targetH = logoNaturalW > 0 && logoNaturalH > 0
          ? Math.max(1, Math.floor(targetW * (logoNaturalH / logoNaturalW)))
          : 60;
        const logoX = marginPt;
        const logoY = marginPt;
        try {
          pdf.addImage(brandLogoData, logoFormat, logoX, logoY, targetW, targetH);
        } catch (e) {
          // If adding logo fails, continue without blocking the export
          console.warn('Failed to stamp brand logo into PDF', e);
        }
      }
      // Page number stamping handled per slice above
    }
    // Restore hidden images
    hiddenImgs.forEach((img) => { img.style.visibility = ''; });
    // Restore root element visibility
    element.style.display = originalElementDisplay;
    element.style.visibility = originalElementVisibility;
    if (originalAriaHidden !== null) { try { element.setAttribute('aria-hidden', originalAriaHidden); } catch {} }
    // Remove temporary font bump
    if (appliedPlus) {
      try { element.classList.remove('pdf-plus'); } catch {}
      try { element.classList.remove('pdf-tight'); } catch {}
    }

    const blob = pdf.output('blob');
    if (earlyWritable) {
      showPdfProgress('Saving to chosen location…');
      await earlyWritable.write(blob);
      await earlyWritable.close();
      try {
        const previewUrl = URL.createObjectURL(blob);
        window.open(previewUrl, '_blank');
        setTimeout(() => { try { URL.revokeObjectURL(previewUrl); } catch {} }, 15000);
      } catch {}
      hidePdfProgress();
      return;
    }
    const savedToFolder = await saveBlobToDataFolder(defaultName, blob, 'application/pdf');
    if (savedToFolder) {
      try {
        const previewUrl = URL.createObjectURL(blob);
        window.open(previewUrl, '_blank');
        setTimeout(() => { try { URL.revokeObjectURL(previewUrl); } catch {} }, 15000);
      } catch {}
      hidePdfProgress();
      alert(`Saved to Data Folder: ${defaultName}`);
      return;
    }
    // Fallback to standard download if picker not supported
    const url = URL.createObjectURL(blob);
    try { window.open(url, '_blank'); } catch {}
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 15000);
    hidePdfProgress();
  } catch (e) {
    console.error('Failed to save PDF', e);
    alert('Failed to save PDF. See console for details.');
    // Ensure any temporary style changes are cleared
    try { element.classList.remove('pdf-plus'); } catch {}
    try { element.classList.remove('pdf-tight'); } catch {}
    hidePdfProgress();
  }
}

function showPdfProgress(text) {
  let el = document.getElementById('pdfProgress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pdfProgress';
    el.className = 'pdf-progress';
    const inner = document.createElement('div');
    inner.className = 'pdf-progress-inner';
    const span = document.createElement('span');
    span.id = 'pdfProgressText';
    inner.appendChild(span);
    el.appendChild(inner);
    document.body.appendChild(el);
  }
  const t = document.getElementById('pdfProgressText');
  if (t) t.textContent = text || 'Generating PDF…';
  el.style.display = 'flex';
}
function hidePdfProgress() {
  const el = document.getElementById('pdfProgress');
  if (el) el.style.display = 'none';
}

async function saveEstimatePdf() {
  // Ensure data and view are ready
  const hideOpt = el('hidePrintTotal');
  if (hideOpt && hideOpt.checked) {
    document.body.classList.add('hide-print-total');
  } else {
    document.body.classList.remove('hide-print-total');
  }
  buildPrintView();
  const prevTitle = document.title;
  document.title = makeEstimateTitle();
  document.body.classList.add('printing-estimate');
  document.body.classList.remove('printing-contract');
  try {
    const nameBase = (state.client.name || 'Client').trim().replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_');
    const evDates = (state.client.events || [])
      .map((ev) => String(ev && ev.date || '').trim())
      .filter((d) => d && d.length)
      .sort((a, b) => new Date(a || 0) - new Date(b || 0))
      .map((s) => {
        const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        const mUs = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
        if (mIso) return `${mIso[2]}-${mIso[3]}-${mIso[1]}`;
        if (mUs) return `${mUs[1]}-${mUs[2]}-${mUs[3]}`;
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const yyyy = String(d.getFullYear());
          return `${mm}-${dd}-${yyyy}`;
        }
        return '';
      })
      .filter(Boolean);
    const fallback = (() => {
      const s = String(state.client.date || '').trim();
      if (!s) return '';
      const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      const mUs = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
      if (mIso) return `${mIso[2]}-${mIso[3]}-${mIso[1]}`;
      if (mUs) return `${mUs[1]}-${mUs[2]}-${mUs[3]}`;
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const yyyy = String(d.getFullYear());
        return `${mm}-${dd}-${yyyy}`;
      }
      return '';
    })();
    if (!evDates.length && fallback) evDates.push(fallback);
    const suffix = evDates.length ? `_${evDates.join('_')}` : '';
    const elView = document.getElementById('printView');
    await savePdfFromElementToFolder(elView, `${nameBase}${suffix}_Estimate`);
  } finally {
    document.title = prevTitle;
    document.body.classList.remove('printing-estimate');
    document.body.classList.remove('hide-print-total');
  }
}

async function saveContractPdf() {
  // Ensure data and view are ready
  buildContractView();
  const prevTitle = document.title;
  document.title = makeContractTitle();
  document.body.classList.add('printing-contract');
  document.body.classList.remove('printing-estimate');
  try {
    const nameBase = (state.client.name || 'Client').trim().replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_');
    const evDates = (state.client.events || [])
      .map((ev) => String(ev && ev.date || '').trim())
      .filter((d) => d && d.length)
      .sort((a, b) => new Date(a || 0) - new Date(b || 0))
      .map((s) => {
        const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        const mUs = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
        if (mIso) return `${mIso[2]}-${mIso[3]}-${mIso[1]}`;
        if (mUs) return `${mUs[1]}-${mUs[2]}-${mUs[3]}`;
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const yyyy = String(d.getFullYear());
          return `${mm}-${dd}-${yyyy}`;
        }
        return '';
      })
      .filter(Boolean);
    const fallback = (() => {
      const s = String(state.client.date || '').trim();
      if (!s) return '';
      const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      const mUs = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
      if (mIso) return `${mIso[2]}-${mIso[3]}-${mIso[1]}`;
      if (mUs) return `${mUs[1]}-${mUs[2]}-${mUs[3]}`;
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const yyyy = String(d.getFullYear());
        return `${mm}-${dd}-${yyyy}`;
      }
      return '';
    })();
    if (!evDates.length && fallback) evDates.push(fallback);
    const suffix = evDates.length ? `_${evDates.join('_')}` : '';
    const elView = document.getElementById('contractView');
    await savePdfFromElementToFolder(elView, `${nameBase}${suffix}_Contract`);
  } finally {
    document.title = prevTitle;
    document.body.classList.remove('printing-contract');
  }
}

function makeEstimateTitle() {
  const name = (state.client.name || 'Client').trim();
  const evs = (state.client.events || []).map((ev) => String(ev && ev.date || '').trim()).filter((d) => d && d.length);
  const primary = evs.length ? [...evs].sort((a, b) => new Date(a || 0) - new Date(b || 0))[0] : (state.client.date || 'Date');
  const date = formatDateUS(String(primary || '').trim());
  return `Estimate - ${name} - ${date}`;
}

function makeContractTitle() {
  const name = (state.client.name || 'Client').trim();
  const evs = (state.client.events || []).map((ev) => String(ev && ev.date || '').trim()).filter((d) => d && d.length);
  const primary = evs.length ? [...evs].sort((a, b) => new Date(a || 0) - new Date(b || 0))[0] : (state.client.date || 'Date');
  const date = formatDateUS(String(primary || '').trim());
  return `Contract - ${name} - ${date}`;
}

// Build a safe base filename including client name, event date, and phone (if embedded)
function makeSafeFileBase() {
  const base = (state.client.name || 'Client').trim();
  const ev = state.activeEventId ? (state.client.events || []).find((ev) => ev.id === state.activeEventId) : null;
  const dateRaw = ((ev && ev.date) || state.client.date || '').trim();
  const datePart = dateRaw ? `_${dateRaw}` : '';
  const phoneMatch = base.match(/(\d{3}[- ]?\d{3}[- ]?\d{4})/);
  const phonePart = phoneMatch ? `_${phoneMatch[1].replace(/[^0-9-]/g, '')}` : '';
  const safeBase = base.replace(/[^a-z0-9-_]+/gi, '_');
  return `${safeBase}${datePart}${phonePart}`.replace(/_+/g, '_');
}

// Saving and loading
const STORAGE_KEY = "estimate_app_v1";
const AUTOSAVE_KEY = "estimate_autosave_v1";

function getAllEstimates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse storage", e);
    return [];
  }
}

function setAllEstimates(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  // Also persist to chosen Data Folder for portability across computers
  try {
    const json = JSON.stringify(list || [], null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    // Best-effort save; silently ignore if folder isn't set or permission denied
    saveBlobToDataFolder('estimates.json', blob, 'application/json');
  } catch {}
}

// Autosave helpers
function setAutosave(session) {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session || {})); } catch {}
  // Mirror autosave to Data Folder so copying the folder carries the latest state
  try {
    const json = JSON.stringify(session || {}, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    saveBlobToDataFolder('autosave.json', blob, 'application/json');
  } catch {}
}
function getAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch { return null; }
}
function restoreAutosave() {
  const s = getAutosave();
  if (!s) return;
  try {
    if (s.client && typeof s.client === 'object') state.client = { ...s.client };
    if (Array.isArray(s.stations)) state.stations = s.stations.map((x) => ({ ...x, items: (x.items || []).map((it) => ({ ...it })) }));
    if (typeof s.autoPricePerPerson === 'boolean') state.autoPricePerPerson = s.autoPricePerPerson;
    if (typeof s.pricePerPerson === 'number') state.pricePerPerson = s.pricePerPerson;
    if (s.fees && typeof s.fees === 'object') state.fees = { ...s.fees };
    if (typeof s.taxRate === 'number') state.taxRate = s.taxRate;
    if (typeof s.activeEventId === 'string') state.activeEventId = s.activeEventId;
    if (typeof s.paymentMade === 'number') state.paymentMade = s.paymentMade;
  } catch {}
}

function saveEstimate() {
  // Require client name and a date to save
  const nameOk = !!(state.client.name && state.client.name.trim());
  const activeEv = getActiveEvent();
  const dateRaw = ((activeEv && activeEv.date) || state.client.date || '').trim();
  const dateOk = !!dateRaw;
  if (!nameOk || !dateOk) {
    alert("Please set Client Name and Event Date before saving.");
    return;
  }
  const canonicalDate = (s) => {
    const str = String(s || '').trim();
    if (!str) return '';
    const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    const mUs = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
    let d;
    if (mIso) d = new Date(`${mIso[1]}-${mIso[2]}-${mIso[3]}T00:00:00`);
    else if (mUs) d = new Date(`${mUs[3]}-${mUs[1]}-${mUs[2]}T00:00:00`);
    else d = new Date(str);
    if (isNaN(d.getTime())) return '';
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const normalizeName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const datesForState = (() => {
    const evs = (state.client.events || []);
    const arr = evs.length ? evs.map((ev) => canonicalDate(ev.date)).filter(Boolean) : [canonicalDate(state.client.date)];
    return arr.filter(Boolean).sort();
  })();
  const matchesEstimate = (est) => {
    const nameMatch = normalizeName(est && est.client && est.client.name) === normalizeName(state.client.name);
    const evs = (est && est.client && est.client.events) || [];
    const arr = evs.length ? evs.map((ev) => canonicalDate(ev.date)).filter(Boolean) : [canonicalDate(est && est.client && est.client.date)];
    const dates = arr.filter(Boolean).sort();
    const sameDates = dates.length === datesForState.length && dates.every((d, i) => d === datesForState[i]);
    return !!nameMatch && !!sameDates;
  };
  const list = getAllEstimates();
  const selectedId = (el("savedEstimatesSelect") && el("savedEstimatesSelect").value) || "";
  const baseEstimate = {
    client: { ...state.client },
    stations: state.stations.map((s) => ({ name: s.name, eventId: s.eventId, laborCount: s.laborCount || 0, laborCost: s.laborCost || 0, hideFromPrint: !!s.hideFromPrint, items: s.items.map((it) => ({ ...it })) })),
    autoPricePerPerson: state.autoPricePerPerson,
    pricePerPerson: state.pricePerPerson,
    fees: { ...state.fees },
    taxRate: state.taxRate,
    activeEventId: state.activeEventId || "",
    paymentMade: Number(state.paymentMade || 0),
  };
  if (selectedId) {
    // Update the currently selected estimate to avoid duplicates
    const ok = window.confirm('Overwrite the selected saved estimate?');
    if (!ok) { return; }
    const idx = list.findIndex((e) => e.id === selectedId);
    const estimate = { id: selectedId, ...baseEstimate };
    if (idx !== -1) {
      // Preserve createdAt if present
      estimate.createdAt = list[idx].createdAt || estimate.createdAt || Date.now();
      list[idx] = estimate;
    } else {
      estimate.createdAt = Date.now();
      list.unshift(estimate);
    }
    setAllEstimates(list);
    // Set selection first so the list render preserves it
    const sel = el("savedEstimatesSelect");
    if (sel) sel.value = selectedId;
    renderSavedEstimatesList();
    alert("Estimate updated.");
  } else {
    // No selection: create a new estimate and select it
    const dupIdx = list.findIndex((e) => matchesEstimate(e));
    if (dupIdx !== -1) {
      const ok = window.confirm('A saved estimate with the same client and event dates exists. Overwrite it?');
      if (ok) {
        const id = list[dupIdx].id;
        const estimate = { id, ...baseEstimate };
        estimate.createdAt = list[dupIdx].createdAt || Date.now();
        list[dupIdx] = estimate;
        setAllEstimates(list);
        const sel = el("savedEstimatesSelect");
        if (sel) sel.value = id;
        renderSavedEstimatesList();
        alert("Estimate updated.");
        return;
      }
    }
    const id = `${Date.now()}`;
    const estimate = { id, ...baseEstimate };
    estimate.createdAt = Date.now();
    list.unshift(estimate);
    setAllEstimates(list);
    const sel = el("savedEstimatesSelect");
    if (sel) sel.value = id;
    // Render after setting selection so it's preserved
    renderSavedEstimatesList();
    alert("Estimate saved.");
  }
}

function updateSelectedEstimate() {
  const id = el("savedEstimatesSelect").value;
  if (!id) { alert("Please select a saved estimate to update."); return; }
  const ok = window.confirm('Overwrite the selected saved estimate?');
  if (!ok) return;
  const nameOk = !!(state.client.name && state.client.name.trim());
  const activeEv = getActiveEvent();
  const dateRaw = ((activeEv && activeEv.date) || state.client.date || '').trim();
  const dateOk = !!dateRaw;
  if (!nameOk || !dateOk) { alert("Please set Client Name and Event Date before updating."); return; }
  const list = getAllEstimates();
  const idx = list.findIndex((e) => e.id === id);
  if (idx === -1) { alert("Selected estimate no longer exists."); return; }
  const updated = {
    id,
    client: { ...state.client },
    stations: state.stations.map((s) => ({ name: s.name, eventId: s.eventId, laborCount: s.laborCount || 0, laborCost: s.laborCost || 0, hideFromPrint: !!s.hideFromPrint, items: s.items.map((it) => ({ ...it })) })),
    autoPricePerPerson: state.autoPricePerPerson,
    pricePerPerson: state.pricePerPerson,
    fees: { ...state.fees },
    taxRate: state.taxRate,
    activeEventId: state.activeEventId || "",
    paymentMade: Number(state.paymentMade || 0),
  };
  list[idx] = updated;
  updated.createdAt = list[idx].createdAt || updated.createdAt || Date.now();
  setAllEstimates(list);
  renderSavedEstimatesList();
  alert("Estimate updated.");
}

function deleteSelectedEstimate() {
  const id = el("savedEstimatesSelect").value;
  if (!id) { alert("Please select a saved estimate to delete."); return; }
  const list = getAllEstimates();
  const filtered = list.filter((e) => e.id !== id);
  setAllEstimates(filtered);
  renderSavedEstimatesList();
  // Clear selection
  const sel = el("savedEstimatesSelect");
  if (sel) sel.value = "";
  alert("Estimate deleted.");
}

async function exportEstimate() {
  // Build export without the event date field on client
  const exportClient = { ...state.client };
  delete exportClient.date;
  const estimate = {
    client: exportClient,
    stations: state.stations.map((s) => ({
      name: s.name,
      eventId: s.eventId,
      laborCount: Number(s.laborCount || 0),
      laborCost: Number(s.laborCost || 0),
      hideFromPrint: !!s.hideFromPrint,
      items: s.items.map((it) => ({ ...it })),
    })),
    autoPricePerPerson: state.autoPricePerPerson,
    pricePerPerson: state.pricePerPerson,
    fees: { ...state.fees },
    taxRate: state.taxRate,
    activeEventId: state.activeEventId || "",
    paymentMade: Number(state.paymentMade || 0),
  };
  const json = JSON.stringify(estimate, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const safeName = makeSafeFileBase();
  const fileName = `${safeName}.json`;
  const savedToFolder = await saveBlobToDataFolder(fileName, blob, 'application/json');
  if (savedToFolder) {
    alert(`Exported to data folder as ${fileName}`);
    return;
  }
  // Fallback: download in browser
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  alert(`Downloaded ${fileName}`);
}

async function exportAllEstimates() {
  const list = getAllEstimates();
  const json = JSON.stringify(list || [], null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const yyyy = String(today.getFullYear());
  const dateSuffix = `${mm}-${dd}-${yyyy}`;
  const fileName = `estimates_${dateSuffix}.json`;
  const savedToFolder = await saveBlobToDataFolder(fileName, blob, "application/json");
  if (savedToFolder) {
    alert(`Exported all estimates to data folder as ${fileName}`);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  alert(`Downloaded ${fileName}`);
}

async function pickFolderAndSave(fileName, blob, mime) {
  try {
    if (!window.showDirectoryPicker) return false;
    const dir = await window.showDirectoryPicker();
    const ok = await verifyPermission(dir, true);
    if (!ok) return false;
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

async function exportEstimateToFolder() {
  const exportClient = { ...state.client };
  delete exportClient.date;
  const estimate = {
    client: exportClient,
    stations: state.stations.map((s) => ({
      name: s.name,
      eventId: s.eventId,
      laborCount: Number(s.laborCount || 0),
      laborCost: Number(s.laborCost || 0),
      hideFromPrint: !!s.hideFromPrint,
      items: s.items.map((it) => ({ ...it })),
    })),
    autoPricePerPerson: state.autoPricePerPerson,
    pricePerPerson: state.pricePerPerson,
    fees: { ...state.fees },
    taxRate: state.taxRate,
    activeEventId: state.activeEventId || "",
  };
  const json = JSON.stringify(estimate, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const safeName = makeSafeFileBase();
  const fileName = `${safeName}.json`;
  const saved = await pickFolderAndSave(fileName, blob, "application/json");
  if (saved) { alert(`Exported to chosen folder: ${fileName}`); return; }
  alert('Your browser does not support choosing a folder. Use Set Data Folder or download Export.');
}

async function exportAllEstimatesToFolder() {
  const list = getAllEstimates();
  const json = JSON.stringify(list || [], null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const yyyy = String(today.getFullYear());
  const dateSuffix = `${mm}-${dd}-${yyyy}`;
  const saved = await pickFolderAndSave(`estimates_${dateSuffix}.json`, blob, "application/json");
  if (saved) { alert(`Exported all estimates to chosen folder as estimates_${dateSuffix}.json`); return; }
  alert('Your browser does not support choosing a folder. Use Set Data Folder or download Export All.');
}

async function exportAllEstimatesFilesToFolder() {
  try {
    if (!window.showDirectoryPicker) { alert('Your browser does not support choosing a folder. Use Export All Estimates instead.'); return; }
    const dir = await window.showDirectoryPicker();
    const ok = await verifyPermission(dir, true);
    if (!ok) { alert('Write permission was not granted.'); return; }
    const list = getAllEstimates();
    let count = 0;
    for (const est of list) {
      const name = (est.client && est.client.name) ? String(est.client.name).trim() : 'Client';
      const firstDateRaw = (est.client && est.client.events && est.client.events[0] && est.client.events[0].date) || (est.client && est.client.date) || '';
      let firstDate = '';
      if (firstDateRaw) {
        const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(firstDateRaw);
        const mUs = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(firstDateRaw);
        if (mIso) {
          firstDate = `${mIso[2]}-${mIso[3]}-${mIso[1]}`;
        } else if (mUs) {
          firstDate = `${mUs[1]}-${mUs[2]}-${mUs[3]}`;
        } else {
          const d = new Date(firstDateRaw);
          if (!isNaN(d.getTime())) {
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const yyyy = String(d.getFullYear());
            firstDate = `${mm}-${dd}-${yyyy}`;
          }
        }
      }
      const safeBase = String(name).replace(/[^a-z0-9-_]+/gi, '_');
      const suffix = firstDate ? `_${firstDate}` : '';
      const fileName = `${safeBase}${suffix}`.replace(/_+/g, '_') || `estimate_${String(est.id || Date.now())}`;
      const json = JSON.stringify(est, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const handle = await dir.getFileHandle(`${fileName}.json`, { create: true });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      count++;
    }
    alert(`Exported ${count} files to chosen folder.`);
  } catch (e) {
    alert('Failed to export all files. Use Export All to Folder or Export All Estimates.');
  }
}
// Export estimate to Excel (CSV). Includes all events with totals.
async function exportEstimateToExcel() {
  const events = (state.client.events || []);
  const hasEvents = events.length > 0;
  const rows = [];
  // Header
  rows.push(["Event Date","Station","Item","Price Per Person","Guests","Extended Price"]); 
  const makeCSVRow = (arr) => arr.map((v) => {
    const s = (v === null || v === undefined) ? '' : String(v);
    const needsQuote = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuote ? `"${escaped}"` : escaped;
  }).join(",");

  const addStationItemRows = (ev, stations, guests) => {
    const dateDisplay = formatDateUS((ev && ev.date) || (state.client.date || ''));
    stations.forEach((st) => {
      // Item rows
      (st.items || []).forEach((it) => {
        if (!it.name) return;
        const price = Number(it.price || 0);
        const ext = price * Number(guests || 0);
        rows.push([dateDisplay, st.name || 'Station', it.name, price.toFixed(2), Number(guests || 0), ext.toFixed(2)]);
      });
      // Labor row (if present)
      const laborCount = Number(st.laborCount || 0);
      const laborCost = Number(st.laborCost || 0);
      if (laborCount > 0 && laborCost > 0) {
        const extLabor = laborCount * laborCost;
        rows.push([dateDisplay, st.name || 'Station', 'Labor', laborCost.toFixed(2), laborCount, extLabor.toFixed(2)]);
      }
    });
    // Custom charges rows (if present)
    const list = ensureEventCustomCharges(ev || {});
    list.forEach((ch) => {
      const amt = Number(ch && ch.amount || 0);
      if (amt > 0) {
        const label = (ch && typeof ch.note === 'string' && ch.note.trim()) ? ch.note.trim() : 'Custom charge';
        rows.push([dateDisplay, '', label, '', '', amt.toFixed(2)]);
      }
    });
    // Discount row (if present)
    const d = ensureEventDiscount(ev || {});
    const damt = Number(d.amount || 0);
    if (damt > 0) {
      const label = (typeof d.description === 'string' && d.description.trim()) ? d.description.trim() : 'Discount';
      rows.push([dateDisplay, '', label, '', '', (-damt).toFixed(2)]);
    }
  };

  if (hasEvents) {
    // Per-event breakdown
    [...events].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)).forEach((ev) => {
      const stationsForEvent = state.stations.filter((st) => st.eventId === ev.id);
      const guestsForEvent = (typeof ev.guests === 'number') ? ev.guests : (state.client.guests || 0);
      addStationItemRows(ev, stationsForEvent, guestsForEvent);
      // Event totals
      const fees = ensureEventFees(ev) || state.fees;
      fees._customTotals = getCustomTotalsForEvent(ev);
      const t = computeTotalsForStations(stationsForEvent, fees, guestsForEvent);
      const dateDisplay = formatDateUS(ev.date || '');
      if (Number(t.subtotal || 0) > 0) rows.push([dateDisplay, '', 'Subtotal', '', '', t.subtotal.toFixed(2)]);
      if (Number(t.taxAmount || 0) > 0) rows.push([dateDisplay, '', 'Tax', '', '', t.taxAmount.toFixed(2)]);
      if (Number(t.grandTotal || 0) > 0) rows.push([dateDisplay, '', 'Grand Total', '', '', t.grandTotal.toFixed(2)]);
    });
  } else {
    // Single estimate without events
    const guests = state.client.guests || 0;
    addStationItemRows(null, state.stations, guests);
    const fees = state.fees;
    fees._customTotals = getCustomTotalsForActiveEvent();
    const t = computeTotalsForStations(state.stations, fees, guests);
    const dateDisplay = formatDateUS(state.client.date || '');
    if (Number(t.subtotal || 0) > 0) rows.push([dateDisplay, '', 'Subtotal', '', '', t.subtotal.toFixed(2)]);
    if (Number(t.taxAmount || 0) > 0) rows.push([dateDisplay, '', 'Tax', '', '', t.taxAmount.toFixed(2)]);
    if (Number(t.grandTotal || 0) > 0) rows.push([dateDisplay, '', 'Grand Total', '', '', t.grandTotal.toFixed(2)]);
  }

  const csv = rows.map(makeCSVRow).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const safeName = makeSafeFileBase();
  const fileName = `${safeName}.csv`;
  const savedToFolder = await saveBlobToDataFolder(fileName, blob, 'text/csv');
  if (savedToFolder) { alert(`Exported to data folder as ${fileName}`); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  alert(`Downloaded ${fileName}`);
}

// Export contract to Word (.doc via HTML)
async function exportContractToWord() {
  // Totals across events similar to buildContractView
  const events = (state.client.events || []);
  const sortedEvents = [...events].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const primaryEv = sortedEvents[0] || null;
  const uniformGuests = getGuestsForActiveEvent();
  let totalsForContract = null;
  if (sortedEvents.length > 0) {
    let subtotalSum = 0;
    let taxSum = 0;
    sortedEvents.forEach((ev) => {
      const stationsForEvent = state.stations.filter((st) => st.eventId === ev.id);
      const fees = ensureEventFees(ev) || state.fees;
      fees._customTotals = getCustomTotalsForEvent(ev);
      const guestsForEvent = (typeof ev.guests === 'number') ? ev.guests : uniformGuests;
      const t = computeTotalsForStations(stationsForEvent, fees, guestsForEvent);
      subtotalSum += t.subtotal;
      taxSum += t.taxAmount;
    });
    const grandTotal = subtotalSum + taxSum;
    totalsForContract = { subtotal: subtotalSum, taxAmount: taxSum, grandTotal };
  } else {
    totalsForContract = computeTotals();
  }

  const name = (state.client.name || '').trim();
  const planner = (state.client.planner || '').trim();
  const evDate = (primaryEv && primaryEv.date) || state.client.date || '';
  const guests = (primaryEv && typeof primaryEv.guests === 'number') ? primaryEv.guests : uniformGuests;
  const type = (primaryEv && typeof primaryEv.type === 'string') ? primaryEv.type : '';
  const timing = (primaryEv && typeof primaryEv.timing === 'string') ? primaryEv.timing : '';
  const address = (primaryEv && typeof primaryEv.address === 'string' && primaryEv.address) || state.client.address || '';
  const clientCommentWord = (state.client.comment || '').trim();

  const stationsForContract = primaryEv ? state.stations.filter((st) => st.eventId === primaryEv.id) : [];
  const tpl = getContractTemplate() || defaultContractTemplate();

  // Build simple HTML document string
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const menuHtml = stationsForContract.map((st) => {
    if (!st.name && (st.items || []).length === 0) return '';
    const items = (st.items || []).filter((it) => it.name).map((it) => `<div>${esc(it.name)}</div>`).join('');
    return `<h3 style="text-align:center;">${esc(st.name || 'Station')}</h3><div>${items}</div>`;
  }).join('');

  // Terms: convert into an ordered list with optional bullets
  const termsLines = (tpl.termsText || '').split(/\r?\n/);
  let termsHtml = '<ol>';
  let openLi = false;
  termsLines.forEach((raw) => {
    const line = (raw || '').trim();
    if (!line) { openLi = false; return; }
    if (line.startsWith('- ')) {
      if (!openLi) { termsHtml += '<li>'; openLi = true; }
      termsHtml += `<ul><li>${esc(line.slice(2))}</li></ul>`;
    } else {
      if (openLi) { termsHtml += '</li>'; openLi = false; }
      termsHtml += `<li>${esc(line)}</li>`;
    }
  });
  if (openLi) termsHtml += '</li>';
  termsHtml += '</ol>';

  const notesHtml = (tpl.notesText || '').split(/\r?\n/).filter((l) => l.trim().length).map((l) => `<p>${esc(l.trim())}</p>`).join('');

  const taxRatePct = ((state.taxRate || 0) * 100).toFixed(0);
  const hasKitchenFeeWord = (() => {
    try {
      const events = (state.client.events || []);
      if (events.length > 0) {
        return events.some((ev) => Number(((ensureEventFees(ev) || state.fees).kitchen) || 0) > 0);
      }
      const fees = state.fees || {};
      return Number(fees.kitchen || 0) > 0;
    } catch { return false; }
  })();
  const customChargesWord = (() => {
    try {
      const out = [];
      const events = (state.client.events || []);
      if (events.length > 0) {
        events.forEach((ev) => {
          ensureEventCustomCharges(ev).forEach((ch) => {
            const amt = Number(ch && ch.amount || 0);
            const note = (ch && typeof ch.note === 'string' && ch.note.trim()) ? ch.note.trim() : '';
            if (amt > 0 && note) out.push({ note, amt });
          });
          const fallbackAmt = Number((ev && ev.fees && ev.fees.custom) || 0);
          const fallbackNote = (ev && typeof ev.customNote === 'string' && ev.customNote.trim()) ? ev.customNote.trim() : '';
          if (fallbackAmt > 0 && fallbackNote) out.push({ note: fallbackNote, amt: fallbackAmt });
        });
      } else {
        const ev = primaryEv;
        if (ev) {
          ensureEventCustomCharges(ev).forEach((ch) => {
            const amt = Number(ch && ch.amount || 0);
            const note = (ch && typeof ch.note === 'string' && ch.note.trim()) ? ch.note.trim() : '';
            if (amt > 0 && note) out.push({ note, amt });
          });
          const fallbackAmt = Number((ev && ev.fees && ev.fees.custom) || 0);
          const fallbackNote = (ev && typeof ev.customNote === 'string' && ev.customNote.trim()) ? ev.customNote.trim() : '';
          if (fallbackAmt > 0 && fallbackNote) out.push({ note: fallbackNote, amt: fallbackAmt });
        }
      }
      return out;
    } catch { return []; }
  })();
  const discountsWord = (() => {
    try {
      const out = [];
      const events = (state.client.events || []);
      if (events.length > 0) {
        events.forEach((ev) => {
          const d = ensureEventDiscount(ev);
          const amt = Number(d.amount || 0);
          const note = (typeof d.description === 'string' && d.description.trim()) ? d.description.trim() : '';
          if (amt > 0) out.push({ note: note || 'Discount', amt });
        });
      } else {
        const d = ensureEventDiscount(primaryEv || {});
        const amt = Number(d.amount || 0);
        const note = (typeof d.description === 'string' && d.description.trim()) ? d.description.trim() : '';
        if (amt > 0) out.push({ note: note || 'Discount', amt });
      }
      return out;
    } catch { return []; }
  })();
  const body = `
    <h1>Contract</h1>
    <h2>${esc(name)}</h2>
    <p><strong>Planner:</strong> ${esc(planner)}</p>
    <p><strong>Event Date:</strong> ${esc(formatDateUS(evDate))}</p>
    <p><strong>Guest Count:</strong> ${esc(String(guests || 0))}</p>
    <p><strong>Event Type:</strong> ${esc(type)}</p>
    <p><strong>Timing:</strong> ${esc(timing || 'TBD')}</p>
    <p><strong>Address:</strong> ${esc(address)}</p>
    ${clientCommentWord ? `<p><strong>Comment:</strong> ${esc(clientCommentWord)}</p>` : ``}
    <hr />
    ${menuHtml}
    <hr />
    <p><strong>Price</strong> ${currency(totalsForContract.subtotal)}</p>
    <p><strong>Tax ${taxRatePct}%</strong> ${currency(totalsForContract.taxAmount)} (Tax on Food and Rental only)</p>
    <p><strong>Total</strong> ${currency(totalsForContract.grandTotal)}</p>
    <p><strong>Payment Received</strong> ${currency(Number(state.paymentMade || 0))}</p>
    ${(() => { const bal = Number(totalsForContract.grandTotal || 0) - Number(state.paymentMade || 0); return `<p><strong>Balance</strong> ${currency(bal)}</p>`; })()}
    ${hasKitchenFeeWord ? `<p><strong>Kitchen on Wheels Included</strong></p>` : ``}
    ${(customChargesWord && customChargesWord.length) ? customChargesWord.map((c) => `<p>${esc(c.note)} ${currency(c.amt)}</p>`).join('') : ``}
    ${(discountsWord && discountsWord.length) ? discountsWord.map((c) => `<p>${esc(c.note)} ${currency(-c.amt)}</p>`).join('') : ``}
    <p><strong>Price includes</strong> Food, Refrigerator Truck, Labor, Travel, Chafing Rental</p>
    <p>Please make the check only via Fed-ex or UPS to Punjabi Rasoi LLC (Mail To: 1680 Terrace Lake Dr, Lawrenceville, GA 30043)</p>
  `;

  const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(makeContractTitle())}</title></head><body>${body}</body></html>`;
  const blob = new Blob([htmlDoc], { type: 'application/msword' });
  const safeName = makeSafeFileBase();
  const fileName = `${safeName}.doc`;
  const savedToFolder = await saveBlobToDataFolder(fileName, blob, 'application/msword');
  if (savedToFolder) { alert(`Exported to data folder as ${fileName}`); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  alert(`Downloaded ${fileName}`);
}

// Data folder selection and persistence (File System Access + IndexedDB)
// Backend API base URL (configurable):
// - Defaults to '/api' for same-origin setups
// - Can be overridden via window.API_BASE_URL or localStorage('API_BASE_URL')
//   Example for XAMPP placement under /estimate:
//   localStorage.setItem('API_BASE_URL', 'http://localhost/estimate');
function getApiBaseUrl() {
  return (window.API_BASE_URL || localStorage.getItem('API_BASE_URL') || '/api').replace(/\/$/, '');
}

// Sync current estimate to backend (PHP)
async function syncEstimateToServer() {
  try {
    const payload = buildServerPayload();
    const endpoint = `${getApiBaseUrl()}/save_estimate.php`;
    console.log('Syncing to:', endpoint);
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const status = resp.status;
    const ct = resp.headers.get('content-type') || '';
    let data = null;
    let rawText = '';
    if (ct.includes('application/json')) {
      data = await resp.json().catch(() => ({}));
    } else {
      rawText = await resp.text().catch(() => '');
    }
    if (!resp.ok) {
      const msg = (data && (data.error || data.message)) || rawText || `HTTP ${status}`;
      throw new Error(msg);
    }
    console.log('Sync response:', { status, ct, data, rawText });
    if (data && data.estimate_id) {
      alert(`Synced to DB. Estimate ID: ${data.estimate_id}`);
    } else {
      const bodyPreview = data ? JSON.stringify(data).slice(0, 220) : (rawText ? rawText.slice(0, 220) : '');
      alert(`Synced to DB (status ${status}). No estimate_id in response.\nEndpoint: ${endpoint}\nContent-Type: ${ct}\n${bodyPreview ? 'Body: ' + bodyPreview : ''}`);
    }
  } catch (e) {
    console.error('Sync failed', e);
    const msg = (e && e.message) ? e.message : 'Unknown error';
    alert(`Failed to sync: ${msg}`);
  }
}

function buildServerPayload() {
  const client = { ...state.client };
  const events = (state.client.events || []).map((ev) => ({ ...ev }));
  const stations = state.stations.map((s) => ({
    name: s.name,
    eventId: s.eventId,
    laborCount: Number(s.laborCount || 0),
    laborCost: Number(s.laborCost || 0),
    hideFromPrint: !!s.hideFromPrint,
    items: (s.items || []).map((it) => ({ name: it.name, price: Number(it.price || 0), labor: Number(it.labor || 0) }))
  }));
  // Overall totals reflect the currently active event (if any)
  const overallTotals = (() => {
    const t = computeTotals();
    return {
      totalItems: Number(t.totalItems || 0),
      totalFoodCost: Number(t.totalFoodCost || 0),
      laborCount: Number(t.laborCountTotal || 0),
      laborCalculated: Number(t.laborCalculated || 0),
      subtotal: Number(t.subtotal || 0),
      taxAmount: Number(t.taxAmount || 0),
      grandTotal: Number(t.grandTotal || 0),
      taxRate: Number(state.taxRate || 0)
    };
  })();
  // Per-event totals for idempotent server-side persistence
  const perEventTotals = (state.client.events || []).map((ev) => {
    const stationsForEvent = state.stations.filter((st) => st.eventId === ev.id);
    const feesForEvent = ensureEventFees(ev) || state.fees;
    const guestsForEvent = (typeof ev.guests === 'number') ? ev.guests : (state.client.guests || 0);
    const t = computeTotalsForStations(stationsForEvent, feesForEvent, guestsForEvent);
    return {
      id: ev.id,
      totalItems: Number(t.totalItems || 0),
      totalFoodCost: Number(t.totalFoodCost || 0),
      laborCount: Number(t.laborCountTotal || 0),
      laborCalculated: Number(t.laborCalculated || 0),
      subtotal: Number(t.subtotal || 0),
      taxAmount: Number(t.taxAmount || 0),
      grandTotal: Number(t.grandTotal || 0),
      taxRate: Number(state.taxRate || 0)
    };
  });
  return {
    client,
    events,
    stations,
    totals: overallTotals,
    eventTotals: perEventTotals,
    autoPricePerPerson: !!state.autoPricePerPerson,
    pricePerPerson: Number(state.pricePerPerson || 0),
    fees: { ...state.fees },
    taxRate: Number(state.taxRate || 0),
    activeEventId: state.activeEventId || ''
  };
}
async function chooseDataFolder() {
  try {
    if (!window.showDirectoryPicker) {
      alert('Your browser does not support choosing a folder. Use Chrome or Edge.');
      return;
    }
    const handle = await window.showDirectoryPicker();
    const ok = await verifyPermission(handle, true);
    if (!ok) { alert('Write permission was not granted.'); return; }
    state.dataFolderHandle = handle;
    await idbPut('dataFolder', handle);
    alert('Data folder set. Future exports will save to this folder.');
  } catch (e) {
    if (e && e.name === 'AbortError') return; // user canceled
    console.error('Failed to choose data folder', e);
    alert('Failed to set data folder. See console for details.');
  }
}

async function restoreDataFolderHandle() {
  try {
    const handle = await idbGet('dataFolder');
    if (!handle) return;
    // Query permission without prompting; if denied, we still keep handle and will prompt on write
    const ok = await verifyPermission(handle, false);
    state.dataFolderHandle = handle;
    // No alert on load; silent restore
  } catch (e) {
    // ignore
  }
}

// Load estimates and autosave from the chosen data folder or static files
// in the same directory. Only loads if local storage is empty to avoid clobbering
// the user's current session.
async function loadPortableDataIfAvailable() {
  try {
    const hasLocalEstimates = (getAllEstimates() || []).length > 0;
    const hasLocalSession = !!getAutosave();
    const dir = state.dataFolderHandle;
    // Prefer Data Folder files when available
    if (dir) {
      try {
        // estimates.json
        const estHandle = await dir.getFileHandle('estimates.json').catch(() => null);
        if (!hasLocalEstimates && estHandle) {
          const file = await estHandle.getFile();
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) { setAllEstimates(parsed); renderSavedEstimatesList(); }
        }
        // autosave.json
        const autoHandle = await dir.getFileHandle('autosave.json').catch(() => null);
        if (!hasLocalSession && autoHandle) {
          const file = await autoHandle.getFile();
          const text = await file.text();
          const session = JSON.parse(text);
          try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session || {})); } catch {}
          restoreAutosave();
          renderAll();
        }
      } catch {}
    }
    // Fallback: try static files served from the same folder (when copied to another computer)
    if (!hasLocalEstimates) {
      try {
        const resp = await fetch('estimates.json');
        if (resp && resp.ok) {
          const parsed = await resp.json();
          if (Array.isArray(parsed)) { setAllEstimates(parsed); renderSavedEstimatesList(); }
        }
      } catch {}
    }
    if (!hasLocalSession) {
      try {
        const resp = await fetch('autosave.json');
        if (resp && resp.ok) {
          const session = await resp.json();
          try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(session || {})); } catch {}
          restoreAutosave();
          renderAll();
        }
      } catch {}
    }
  } catch {}
}

async function saveBlobToDataFolder(fileName, blob, _mime) {
  try {
    const dir = state.dataFolderHandle;
    if (!dir) return false;
    const ok = await verifyPermission(dir, true);
    if (!ok) return false;
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (e) {
    console.warn('Saving to chosen folder failed; falling back to download.', e);
    return false;
  }
}

async function verifyPermission(fileHandle, withWrite) {
  try {
    const opts = { mode: withWrite ? 'readwrite' : 'read' };
    // Check if permission was already granted. If so, bail out.
    if (await fileHandle.queryPermission(opts) === 'granted') {
      return true;
    }
    // Request permission.
    return (await fileHandle.requestPermission(opts)) === 'granted';
  } catch (e) {
    return false;
  }
}

// Minimal IndexedDB helpers for storing FileSystemHandle
const FS_IDB_NAME = 'estimate_fs_store';
const FS_IDB_STORE = 'fs';
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      try { req.result.createObjectStore(FS_IDB_STORE); } catch {}
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(key, value) {
  return idbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(FS_IDB_STORE, 'readwrite');
    const store = tx.objectStore(FS_IDB_STORE);
    const req = store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}
function idbGet(key) {
  return idbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(FS_IDB_STORE, 'readonly');
    const store = tx.objectStore(FS_IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

function validateEstimate(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!obj.client || !obj.stations || !Array.isArray(obj.stations)) return false;
  if (!obj.client.events || !Array.isArray(obj.client.events)) obj.client.events = [];
  // Ensure station labor fields exist
  obj.stations = obj.stations.map((s) => ({
    ...s,
    laborCount: (typeof s.laborCount === 'number') ? s.laborCount : 0,
    laborCost: (typeof s.laborCost === 'number') ? s.laborCost : 250,
    hideFromPrint: !!s.hideFromPrint,
  }));
  // Ensure each event has a fees object
  obj.client.events = obj.client.events.map((ev) => ({
    ...ev,
    fees: (!ev.fees || typeof ev.fees !== 'object')
      ? { labor: 0, chafing: 0, travel: 0, kitchen: 0, custom: 0 }
      : {
          labor: Number(ev.fees.labor || 0),
          chafing: Number(ev.fees.chafing || 0),
          travel: Number(ev.fees.travel || 0),
          kitchen: Number(ev.fees.kitchen || 0),
          custom: Number(ev.fees.custom || 0),
        },
    guests: (typeof ev.guests === 'number') ? ev.guests : (obj.client.guests || 0),
    type: (typeof ev.type === 'string') ? ev.type : '',
    address: (typeof ev.address === 'string') ? ev.address : (obj.client.address || ''),
    customNote: (typeof ev.customNote === 'string') ? ev.customNote : '',
    customCharges: Array.isArray(ev.customCharges) ? ev.customCharges.map((ch) => ({
      note: (typeof ch.note === 'string') ? ch.note : '',
      amount: Number(ch.amount || 0),
      taxable: (ch.taxable !== false)
    })) : (() => {
      const fromFee = Number(ev.fees.custom || 0);
      const note = (typeof ev.customNote === 'string' && ev.customNote.trim()) ? ev.customNote.trim() : 'Custom charge';
      return fromFee > 0 ? [{ note, amount: fromFee, taxable: true }] : [];
    })(),
  }));
  if (!obj.fees || typeof obj.fees !== "object") obj.fees = { labor: 0, chafing: 0, travel: 0, kitchen: 0 };
  if (typeof obj.taxRate !== "number") obj.taxRate = 0.06;
  if (typeof obj.autoPricePerPerson !== "boolean") obj.autoPricePerPerson = false;
  if (typeof obj.pricePerPerson !== "number") obj.pricePerPerson = 0;
  return true;
}

function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const list = getAllEstimates();
      const makeKey = (obj) => {
        try {
          const c = obj.client || {};
          const name = String(c.name || '').trim().toLowerCase();
          const phone = String(c.phone || '').trim();
          const primaryDate = String(((c.events && c.events[0] && c.events[0].date) || c.date || '')).trim();
          const events = (c.events || []).map((ev) => String((ev && ev.date) || '')).filter(Boolean).sort().join('|');
          const stations = (obj.stations || []).map((s) => {
            const sn = String(s.name || '').trim().toLowerCase();
            const items = (s.items || []).map((it) => `${String(it.name || '').trim().toLowerCase()}@${Number(it.price || 0)}`).join(',');
            return `${sn}::${items}`;
          }).sort().join('|');
          const fees = obj.fees ? `${Number(obj.fees.labor || 0)}-${Number(obj.fees.chafing || 0)}-${Number(obj.fees.travel || 0)}-${Number(obj.fees.kitchen || 0)}-${Number(obj.fees.custom || 0)}` : '0-0-0-0-0';
          const tax = Number(obj.taxRate || 0);
          return [name, phone, primaryDate, events, stations, fees, tax].join('||');
        } catch { return ''; }
      };
      const existingKeys = new Set(list.map((est) => makeKey(est)));
      let importedCount = 0;
      if (Array.isArray(parsed)) {
        parsed.forEach((obj) => {
          if (validateEstimate(obj)) {
            const key = makeKey(obj);
            if (!existingKeys.has(key)) {
              const est = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                ...obj,
              };
              list.unshift(est);
              existingKeys.add(key);
              importedCount++;
            }
          }
        });
      } else if (validateEstimate(parsed)) {
        const key = makeKey(parsed);
        if (!existingKeys.has(key)) {
          const est = { id: `${Date.now()}`, ...parsed };
          list.unshift(est);
          existingKeys.add(key);
          importedCount++;
          state.client = { ...parsed.client };
          state.stations = parsed.stations.map((s) => ({
            name: s.name,
            eventId: s.eventId,
            laborCount: Number(s.laborCount || 0),
            laborCost: Number(s.laborCost || 0),
            hideFromPrint: !!s.hideFromPrint,
            items: s.items.map((it) => ({ ...it })),
          }));
          state.autoPricePerPerson = !!parsed.autoPricePerPerson;
          state.pricePerPerson = Number(parsed.pricePerPerson || 0);
          state.fees = { ...parsed.fees };
          state.taxRate = Number(parsed.taxRate || 0.06);
          state.activeEventId = parsed.activeEventId || "";
          if ((!state.client.events || state.client.events.length === 0) && state.client.date) {
            const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            state.client.events = [{ id, date: state.client.date, guests: state.client.guests || 0, fees: { labor: state.fees.labor || 0, chafing: state.fees.chafing || 0, travel: state.fees.travel || 0, kitchen: state.fees.kitchen || 0 } }];
            state.activeEventId = id;
            state.stations = state.stations.map((s) => ({ ...s, eventId: s.eventId || id }));
          }
          renderAll();
        }
      }
      setAllEstimates(list);
      renderSavedEstimatesList();
      alert(`Imported ${importedCount} estimate${importedCount === 1 ? "" : "s"}.`);
    } catch (err) {
      alert("Invalid JSON file.");
    } finally {
      e.target.value = ""; // reset file input
    }
  };
  reader.readAsText(file);
}

async function importEstimateFromFolder() {
  try {
    if (!window.showDirectoryPicker) { alert('Your browser does not support choosing a folder. Use Import.'); return; }
    const dir = await window.showDirectoryPicker();
    const ok = await verifyPermission(dir, false);
    if (!ok) { alert('Read permission was not granted.'); return; }
    let file = null;
    if (window.showOpenFilePicker) {
      try {
        const [fh] = await window.showOpenFilePicker({
          types: [{ description: 'Estimate JSON', accept: { 'application/json': ['.json'] } }],
          multiple: false,
          startIn: dir
        });
        file = await fh.getFile();
      } catch {}
    }
    if (!file) {
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'file' && name.toLowerCase().endsWith('.json')) {
          file = await handle.getFile();
          break;
        }
      }
    }
    if (!file) { alert('No JSON file selected or found in the chosen folder.'); return; }
    const text = await file.text();
    const parsed = JSON.parse(text);
    const list = getAllEstimates();
    const makeKey = (obj) => {
      try {
        const c = obj.client || {};
        const name = String(c.name || '').trim().toLowerCase();
        const phone = String(c.phone || '').trim();
        const primaryDate = String(((c.events && c.events[0] && c.events[0].date) || c.date || '')).trim();
        const events = (c.events || []).map((ev) => String((ev && ev.date) || '')).filter(Boolean).sort().join('|');
        const stations = (obj.stations || []).map((s) => {
          const sn = String(s.name || '').trim().toLowerCase();
          const items = (s.items || []).map((it) => `${String(it.name || '').trim().toLowerCase()}@${Number(it.price || 0)}`).join(',');
          return `${sn}::${items}`;
        }).sort().join('|');
        const fees = obj.fees ? `${Number(obj.fees.labor || 0)}-${Number(obj.fees.chafing || 0)}-${Number(obj.fees.travel || 0)}-${Number(obj.fees.kitchen || 0)}-${Number(obj.fees.custom || 0)}` : '0-0-0-0-0';
        const tax = Number(obj.taxRate || 0);
        return [name, phone, primaryDate, events, stations, fees, tax].join('||');
      } catch { return ''; }
    };
    const existingKeys = new Set(list.map((est) => makeKey(est)));
    let importedCount = 0;
    if (Array.isArray(parsed)) {
      parsed.forEach((obj) => {
        if (validateEstimate(obj)) {
          const key = makeKey(obj);
          if (!existingKeys.has(key)) {
            const est = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...obj };
            list.unshift(est);
            existingKeys.add(key);
            importedCount++;
          }
        }
      });
    } else if (validateEstimate(parsed)) {
      const key = makeKey(parsed);
      if (!existingKeys.has(key)) {
        const est = { id: `${Date.now()}`, ...parsed };
        list.unshift(est);
        existingKeys.add(key);
        importedCount++;
        state.client = { ...parsed.client };
        state.stations = parsed.stations.map((s) => ({
          name: s.name,
          eventId: s.eventId,
          laborCount: Number(s.laborCount || 0),
          laborCost: Number(s.laborCost || 0),
          hideFromPrint: !!s.hideFromPrint,
          items: s.items.map((it) => ({ ...it })),
        }));
        state.autoPricePerPerson = !!parsed.autoPricePerPerson;
        state.pricePerPerson = Number(parsed.pricePerPerson || 0);
        state.fees = { ...parsed.fees };
        state.taxRate = Number(parsed.taxRate || 0.06);
        state.activeEventId = parsed.activeEventId || "";
        if ((!state.client.events || state.client.events.length === 0) && state.client.date) {
          const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          state.client.events = [{ id, date: state.client.date, guests: state.client.guests || 0, fees: { labor: state.fees.labor || 0, chafing: state.fees.chafing || 0, travel: state.fees.travel || 0, kitchen: state.fees.kitchen || 0 } }];
          state.activeEventId = id;
          state.stations = state.stations.map((s) => ({ ...s, eventId: s.eventId || id }));
        }
        renderAll();
      }
    }
    setAllEstimates(list);
    renderSavedEstimatesList();
    alert(`Imported ${importedCount} estimate${importedCount === 1 ? "" : "s"}.`);
  } catch {
    alert('Failed to import from folder.');
  }
}

function renderSavedEstimatesList() {
  const select = el("savedEstimatesSelect");
  const list = getAllEstimates();
  const prev = select.value || "";
  select.innerHTML = "";
  // Always include a placeholder so an empty selection remains empty
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "(None)";
  select.appendChild(placeholder);
  list.sort((a, b) => {
    const nameA = (a.client.name || "").toLowerCase();
    const nameB = (b.client.name || "").toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  }).forEach((est) => {
    const opt = document.createElement("option");
    opt.value = est.id;
    const evDates = Array.isArray(est.client.events)
      ? [...est.client.events]
          .map((ev) => ev && ev.date ? String(ev.date).trim() : "")
          .filter((d) => d && d.length)
          .sort((a, b) => new Date(a || 0) - new Date(b || 0))
          .map((d) => formatDateUS(d))
      : [];
    const fallback = est.client.date ? formatDateUS(est.client.date) : "";
    const datesDisplay = evDates.length ? evDates.join(", ") : (fallback || "");
    let label = datesDisplay
      ? `${est.client.name || "(No name)"} — ${datesDisplay}`
      : `${est.client.name || "(No name)"}`;
    if (est.client.planner) {
      label += ` — Planner: ${est.client.planner}`;
    }
    opt.textContent = label;
    select.appendChild(opt);
  });
  // Preserve selection (including empty to keep placeholder selected)
  if (prev) {
    if (list.some((e) => e.id === prev)) {
      select.value = prev;
    }
  } else {
    select.value = "";
  }
  // Disable Update/Delete if none selected
  const hasSelection = !!select.value;
  const updateBtn = el("updateEstimateBtn");
  const deleteBtn = el("deleteEstimateBtn");
  if (updateBtn) updateBtn.disabled = !hasSelection;
  if (deleteBtn) deleteBtn.disabled = !hasSelection;
}

function loadSelectedEstimate() {
  const id = el("savedEstimatesSelect").value;
  if (!id) return;
  const list = getAllEstimates();
  const est = list.find((e) => e.id === id);
  if (!est) return;
  loadEstimateIntoState(est);
}

document.addEventListener("DOMContentLoaded", init);

// Autosave every 30 seconds and on unload
setInterval(() => {
  const session = {
    client: { ...state.client },
    stations: state.stations.map((s) => ({ name: s.name, eventId: s.eventId, laborCount: Number(s.laborCount || 0), laborCost: Number(s.laborCost || 0), hideFromPrint: !!s.hideFromPrint, items: s.items.map((it) => ({ ...it })) })),
    autoPricePerPerson: !!state.autoPricePerPerson,
    pricePerPerson: Number(state.pricePerPerson || 0),
    fees: { ...state.fees },
    taxRate: Number(state.taxRate || 0.06),
    activeEventId: state.activeEventId || "",
    paymentMade: Number(state.paymentMade || 0),
  };
  setAutosave(session);
}, 30000);
window.addEventListener('beforeunload', () => {
  const session = {
    client: { ...state.client },
    stations: state.stations.map((s) => ({ name: s.name, eventId: s.eventId, laborCount: Number(s.laborCount || 0), laborCost: Number(s.laborCost || 0), hideFromPrint: !!s.hideFromPrint, items: s.items.map((it) => ({ ...it })) })),
    autoPricePerPerson: !!state.autoPricePerPerson,
    pricePerPerson: Number(state.pricePerPerson || 0),
    fees: { ...state.fees },
    taxRate: Number(state.taxRate || 0.06),
    activeEventId: state.activeEventId || "",
    paymentMade: Number(state.paymentMade || 0),
  };
  setAutosave(session);
});

function renderEventsUI() {
  const sel = el("eventSelect");
  if (!sel) return;
  sel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select event date";
  sel.appendChild(placeholder);
  const eventsSorted = [...(state.client.events || [])].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  eventsSorted.forEach((ev) => {
    const opt = document.createElement("option");
    opt.value = ev.id;
    opt.textContent = formatDateUS(ev.date || "");
    sel.appendChild(opt);
  });
  const ids = eventsSorted.map((e) => e.id);
  if (!state.activeEventId || !ids.includes(state.activeEventId)) {
    const first = eventsSorted[0];
    if (first) {
      state.activeEventId = first.id;
      sel.value = first.id;
    } else {
      sel.value = "";
    }
  } else {
    sel.value = state.activeEventId || "";
  }
}
// Short datetime formatter for labels
function formatDateTimeShort(d) {
  try {
    return d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
function saveAsNewEstimate() {
  const nameOk = !!(state.client.name && state.client.name.trim());
  const activeEv = getActiveEvent();
  const dateRaw = ((activeEv && activeEv.date) || state.client.date || '').trim();
  const dateOk = !!dateRaw;
  if (!nameOk || !dateOk) { alert("Please set Client Name and Event Date before saving."); return; }
  const list = getAllEstimates();
  const canonicalDate = (s) => {
    const str = String(s || '').trim();
    if (!str) return '';
    const mIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    const mUs = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
    let d;
    if (mIso) d = new Date(`${mIso[1]}-${mIso[2]}-${mIso[3]}T00:00:00`);
    else if (mUs) d = new Date(`${mUs[3]}-${mUs[1]}-${mUs[2]}T00:00:00`);
    else d = new Date(str);
    if (isNaN(d.getTime())) return '';
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const normalizeName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const datesForState = (() => {
    const evs = (state.client.events || []);
    const arr = evs.length ? evs.map((ev) => canonicalDate(ev.date)).filter(Boolean) : [canonicalDate(state.client.date)];
    return arr.filter(Boolean).sort();
  })();
  const matchesEstimate = (est) => {
    const nameMatch = normalizeName(est && est.client && est.client.name) === normalizeName(state.client.name);
    const evs = (est && est.client && est.client.events) || [];
    const arr = evs.length ? evs.map((ev) => canonicalDate(ev.date)).filter(Boolean) : [canonicalDate(est && est.client && est.client.date)];
    const dates = arr.filter(Boolean).sort();
    const sameDates = dates.length === datesForState.length && dates.every((d, i) => d === datesForState[i]);
    return !!nameMatch && !!sameDates;
  };
  const base = {
    client: { ...state.client },
    stations: state.stations.map((s) => ({ name: s.name, eventId: s.eventId, laborCount: s.laborCount || 0, laborCost: s.laborCost || 0, hideFromPrint: !!s.hideFromPrint, items: s.items.map((it) => ({ ...it })) })),
    autoPricePerPerson: state.autoPricePerPerson,
    pricePerPerson: state.pricePerPerson,
    fees: { ...state.fees },
    taxRate: state.taxRate,
    activeEventId: state.activeEventId || "",
    paymentMade: Number(state.paymentMade || 0),
  };
  const dupIdx = list.findIndex((e) => matchesEstimate(e));
  if (dupIdx !== -1) {
    const ok = window.confirm('A saved estimate with the same client and event dates exists. Overwrite it instead of creating a duplicate?');
    if (ok) {
      const id = list[dupIdx].id;
      const est = { id, ...base, createdAt: list[dupIdx].createdAt || Date.now() };
      list[dupIdx] = est;
      setAllEstimates(list);
      const sel = el("savedEstimatesSelect");
      if (sel) sel.value = id;
      renderSavedEstimatesList();
      alert("Estimate updated.");
      return;
    }
  }
  const id = `${Date.now()}`;
  const est = { id, ...base, createdAt: Date.now() };
  list.unshift(est);
  setAllEstimates(list);
  const sel = el("savedEstimatesSelect");
  if (sel) sel.value = id;
  renderSavedEstimatesList();
  alert("Estimate saved as new.");
}


const SUPABASE_URL_KEY = 'estimate_supabase_url';
const SUPABASE_ANON_KEY = 'estimate_supabase_anon_key';
let supabaseClientInstance = null;

function getSupabaseConfig() {
  return {
    url: (localStorage.getItem(SUPABASE_URL_KEY) || '').trim(),
    anonKey: (localStorage.getItem(SUPABASE_ANON_KEY) || '').trim(),
  };
}

function getSupabaseClient() {
  if (supabaseClientInstance) return supabaseClientInstance;
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) return null;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    alert('Supabase client library did not load.');
    return null;
  }
  supabaseClientInstance = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  });
  return supabaseClientInstance;
}

function resetSupabaseClient() {
  supabaseClientInstance = null;
}

function configureSupabase() {
  const current = getSupabaseConfig();
  const url = prompt('Supabase Project URL', current.url || 'https://YOUR_PROJECT.supabase.co');
  if (!url || !url.trim()) return;
  const anonKey = prompt('Supabase anon public key', current.anonKey || '');
  if (!anonKey || !anonKey.trim()) return;
  localStorage.setItem(SUPABASE_URL_KEY, url.trim());
  localStorage.setItem(SUPABASE_ANON_KEY, anonKey.trim());
  resetSupabaseClient();
  alert('Supabase settings saved. Next step: click Supabase Login.');
}

async function handleSupabaseAuthRedirect() {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data && data.session && data.session.user) {
      console.log('Supabase session active for', data.session.user.email || data.session.user.id);
    }
  } catch (e) {
    console.warn('Supabase session restore failed', e);
  }
}

async function requireSupabaseSession() {
  const client = getSupabaseClient();
  if (!client) {
    alert('Please configure Supabase first.');
    return null;
  }
  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data && data.session && data.session.user) {
      return { client, session: data.session };
    }
    alert('Please login to Supabase first.');
    return null;
  } catch (e) {
    alert(`Supabase session error: ${e.message || e}`);
    return null;
  }
}

async function signInToSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    alert('Please configure Supabase first.');
    return;
  }
  const email = prompt('Email for magic link login');
  if (!email || !email.trim()) return;
  try {
    const redirectTo = window.location.href.split('#')[0];
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo }
    });
    if (error) throw error;
    alert('Magic link sent. Open it in this browser, then come back and use Cloud Save or Cloud Load.');
  } catch (e) {
    alert(`Supabase login failed: ${e.message || e}`);
  }
}

async function signOutOfSupabase() {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.auth.signOut();
    alert('Supabase session cleared.');
  } catch (e) {
    alert(`Supabase logout failed: ${e.message || e}`);
  }
}

function getPrimaryEventDateForEstimatePayload(payload) {
  const evs = ((payload && payload.client && payload.client.events) || []).map((ev) => String((ev && ev.date) || '').trim()).filter(Boolean);
  if (!evs.length) return String((payload && payload.client && payload.client.date) || '').trim() || null;
  return [...evs].sort()[0];
}

function getEstimateTitleFromPayload(payload) {
  const clientName = String((payload && payload.client && payload.client.name) || 'Untitled').trim() || 'Untitled';
  const primaryDate = getPrimaryEventDateForEstimatePayload(payload) || 'No Date';
  return `${clientName} | ${primaryDate}`;
}

function buildCloudEstimatePayload() {
  return {
    id: ((el('savedEstimatesSelect') && el('savedEstimatesSelect').value) || '').trim() || `${Date.now()}`,
    client: { ...state.client },
    stations: state.stations.map((s) => ({
      name: s.name,
      eventId: s.eventId,
      laborCount: Number(s.laborCount || 0),
      laborCost: Number(s.laborCost || 0),
      hideFromPrint: !!s.hideFromPrint,
      items: (s.items || []).map((it) => ({ ...it }))
    })),
    autoPricePerPerson: !!state.autoPricePerPerson,
    pricePerPerson: Number(state.pricePerPerson || 0),
    fees: { ...state.fees },
    taxRate: Number(state.taxRate || 0.06),
    activeEventId: state.activeEventId || '',
    paymentMade: Number(state.paymentMade || 0),
    createdAt: Date.now(),
  };
}

function loadEstimateIntoState(est) {
  if (!est || typeof est !== 'object') return;
  state.client = { ...est.client };
  state.stations = (est.stations || []).map((s) => ({
    name: s.name,
    eventId: s.eventId,
    laborCount: Number(s.laborCount || 0),
    laborCost: (Number(s.laborCost || 0) > 0) ? Number(s.laborCost) : 250,
    hideFromPrint: !!s.hideFromPrint,
    items: (s.items || []).map((it) => ({ ...it })),
  }));
  state.autoPricePerPerson = !!est.autoPricePerPerson;
  state.pricePerPerson = Number(est.pricePerPerson || 0);
  state.fees = { ...est.fees };
  state.taxRate = Number(est.taxRate || 0.06);
  state.paymentMade = Number(est.paymentMade || 0);
  const evs = Array.isArray(state.client.events) ? state.client.events : [];
  let firstEv = null;
  if (evs.length > 0) {
    firstEv = [...evs].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))[0] || evs[0];
  }
  state.activeEventId = firstEv ? (firstEv.id || '') : '';
  if (state.ui) state.ui.eventDateDraft = firstEv ? (firstEv.date || '') : '';
  renderEventsUI();
  renderAll();
}

async function saveEstimateToSupabase() {
  const ctx = await requireSupabaseSession();
  if (!ctx) return;
  const { client, session } = ctx;
  try {
    const payload = buildCloudEstimatePayload();
    const title = getEstimateTitleFromPayload(payload);
    const primaryDate = getPrimaryEventDateForEstimatePayload(payload);
    const record = {
      owner_id: session.user.id,
      local_estimate_id: String(payload.id || '').trim() || `${Date.now()}`,
      title,
      client_name: String((payload.client && payload.client.name) || '').trim(),
      primary_event_date: primaryDate,
      payload,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client
      .from('app_estimates')
      .upsert(record, { onConflict: 'owner_id,local_estimate_id' });
    if (error) throw error;
    alert('Cloud save completed.');
  } catch (e) {
    alert(`Cloud save failed: ${e.message || e}`);
  }
}

async function loadEstimateFromSupabase() {
  const ctx = await requireSupabaseSession();
  if (!ctx) return;
  const { client, session } = ctx;
  try {
    const { data, error } = await client
      .from('app_estimates')
      .select('id, local_estimate_id, title, client_name, primary_event_date, payload, updated_at')
      .eq('owner_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!data || !data.length) {
      alert('No cloud estimates found for this account yet.');
      return;
    }
    const lines = data.map((row, idx) => `${idx + 1}. ${row.title || row.client_name || 'Untitled'}${row.updated_at ? ` | ${new Date(row.updated_at).toLocaleString()}` : ''}`);
    const choiceRaw = prompt(`Choose estimate number to load:\n\n${lines.join('\n')}`, '1');
    if (!choiceRaw || !choiceRaw.trim()) return;
    const choice = Number(choiceRaw);
    if (!Number.isInteger(choice) || choice < 1 || choice > data.length) {
      alert('Invalid choice.');
      return;
    }
    const selected = data[choice - 1];
    if (!selected || !selected.payload) {
      alert('Selected row has no payload.');
      return;
    }
    loadEstimateIntoState(selected.payload);
    alert('Cloud estimate loaded.');
  } catch (e) {
    alert(`Cloud load failed: ${e.message || e}`);
  }
}
