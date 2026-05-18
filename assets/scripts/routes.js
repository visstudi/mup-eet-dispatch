const API_URL = "";
let allRoutes = [];
let currentRouteData = null;
let tempScheduleItem = {};

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  const token = localStorage.getItem("auth_token");
  if (!token || token === "undefined") {
    window.location.href = "login.html";
    return;
  }
  initUI();
  initOverlayWizard();
  initCreateOverlay();
  await fetchRoutes();
}

async function apiCall(endpoint, method = "GET", body = null) {
  let rawToken = localStorage.getItem("auth_token") || "";
  let cleanToken = rawToken.replace(/^["']|["']$/g, "").trim();

  const headers = { Accept: "*/*", Authorization: cleanToken };
  if (body) headers["Content-Type"] = "application/json";

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    if (response.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "login.html";
      return null;
    }
    const text = await response.text();
    if (!response.ok) throw new Error(text || response.status);
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  } catch (e) {
    throw e;
  }
}

async function fetchRoutes() {
  try {
    const data = await apiCall("/NetworkStates/get");
    allRoutes = data.routes || [];
    renderRouteList();
    if (allRoutes.length > 0 && !currentRouteData)
      selectRoute(allRoutes[0].name);
  } catch (e) {
    console.error("Ошибка загрузки");
  }
}

function renderRouteList() {
  const container = document.querySelector(".list.flex-column");
  container.innerHTML = "";
  allRoutes.forEach((route) => {
    const art = document.createElement("article");
    art.className = `list-entry ${currentRouteData?.name === route.name ? "active" : ""}`;
    art.innerHTML = `<h4>Маршрут ${route.name}</h4><p>[${route.fromStation || ""} - ${route.toStation || ""}]</p><img src="../assets/icons/right.svg" alt="" />`;
    art.onclick = () => selectRoute(route.name);
    container.appendChild(art);
  });
}

function selectRoute(name) {
  const original = allRoutes.find((r) => r.name === name);
  if (!original) return;
  currentRouteData = JSON.parse(JSON.stringify(original));
  renderRouteList();

  const panel = document.querySelector(".modify-route-info");
  panel.querySelector("#color-preview div").textContent = currentRouteData.name;
  const hex = currentRouteData.color.startsWith("#")
    ? currentRouteData.color
    : `#${currentRouteData.color}`;
  panel.querySelector("#color-input-text").value = hex;
  updateColorPreview(hex, panel);

  panel.querySelector("#stop-first input").value =
    currentRouteData.fromStation || "";
  panel.querySelector("#stop-last input").value =
    currentRouteData.toStation || "";

  applyPriceLabels(currentRouteData.routeType, panel);
  panel.querySelector("#price-first input").value =
    currentRouteData.priceLow || 0;
  panel.querySelector("#price-second input").value =
    currentRouteData.priceHigh || 0;
  panel.querySelector("#map-link input").value =
    currentRouteData.yandexMapLink || "";

  renderScheduleTable();
}

function initCreateOverlay() {
  const createBtn = document.getElementById("create-route-button");
  const overlay = document.getElementById("overlay-route-create");
  const form = overlay.querySelector("form");

  const colorInputCreate = overlay.querySelector("#color-input-text");
  colorInputCreate.addEventListener("input", (e) => {
    updateColorPreview(e.target.value, overlay);
  });

  createBtn.onclick = () => {
    form.reset();
    overlay.querySelector(".dropdown-choice").textContent = "По способу оплаты";
    overlay
      .querySelector("#price-variation")
      .setAttribute("data-current-type", "0");
    applyPriceLabels(0, overlay);
    updateColorPreview("#3E8DE9", overlay);
    overlay.classList.remove("hidden");
  };

  overlay.querySelector("#color-input-text").oninput = (e) =>
    updateColorPreview(e.target.value, overlay);

  overlay.querySelectorAll(".dropdown-content div").forEach((div) => {
    div.onclick = () => {
      const type = div.textContent.trim() === "По способу оплаты" ? 0 : 1;
      applyPriceLabels(type, overlay);
      div.parentElement.style.maxHeight = null;
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Создание...";

    try {
      const name = overlay.querySelector("#route-number-text").value.trim();
      const mapUrl =
        overlay.querySelector("#map-link input")?.value?.trim() || "";

      const payload = {
        name: name,
        color:
          overlay.querySelector("#color-input-text").value.trim() || "#3E8DE9",
        fromStation: overlay.querySelector("#stop-first input").value.trim(),
        toStation: overlay.querySelector("#stop-last input").value.trim(),
        routeType: parseInt(
          overlay
            .querySelector("#price-variation")
            .getAttribute("data-current-type"),
        ),
        priceLow:
          parseInt(overlay.querySelector("#price-first input").value) || 0,
        priceHigh:
          parseInt(overlay.querySelector("#price-second input").value) || 0,
        map: mapUrl ? 2 : 0,
        yandexMapLink: mapUrl || null,
      };

      await apiCall("/NetworkStates/create", "POST", payload);
      alert("Маршрут создан!");
      overlay.classList.add("hidden");
      await fetchRoutes();
      selectRoute(name);
    } catch (err) {
      alert("Ошибка создания: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Сохранить";
    }
  };
}

function updateColorPreview(hex, container) {
  if (!/^#[0-9A-F]{6}$/i.test(hex)) return;
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);

  const colorSection =
    container.querySelector("#route-color") ||
    container.querySelector("#route-number-color");
  if (colorSection)
    colorSection.style.setProperty("--current-color", `${r} ${g} ${b}`);

  const cp = container.querySelector("#color-input-preview");
  if (cp) cp.style.backgroundColor = hex;
}

function applyPriceLabels(type, container) {
  const dropdown = container.querySelector("#price-variation");
  dropdown.setAttribute("data-current-type", type);
  dropdown.querySelector(".dropdown-choice").textContent =
    type == 0 ? "По способу оплаты" : "По месту назначения";

  container.querySelector("#price-first h3").textContent =
    type == 0 ? "Наличный способ" : "По городу";
  container.querySelector("#price-second h3").textContent =
    type == 0 ? "Безналичный способ" : "Межгород";
}

async function saveAllData() {
  if (!currentRouteData) return;
  const btn = document.querySelector(
    "#route-control-buttons button:last-child",
  );
  btn.disabled = true;
  btn.textContent = "Сохранение...";
  const panel = document.querySelector(".modify-route-info");

  try {
    await apiCall("/Schedule/update", "POST", {
      route: currentRouteData.name,
      scheduleTable: currentRouteData.scheduleTable,
    });

    const mapUrl = panel.querySelector("#map-link input").value.trim();
    const payload = {
      name: currentRouteData.name,
      color: panel.querySelector("#color-input-text").value.trim(),
      fromStation: panel.querySelector("#stop-first input").value.trim(),
      toStation: panel.querySelector("#stop-last input").value.trim(),
      routeType: parseInt(
        panel
          .querySelector("#price-variation")
          .getAttribute("data-current-type"),
      ),
      priceLow: parseInt(panel.querySelector("#price-first input").value) || 0,
      priceHigh:
        parseInt(panel.querySelector("#price-second input").value) || 0,
      map: mapUrl ? 2 : 0,
      yandexMapLink: mapUrl || null,
    };

    await apiCall("/NetworkStates/edit", "PATCH", payload);
    alert("Сохранено!");
    await fetchRoutes();
  } catch (e) {
    alert("Ошибка: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Сохранить";
  }
}

function renderScheduleTable() {
  const tbody = document.querySelector("#route-schedule tbody");
  tbody.innerHTML = "";
  const table = currentRouteData.scheduleTable || [];
  const sorted = [...table].sort((a, b) =>
    (a.startRange || "").localeCompare(b.startRange || ""),
  );

  sorted.forEach((item, index) => {
    const isDuty = item.interval === -1;
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${(item.startRange || "00:00").slice(0, 5)} - ${(item.endRange || "...").slice(0, 5)}</td>
            <td>${item.annotation || "-"}</td>
            <td>${isDuty ? "-" : (item.interval || 0) + " мин."}</td>
            <td><input type="checkbox" ${isDuty ? "checked" : ""} class="duty-check" data-idx="${index}"></td>
            <td><a href="#" style="color:#e93e3e" class="del-row" data-idx="${index}">Удалить</a></td>
        `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".duty-check").forEach((chk) => {
    chk.onchange = (e) => {
      sorted[e.target.dataset.idx].interval = e.target.checked ? -1 : 10;
      currentRouteData.scheduleTable = sorted;
      renderScheduleTable();
    };
  });
  tbody.querySelectorAll(".del-row").forEach((lnk) => {
    lnk.onclick = (e) => {
      e.preventDefault();
      sorted.splice(lnk.dataset.idx, 1);
      currentRouteData.scheduleTable = sorted;
      renderScheduleTable();
    };
  });
}

function initUI() {
  document.querySelectorAll(".dropdown-button").forEach((btn) => {
    btn.onclick = () => {
      const menu = btn.nextElementSibling;
      document.querySelectorAll(".dropdown-content").forEach((c) => {
        if (c !== menu) c.style.maxHeight = null;
      });
      menu.style.maxHeight = menu.style.maxHeight ? null : "150px";
    };
  });
  document
    .querySelectorAll("#price-variation .dropdown-content div")
    .forEach((div) => {
      div.onclick = () => {
        const panel =
          div.closest(".modify-route-info") || div.closest(".overlay");
        applyPriceLabels(
          div.textContent.trim() === "По способу оплаты" ? 0 : 1,
          panel,
        );
        div.parentElement.style.maxHeight = null;
      };
    });
  document
    .querySelectorAll('.form-control-buttons button[type="button"]')
    .forEach((btn) => {
      btn.onclick = () => btn.closest(".overlay").classList.add("hidden");
    });
  document.querySelector("#route-control-buttons button:last-child").onclick =
    saveAllData;
  document.querySelector("#route-control-buttons button:first-child").onclick =
    async () => {
      if (confirm("Удалить маршрут?")) {
        await apiCall(
          `/NetworkStates/remove?routeName=${currentRouteData.name}`,
          "DELETE",
        );
        currentRouteData = null;
        await fetchRoutes();
      }
    };
  document.getElementById("color-input-text").oninput = (e) =>
    updateColorPreview(
      e.target.value,
      document.querySelector(".modify-route-info"),
    );
}

function formatTime(t) {
  if (!t) return null;
  let p = t.split(":");
  return `${(p[0] || "00").padStart(2, "0")}:${(p[1] || "00").padStart(2, "0")}:00`;
}

function initOverlayWizard() {
  const oTime = document.getElementById("overlay-route-time");
  const oNote = document.getElementById("overlay-route-note");
  const oPeriod = document.getElementById("overlay-route-period");

  document.querySelector("#route-schedule tfoot button").onclick = () => {
    tempScheduleItem = {};
    [oTime, oNote, oPeriod].forEach((o) => o.querySelector("form").reset());
    oTime.classList.remove("hidden");
  };

  oTime.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const choice = oTime.querySelector(".dropdown-choice").textContent.trim();
    if (choice === "Точное время") {
      tempScheduleItem.startRange = formatTime(
        document.getElementById("precise-time-text").value,
      );
      tempScheduleItem.endRange = null;
    } else {
      tempScheduleItem.startRange = formatTime(
        document.getElementById("from-time-text").value,
      );
      tempScheduleItem.endRange = formatTime(
        document.getElementById("to-time-text").value,
      );
    }
    oTime.classList.add("hidden");
    oNote.classList.remove("hidden");
  };

  oNote.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    tempScheduleItem.annotation =
      document.getElementById("note-text").value || null;
    oNote.classList.add("hidden");
    oPeriod.classList.remove("hidden");
  };

  oPeriod.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const type = oPeriod.querySelector(".dropdown-choice").textContent.trim();
    if (type === "Дежурный") tempScheduleItem.interval = -1;
    else if (type === "Точный интервал")
      tempScheduleItem.interval =
        parseInt(document.getElementById("precise-period-text").value) || 0;
    else
      tempScheduleItem.interval =
        parseInt(
          document.getElementById("period-interval").querySelector("input")
            .value,
        ) || 0;

    currentRouteData.scheduleTable.push(tempScheduleItem);
    renderScheduleTable();
    oPeriod.classList.add("hidden");
  };
}
