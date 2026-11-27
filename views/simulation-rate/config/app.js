(() => {
  const settingsKey = "desktopxr.simulation-rate.config";
  const hideWhen1x = document.getElementById("hide-when-1x");
  const hideWhenEngineOff = document.getElementById("hide-when-engine-off");
  const transparency = document.getElementById("transparency");
  const transparencyValue = document.getElementById("transparency-value");
  const saveStatus = document.getElementById("save-status");

  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
    hideWhen1x.checked = Boolean(saved.hideWhen1x);
    hideWhenEngineOff.checked = saved.hideWhenEngineOff ?? true;
    transparency.value = String(Math.min(95, Math.max(5, Number(saved.transparency ?? 5))));
  } catch {
    // Leave both options at their default (off) if stored settings are invalid.
  }
  function describeTransparency(value) {
    if (value < 23) return "Very visible";
    if (value < 41) return "Visible";
    if (value < 60) return "Balanced";
    if (value < 78) return "Faint";
    return "Very faint";
  }

  function updateTransparencyLabel() {
    const description = describeTransparency(Number(transparency.value));
    transparencyValue.value = description;
    transparency.setAttribute("aria-valuetext", description);
  }

  updateTransparencyLabel();

  function saveSettings() {
    const settings = {
      hideWhen1x: hideWhen1x.checked,
      hideWhenEngineOff: hideWhenEngineOff.checked,
      transparency: Number(transparency.value),
    };
    try {
      localStorage.setItem(settingsKey, JSON.stringify(settings));
      saveStatus.textContent = "Settings saved.";
    } catch {
      saveStatus.textContent = "Could not save settings in this browser.";
    }
  }

  hideWhen1x.addEventListener("change", saveSettings);
  hideWhenEngineOff.addEventListener("change", saveSettings);
  transparency.addEventListener("input", () => {
    updateTransparencyLabel();
    saveSettings();
  });
})();
