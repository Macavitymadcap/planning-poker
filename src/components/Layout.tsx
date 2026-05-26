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
      <link rel="stylesheet" href="/assets/main.css" />
      <script type="module" src="/assets/main.js" />
    </head>
    <body>
      <div className="app-frame">{children}</div>
    </body>
  </html>
);
