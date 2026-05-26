import { raw } from "hono/html";

const themeBootstrap = /* js */ `
(() => {
  const storageKey = "planning-poker-theme";

  const getStoredTheme = () => {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  };

  const getPreferredTheme = () => {
    const stored = getStoredTheme();
    if (stored === "light" || stored === "dark") return stored;

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  document.documentElement.dataset.theme = getPreferredTheme();
})();
`;

export interface LayoutProps {
  children: unknown;
  title?: string;
}

export const Layout = ({ children, title = "Planning Poker" }: LayoutProps) => (
  <html lang="en-GB">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <script>{raw(themeBootstrap)}</script>
      <link rel="stylesheet" href="/assets/main.css" />
      <script type="module" src="/assets/main.js" />
    </head>
    <body>
      <div className="app-frame">
        <header className="app-toolbar">
          <a className="brand-mark" href="/">
            Planning Poker
          </a>
          <label className="theme-toggle" htmlFor="theme-toggle">
            <span className="theme-toggle__label">Colour mode</span>
            <input
              id="theme-toggle"
              className="theme-toggle__input"
              type="checkbox"
              role="switch"
              aria-label="Colour mode"
              aria-checked="false"
              data-theme-toggle
            />
            <span className="theme-toggle__track" aria-hidden="true">
              <span className="theme-toggle__icon theme-toggle__icon--light">{"\u2600"}</span>
              <span className="theme-toggle__icon theme-toggle__icon--dark">{"\u263E"}</span>
              <span className="theme-toggle__thumb" />
            </span>
          </label>
        </header>
        {children}
      </div>
    </body>
  </html>
);
