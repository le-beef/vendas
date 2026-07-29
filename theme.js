(() => {
  const STORAGE_KEY = "le-beef-theme";
  const root = document.documentElement;
  const button = document.getElementById("themeToggleButton");
  const icon = document.getElementById("themeToggleIcon");
  const label = document.getElementById("themeToggleLabel");
  const themeColor = document.querySelector('meta[name="theme-color"]');

  if (!button || !icon || !label) return;

  function applyTheme(theme, save = false) {
    const dark = theme === "dark";
    root.dataset.theme = dark ? "dark" : "light";
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", dark ? "Ativar modo claro" : "Ativar modo noturno");
    button.title = dark ? "Ativar modo claro" : "Ativar modo noturno";
    icon.textContent = dark ? "☀" : "☾";
    label.textContent = dark ? "Modo claro" : "Modo noturno";
    if (themeColor) themeColor.content = dark ? "#0b1220" : "#14213d";
    if (save) localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }

  applyTheme(root.dataset.theme === "dark" ? "dark" : "light");
  button.addEventListener("click", () => {
    applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
  });
})();
