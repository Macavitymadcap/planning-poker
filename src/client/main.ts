import "htmx.org";
import "@macavitymadcap/hyper-dank-ui/styles.css";
import "./styles.css";

let celebratedRoundKey: string | null = null;

const copyShareLink = async (button: HTMLButtonElement) => {
  const targetId = button.dataset.copyTarget;
  if (!targetId) return;

  const input = document.getElementById(targetId);
  if (!(input instanceof HTMLInputElement)) return;

  await navigator.clipboard.writeText(input.value);
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
    piece.style.setProperty("--delay", `${Math.random() * 0.28}s`);
    piece.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
    burst.append(piece);
  }
  document.body.append(burst);
  setTimeout(() => burst.remove(), 2600);
};

const connectSessionEvents = () => {
  const shell = document.querySelector<HTMLElement>("[data-session-code]");
  const sessionCode = shell?.dataset.sessionCode;
  if (!sessionCode) return;

  const source = new EventSource(`/sessions/${sessionCode}/events`);
  source.addEventListener("session", (event) => {
    const room = document.getElementById("session-room");
    if (!room) return;
    room.outerHTML = (event as MessageEvent<string>).data;
    window.requestAnimationFrame(() => celebrateIfNeeded());
  });
};

document.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-copy-target]");
  if (button) void copyShareLink(button);
});

document.body.addEventListener("htmx:afterSwap", () => {
  window.requestAnimationFrame(() => celebrateIfNeeded());
});

connectSessionEvents();
celebrateIfNeeded();
