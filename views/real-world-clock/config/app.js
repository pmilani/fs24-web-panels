(() => {
  const settingsKey = "desktopxr.real-world-clock.config";
  const formatInputs = document.querySelectorAll('input[name="format"]');
  const saveStatus = document.getElementById("save-status");

  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
    const selectedFormat = saved.format === "ampm" ? "ampm" : "24h";
    document.querySelector(`input[name="format"][value="${selectedFormat}"]`).checked = true;
  } catch {
    // Keep the default 24-hour selection if stored settings are unavailable or invalid.
  }

  function saveFormat(event) {
    try {
      localStorage.setItem(settingsKey, JSON.stringify({ format: event.target.value }));
      saveStatus.textContent = "Settings saved.";
    } catch {
      saveStatus.textContent = "Could not save settings in this browser.";
    }
  }

  formatInputs.forEach((input) => input.addEventListener("change", saveFormat));
})();
