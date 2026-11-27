(() => {
  const badge = document.getElementById("status-badge");
  const statusCard = document.querySelector(".status-card");
  const viewList = document.getElementById("view-list");
  const viewCount = document.getElementById("view-count");
  const databridgePath = document.getElementById("databridge-path");
  const databridgeState = document.getElementById("databridge-state");
  const databridgeNotice = document.getElementById("databridge-notice");
  const panelSlots = document.getElementById("panel-slots");
  const registeredSummary = document.getElementById("registered-summary");
  const reloadButton = document.getElementById("reload-databridge");
  const saveButton = document.getElementById("save-databridge");
  const advancedOptions = document.getElementById("advanced-options");
  let viewsLoaded = false;
  let availableViews = [];
  let configAvailable = false;
  let savedState = "[]";

  function setNotice(message, kind = "") {
    databridgeNotice.textContent = message;
    databridgeNotice.dataset.kind = kind;
  }

  function renderViews(views) {
    if (!Array.isArray(views)) return;
    availableViews = views;
    viewsLoaded = true;
    viewCount.textContent = String(views.length).padStart(2, "0");
    viewList.replaceChildren();

    if (!views.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No views found. Add a folder under views/ with an index.html page.";
      viewList.append(empty);
      return;
    }

    for (const view of views) {
      const entry = document.createElement("div");
      entry.className = "view-entry";

      const card = document.createElement("div");
      card.className = "view-card";

      const link = document.createElement("a");
      link.className = "view-main";
      link.href = view.url;

      const icon = document.createElement("span");
      icon.className = "view-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "↗";

      const copy = document.createElement("span");
      copy.className = "view-copy";
      const title = document.createElement("span");
      title.className = "view-title";
      title.textContent = view.name;
      const description = document.createElement("span");
      description.className = "view-description";
      description.textContent = view.description;
      copy.append(title, description);

      const action = document.createElement("a");
      action.className = "view-action";
      action.href = view.url;
      action.textContent = "OPEN VIEW";
      link.append(icon, copy);
      card.append(link, action);

      if (view.config_url) {
        const configLink = document.createElement("a");
        configLink.className = "view-action view-config";
        configLink.href = view.config_url;
        configLink.textContent = "CONFIGURE";
        card.append(configLink);
      }

      entry.append(card);
      viewList.append(entry);
    }
  }

  function localViewForUrl(url) {
    if (!url) return null;
    try {
      const pathname = new URL(url, window.location.origin).pathname.replace(/\/$/, "");
      return availableViews.find((view) => view.url.replace(/\/$/, "") === pathname) || null;
    } catch {
      return null;
    }
  }

  function getFormSlots() {
    return [...panelSlots.querySelectorAll(".panel-slot")].map((card) => ({
      enabled: card.querySelector("[data-field='enabled']").checked,
      url: card.querySelector("[data-field='url']").value.trim(),
      width: card.querySelector("[data-field='width']").value.trim(),
      height: card.querySelector("[data-field='height']").value.trim(),
    }));
  }

  function updateSummary() {
    const slots = getFormSlots();
    const enabledCount = slots.filter((slot) => slot.enabled && slot.url).length;
    registeredSummary.textContent = `${enabledCount} of 4 panels enabled`;
  }

  function updateSaveButton() {
    const changed = JSON.stringify(getFormSlots()) !== savedState;
    saveButton.disabled = !configAvailable || !changed;
    saveButton.textContent = changed ? "Save changes" : "All changes saved";
    updateSummary();
  }

  function setAdvancedOptions(enabled) {
    for (const fields of panelSlots.querySelectorAll(".advanced-fields")) {
      fields.dataset.open = String(enabled);
      fields.setAttribute("aria-hidden", String(!enabled));
      fields.querySelectorAll("input").forEach((input) => {
        input.disabled = !enabled;
      });
    }
  }

  function makePanelSlot(slot, index) {
    const card = document.createElement("article");
    card.className = "panel-slot";
    card.dataset.enabled = String(slot.enabled);

    const header = document.createElement("div");
    header.className = "slot-header";
    const titleBlock = document.createElement("div");
    titleBlock.className = "slot-title-block";
    const number = document.createElement("span");
    number.className = "slot-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "slot-title";
    title.textContent = `Panel slot ${index + 1}`;
    const subtitle = document.createElement("p");
    subtitle.className = "slot-subtitle";
    subtitle.textContent = `DataBridge web${index + 1}`;
    copy.append(title, subtitle);
    titleBlock.append(number, copy);

    const enabledLabel = document.createElement("label");
    enabledLabel.className = "enabled-toggle";
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = Boolean(slot.enabled);
    enabled.dataset.field = "enabled";
    const toggleText = document.createElement("span");
    toggleText.textContent = "Enabled";
    enabledLabel.append(enabled, toggleText);
    header.append(titleBlock, enabledLabel);

    const panelLabel = document.createElement("label");
    panelLabel.className = "field-label panel-choice-label";
    panelLabel.textContent = "Panel";
    const select = document.createElement("select");
    select.className = "field-control";
    select.setAttribute("aria-label", `Panel for DataBridge slot ${index + 1}`);
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Choose a panel…";
    select.append(emptyOption);
    for (const view of availableViews) {
      const option = document.createElement("option");
      option.value = view.url;
      option.textContent = view.name;
      select.append(option);
    }
    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "Custom URL…";
    select.append(customOption);
    panelLabel.append(select);

    const advancedFields = document.createElement("div");
    advancedFields.className = "advanced-fields";
    advancedFields.dataset.open = String(advancedOptions.checked);
    advancedFields.setAttribute("aria-hidden", String(!advancedOptions.checked));

    const urlLabel = document.createElement("label");
    urlLabel.className = "field-label url-field-label";
    urlLabel.textContent = "Panel address";
    const urlInput = document.createElement("input");
    urlInput.className = "field-control url-control";
    urlInput.type = "url";
    urlInput.placeholder = "Select a panel above or enter a URL";
    urlInput.autocomplete = "url";
    urlInput.dataset.field = "url";
    urlInput.value = slot.url || "";
    urlLabel.append(urlInput);

    const matchingView = localViewForUrl(slot.url);
    if (matchingView) {
      select.value = matchingView.url;
      urlInput.value = new URL(matchingView.url, window.location.origin).href;
      urlInput.readOnly = true;
      urlInput.setAttribute("aria-describedby", `slot-url-help-${index + 1}`);
    } else if (slot.url) {
      select.value = "__custom__";
    }

    const urlHelp = document.createElement("span");
    urlHelp.className = "field-help url-help";
    urlHelp.id = `slot-url-help-${index + 1}`;
    urlHelp.textContent = "Local panel addresses use this app's current server URL.";

    const dimensions = document.createElement("div");
    dimensions.className = "dimensions-row";
    const dimensionFields = [];
    for (const dimension of ["width", "height"]) {
      const label = document.createElement("label");
      label.className = "field-label dimension-field";
      label.textContent = dimension === "width" ? "Width (optional)" : "Height (optional)";
      const input = document.createElement("input");
      input.className = "field-control";
      input.type = "number";
      input.min = "1";
      input.max = "10000";
      input.step = "1";
      input.inputMode = "numeric";
      input.placeholder = "Optional";
      input.value = slot[dimension] || "";
      input.dataset.field = dimension;
      label.append(input);
      dimensions.append(label);
      dimensionFields.push(input);
    }

    select.addEventListener("change", () => {
      const selectedView = availableViews.find((view) => view.url === select.value);
      if (selectedView) {
        urlInput.value = new URL(selectedView.url, window.location.origin).href;
        urlInput.readOnly = true;
        urlInput.setAttribute("aria-describedby", `slot-url-help-${index + 1}`);
        enabled.checked = true;
      } else if (select.value === "__custom__") {
        if (!advancedOptions.checked) {
          advancedOptions.checked = true;
          setAdvancedOptions(true);
        }
        if (localViewForUrl(urlInput.value)) urlInput.value = "";
        urlInput.readOnly = false;
        enabled.checked = Boolean(urlInput.value.trim());
        urlInput.focus();
      } else {
        urlInput.value = "";
        urlInput.readOnly = true;
        enabled.checked = false;
      }
      card.dataset.enabled = String(enabled.checked);
      updateSaveButton();
    });

    enabled.addEventListener("change", () => {
      card.dataset.enabled = String(enabled.checked);
      updateSaveButton();
    });
    urlInput.addEventListener("input", () => {
      enabled.checked = Boolean(urlInput.value.trim());
      card.dataset.enabled = String(enabled.checked);
      updateSaveButton();
    });
    dimensionFields.forEach((input) => input.addEventListener("input", updateSaveButton));

    advancedFields.append(urlLabel, urlHelp, dimensions);
    advancedFields.querySelectorAll("input").forEach((input) => {
      input.disabled = !advancedOptions.checked;
    });
    card.append(header, panelLabel, advancedFields);
    return card;
  }

  function renderDataBridge(config) {
    databridgePath.textContent = config.path || "DataBridge config path unavailable";
    databridgeState.textContent = config.available
      ? "FILE FOUND"
      : config.error && config.error.startsWith("Could not read")
        ? "READ ERROR"
        : "NOT FOUND";
    databridgeState.dataset.available = String(config.available);
    configAvailable = Boolean(config.available);
    reloadButton.disabled = false;
    panelSlots.replaceChildren();

    if (Array.isArray(config.views)) renderViews(config.views);
    if (!configAvailable) {
      const error = document.createElement("p");
      error.className = "empty-state";
      error.textContent = config.error || "DataBridge settings are unavailable.";
      panelSlots.append(error);
      setNotice("The file was not changed. Check the path above, then reload after fixing it.", "warning");
      savedState = "[]";
      saveButton.disabled = true;
      saveButton.textContent = "Save changes";
      registeredSummary.textContent = "Settings unavailable";
      return;
    }

    const slots = Array.isArray(config.slots) ? config.slots : [];
    for (let index = 0; index < 4; index += 1) {
      panelSlots.append(makePanelSlot(slots[index] || {}, index));
    }
    savedState = JSON.stringify(Array.from({ length: 4 }, (_, index) => {
      const slot = slots[index] || {};
      return {
        enabled: Boolean(slot.enabled),
        url: String(slot.url || "").trim(),
        width: String(slot.width || "").trim(),
        height: String(slot.height || "").trim(),
      };
    }));
    setNotice("Selecting a panel or entering a URL registers and enables that slot. Uncheck Enabled to keep it configured but inactive. Changes are only written when you choose Save changes.", "info");
    updateSaveButton();
  }

  async function loadDataBridge({ confirmDiscard = false } = {}) {
    if (confirmDiscard && JSON.stringify(getFormSlots()) !== savedState) {
      if (!window.confirm("Discard your unsaved panel changes and reload the DataBridge file?")) return;
    }
    reloadButton.disabled = true;
    reloadButton.textContent = "Loading…";
    try {
      const response = await fetch("/api/databridge", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not read DataBridge settings");
      renderDataBridge(await response.json());
    } catch (error) {
      configAvailable = false;
      databridgeState.textContent = "ERROR";
      databridgeState.dataset.available = "false";
      setNotice(error.message || "Could not load the DataBridge settings.", "error");
      saveButton.disabled = true;
    } finally {
      reloadButton.disabled = false;
      reloadButton.textContent = "Reload file";
    }
  }

  async function saveDataBridge() {
    const slots = getFormSlots();
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    setNotice("Updating the WebOverlays section…", "info");
    try {
      const response = await fetch("/api/databridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save DataBridge settings");
      savedState = JSON.stringify(slots);
      saveButton.textContent = "All changes saved";
      setNotice(`Saved. A backup was kept at ${result.backup}. If DesktopXR does not apply the changes right away, restart it.`, "success");
      updateSummary();
    } catch (error) {
      setNotice(error.message || "Could not save DataBridge settings.", "error");
      updateSaveButton();
    }
  }

  async function refresh() {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Status endpoint unavailable");
      const state = await response.json();

      const live = Boolean(state.connected && state.rate !== null);
      statusCard.dataset.connected = String(live);
      badge.textContent = live ? "CONNECTED" : "WAITING";
      renderViews(state.views);
    } catch {
      statusCard.dataset.connected = "false";
      badge.textContent = "WAITING";
      if (!viewsLoaded) {
        viewCount.textContent = "—";
        viewList.innerHTML = '<p class="empty-state">Views could not be loaded.</p>';
      }
    }
  }

  refresh();
  loadDataBridge();
  reloadButton.addEventListener("click", () => loadDataBridge({ confirmDiscard: true }));
  saveButton.addEventListener("click", saveDataBridge);
  advancedOptions.addEventListener("change", () => setAdvancedOptions(advancedOptions.checked));
  window.setInterval(refresh, 2000);
})();
