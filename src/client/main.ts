import "@macavitymadcap/hyper-dank-ui/styles.css";
import "./styles.css";

let celebratedRoundKey: string | null = null;
const themeStorageKey = "planning-poker-theme";

const isTheme = (value: string | null | undefined): value is "light" | "dark" =>
  value === "light" || value === "dark";

const getStoredTheme = () => {
  try {
    return window.localStorage.getItem(themeStorageKey);
  } catch {
    return null;
  }
};

const storeTheme = (theme: "light" | "dark") => {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {}
};

const getPreferredTheme = (): "light" | "dark" => {
  const currentTheme = document.documentElement.dataset.theme;
  if (isTheme(currentTheme)) return currentTheme;

  const storedTheme = getStoredTheme();
  if (isTheme(storedTheme)) return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const syncThemeToggle = (theme: "light" | "dark") => {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!(toggle instanceof HTMLInputElement)) return;

  const isDark = theme === "dark";
  toggle.checked = isDark;
  toggle.setAttribute("aria-checked", String(isDark));
};

const applyTheme = (theme: "light" | "dark") => {
  document.documentElement.dataset.theme = theme;
  syncThemeToggle(theme);
};

const connectThemeToggle = () => {
  const toggle = document.querySelector("[data-theme-toggle]");
  const currentTheme = getPreferredTheme();
  applyTheme(currentTheme);

  if (!(toggle instanceof HTMLInputElement)) return;

  toggle.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    toggle.checked = !toggle.checked;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
  });

  toggle.addEventListener("change", () => {
    const nextTheme = toggle.checked ? "dark" : "light";
    storeTheme(nextTheme);
    applyTheme(nextTheme);
  });
};

const copyShareLink = async (copyAction: HTMLElement) => {
  const targetId = copyAction.dataset.copyTarget;
  if (!targetId) return;

  const input = document.getElementById(targetId);
  if (!(input instanceof HTMLInputElement)) return;

  await navigator.clipboard.writeText(input.value);
  const button = copyAction.matches(".button")
    ? copyAction
    : copyAction.querySelector<HTMLElement>(".button");
  if (!button) return;

  button.textContent = "Copied";
  setTimeout(() => {
    button.textContent = "Copy";
  }, 1600);
};

const celebrateIfNeeded = (root: ParentNode = document) => {
  const room = root.querySelector<HTMLElement>("#session-room[data-consensus='true']");
  if (!room) return;

  const roundKey = `${room.dataset.sessionCode ?? "session"}:${room.dataset.round ?? "round"}`;
  if (celebratedRoundKey === roundKey) return;
  celebratedRoundKey = roundKey;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    room.classList.add("consensus-still");
    return;
  }

  const burst = document.createElement("div");
  burst.className = "confetti-burst";
  burst.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement("span");
    piece.style.setProperty("--x", `${Math.random() * 100}%`);
    piece.style.setProperty("--hue", `${Math.floor(Math.random() * 360)}`);
    piece.style.setProperty("--delay", `${Math.random() * 0.28}s`);
    piece.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty("--drift", `${Math.random() * 56 - 28}px`);
    burst.append(piece);
  }
  document.body.append(burst);
  setTimeout(() => burst.remove(), 2600);
};

document.addEventListener("click", (event) => {
  const copyAction = (event.target as Element | null)?.closest<HTMLElement>("[data-copy-target]");
  if (copyAction) void copyShareLink(copyAction);
});

document.body.addEventListener("htmx:afterSwap", () => {
  window.requestAnimationFrame(() => celebrateIfNeeded());
});

document.body.addEventListener("htmx:sseMessage", () => {
  window.requestAnimationFrame(() => celebrateIfNeeded());
});

connectThemeToggle();
celebrateIfNeeded();
