export function SiteFooter() {
  return (
    <footer className="website-footer">
      <div className="footer-upper">
        <a className="footer-brand" href="/#home">
          moorkyz toolbar
        </a>
        <nav aria-label="Footer navigation">
          <a href="/#playground">Playground</a>
          <a href="/studio">Studio</a>
          <a href="/#docs">Documentation</a>
          <a
            href="https://evidence.moorkyz.com"
            target="_blank"
            rel="noreferrer"
          >
            Evidence workspace
          </a>
          <a href="https://github.com/Moorky/moorkyz-toolbar">GitHub</a>
        </nav>
      </div>
      <div className="footer-lower">
        <span>© {new Date().getUTCFullYear()} Moorkyz</span>
        <a href="https://github.com/Moorky/moorkyz-toolbar/blob/master/LICENSE">
          Apache-2.0
        </a>
        <a href="https://moorkyz.com">powered by Moorkyz</a>
      </div>
    </footer>
  );
}
