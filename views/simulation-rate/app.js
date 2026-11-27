(() => {
  const rateElement = document.getElementById("rate");
  const settingsKey = "desktopxr.simulation-rate.config";

  function getSettings() {
    const defaults = { hideWhen1x: false, hideWhenEngineOff: true, transparency: 5 };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(settingsKey) || "{}") };
    } catch {
      return defaults;
    }
  }

  function formatRate(value) {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate <= 0) return "—";
    if (Math.abs(rate - 1) < 0.001) return "1×";

    if (rate < 1) {
      const reciprocal = 1 / rate;
      if (Math.abs(reciprocal - Math.round(reciprocal)) < 0.01) {
        return `1/${Math.round(reciprocal)}×`;
      }
    }

    const rounded = Math.round(rate);
    const displayRate = Math.abs(rate - rounded) < 0.01
      ? String(rounded)
      : rate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return `${displayRate}×`;
  }

  async function refresh() {
    try {
      const response = await fetch("/api/simulation-rate", { cache: "no-store" });
      if (!response.ok) throw new Error("Telemetry unavailable");
      const state = await response.json();
      const settings = getSettings();
      const rateIs1x = Number.isFinite(Number(state.rate)) && Math.abs(Number(state.rate) - 1) < 0.001;
      const engineIsOffOrUnknown = state.connected && state.engine_off !== false;
      const shouldHide = (settings.hideWhen1x && rateIs1x)
        || (settings.hideWhenEngineOff && engineIsOffOrUnknown);
      const transparency = Math.min(95, Math.max(5, Number(settings.transparency) || 5));
      rateElement.textContent = state.connected && state.rate !== null
        ? formatRate(state.rate)
        : "—";
      rateElement.style.opacity = shouldHide ? "0" : String(1 - transparency / 100);
      rateElement.setAttribute("aria-hidden", String(shouldHide));
    } catch {
      rateElement.textContent = "—";
      const transparency = Math.min(95, Math.max(5, Number(getSettings().transparency) || 5));
      rateElement.style.opacity = String(1 - transparency / 100);
      rateElement.setAttribute("aria-hidden", "false");
    }
  }

  refresh();
  window.setInterval(refresh, 1000);
})();
