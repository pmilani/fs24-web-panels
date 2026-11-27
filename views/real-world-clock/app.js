(() => {
  const clock = document.getElementById("clock");
  const settingsKey = "desktopxr.real-world-clock.config";

  function renderLocalTime() {
    const now = new Date();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    let hours = now.getHours();
    let suffix = "";

    try {
      const settings = JSON.parse(localStorage.getItem(settingsKey) || "{}");
      if (settings.format === "ampm") {
        suffix = hours >= 12 ? " PM" : " AM";
        hours = hours % 12 || 12;
      }
    } catch {
      // Use 24-hour format if stored settings are unavailable or invalid.
    }

    clock.textContent = `${hours}:${minutes}${suffix}`;
  }

  renderLocalTime();
  window.setInterval(renderLocalTime, 1000);
})();
