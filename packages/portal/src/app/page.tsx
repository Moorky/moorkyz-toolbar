import { CopyButton } from "../components/copy-button";
import { ComponentLab } from "../components/component-lab";
import { EnvironmentExplorer } from "../components/environment-explorer";
import { ThemeToggle } from "../components/portal-shell";
import { VisualConfigurator } from "../components/visual-configurator";

const repository = "https://github.com/Moorky/moorkyz-toolbar";
const installCommand = "pnpm add @moorkyz/toolbar";
const integrationExample = `import { createToolbar } from "@moorkyz/toolbar";

const toolbar = createToolbar(
  {
    actions: [{ id: "docs", label: "Documentation" }],
  },
  {
    dispatchAction: (id) => {
      document.getElementById(id)?.scrollIntoView();
    },
  },
);

const mounted = toolbar.mount(document.body);
if (!mounted.ok) {
  throw new Error(mounted.error.message);
}

window.addEventListener("pagehide", () => toolbar.dispose(), { once: true });`;

const studioCapabilities = [
  ["Visual configuration", "Available preview"],
  ["Component Lab", "Available preview"],
  ["Scenario Lab", "Planned"],
  ["Theme and extension studios", "Planned"],
  ["Code and starter generation", "Planned"],
];

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#home">
          <span className="brand-mark" aria-hidden="true">
            m
          </span>
          <span>
            <strong>moorkyz</strong>
            <span className="brand-product">toolbar</span>
          </span>
        </a>
        <nav className="header-links" aria-label="Main navigation">
          <a href="#docs">Documentation</a>
          <a href="#configurator">Configurator</a>
          <a href={repository} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <ThemeToggle />
        </nav>
      </header>

      <main id="main-content">
        <section className="hero section-shell" id="home" tabIndex={-1}>
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" aria-hidden="true" />
              OPEN SOURCE · DEVELOPMENT PREVIEW
            </p>
            <h1>
              One toolbar.
              <br />
              <span>Every interface.</span>
            </h1>
            <p className="hero-lede">
              A lightweight, framework-independent toolbar for modern web apps.
              Start simple; adapt as you grow.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#quick-start">
                Get started <span aria-hidden="true">↗</span>
              </a>
              <a className="button button-secondary" href="#environments">
                Explore the live dock <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="draft-note">
              The package is in active development and is not yet published.
            </p>
          </div>
          <div className="hero-note" aria-label="Product principles">
            <span className="note-index">01 / 03</span>
            <div className="hero-note-rule" />
            <p>Easy to start.</p>
            <p>Easy to use.</p>
            <p className="note-emphasis">Powerful to master.</p>
            <span className="hero-note-caption">
              The dock at the bottom is the actual workspace library.
            </span>
          </div>
        </section>

        <section
          className="section-shell environment-section"
          id="environments"
          tabIndex={-1}
        >
          <div className="section-heading">
            <p className="eyebrow">A TOOLBAR THAT FITS YOUR PRODUCT</p>
            <h2>
              Keep the anchors.
              <br />
              Change the context.
            </h2>
            <p>
              Choose a page context to update the real dock. This demo uses the
              SDK&apos;s current action configuration and host dispatch APIs—not
              a visual stand-in.
            </p>
          </div>
          <EnvironmentExplorer />
          <p className="section-footnote">
            Context changes are deliberate. The dock won&apos;t change just
            because you scrolled into another section.
          </p>
        </section>

        <section
          className="section-shell configurator-section"
          id="configurator"
          tabIndex={-1}
        >
          <div className="section-heading">
            <p className="eyebrow">VISUAL CONFIGURATOR · LOCAL PREVIEW</p>
            <h2>
              Tune the draft.
              <br />
              Keep every action explicit.
            </h2>
            <p>
              Edit supported configuration fields, validate against the package
              schema, and apply a real toolbar preview. Drafts stay in memory
              and are never uploaded or saved.
            </p>
          </div>
          <VisualConfigurator />
        </section>

        <section
          className="section-shell component-lab-section"
          id="component-lab"
          tabIndex={-1}
        >
          <div className="section-heading">
            <p className="eyebrow">COMPONENT LAB · REAL SDK STATES</p>
            <h2>
              Try the controls.
              <br />
              See the state change.
            </h2>
            <p>
              Switch between repeatable component scenarios, test native
              overflow controls, open local search, or collapse the live
              toolbar. Every preview uses the workspace library.
            </p>
          </div>
          <ComponentLab />
        </section>

        <section
          className="section-shell quickstart-section"
          id="quick-start"
          tabIndex={-1}
        >
          <div className="quickstart-intro">
            <p className="eyebrow">A SMALL, EXPLICIT START</p>
            <h2>
              Start with actions.
              <br />
              Keep your app in charge.
            </h2>
            <p>
              The host handles navigation and decides what each action is
              allowed to do. The toolbar provides accessible controls and
              dispatches the action ID.
            </p>
            <a
              className="text-link"
              href={`${repository}/blob/master/docs/contracts/sdk-and-schema.md`}
              target="_blank"
              rel="noreferrer"
            >
              Read the current contract draft <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="code-panel">
            <div className="code-panel-header">
              <div>
                <span className="code-language">TYPESCRIPT</span>
                <span className="code-filename">toolbar.ts</span>
              </div>
              <CopyButton text={integrationExample} />
            </div>
            <pre aria-label="TypeScript integration example" tabIndex={0}>
              <code>{integrationExample}</code>
            </pre>
            <div className="install-row">
              <code>{installCommand}</code>
              <CopyButton text={installCommand} label="Copy install command" />
            </div>
            <p className="code-disclaimer">
              Install command shown for the planned public release. Until then,
              use the repository&apos;s workspace consumer examples.
            </p>
          </div>
        </section>

        <section
          className="section-shell engineering-section"
          id="engineering"
          tabIndex={-1}
        >
          <div className="engineering-heading">
            <p className="eyebrow">BUILT AROUND CONTROL</p>
            <h2>
              Useful by default.
              <br />
              No hidden authority.
            </h2>
          </div>
          <div className="principle-list">
            <article className="principle-row">
              <span className="principle-number">01</span>
              <h3>Framework independent</h3>
              <p>
                A TypeScript package with no React or Next.js runtime
                dependency. This portal is a separate consumer.
              </p>
            </article>
            <article className="principle-row">
              <span className="principle-number">02</span>
              <h3>Host-controlled actions</h3>
              <p>
                The SDK dispatches an action ID; your application retains
                navigation, data access, and permission authority.
              </p>
            </article>
            <article className="principle-row">
              <span className="principle-number">03</span>
              <h3>Accessible foundations</h3>
              <p>
                Semantic toolbar controls, keyboard navigation, visible focus,
                manual collapse, and reduced-motion styling are in the current
                implementation.
              </p>
            </article>
            <article className="principle-row">
              <span className="principle-number">04</span>
              <h3>Optional work stays optional</h3>
              <p>
                Search and spatial coordination are not activated by this
                preview. There are no analytics or remote service calls.
              </p>
            </article>
          </div>
          <a
            className="text-link engineering-link"
            href={`${repository}/blob/master/docs/architecture/security-and-trust.md`}
            target="_blank"
            rel="noreferrer"
          >
            Read the security and trust model <span aria-hidden="true">↗</span>
          </a>
        </section>

        <section
          className="section-shell theme-section"
          id="themes"
          tabIndex={-1}
        >
          <div className="theme-copy">
            <p className="eyebrow">YOUR CANVAS, YOUR PREFERENCE</p>
            <h2>
              Light by default.
              <br />
              Dark when you want it.
            </h2>
            <p>
              Switch the portal between light and dark. The dock is the same
              library instance, mounted in its supported light-DOM mode so its
              presentation follows this site.
            </p>
            <p className="section-footnote">
              Runtime theme tokens and the named theme families are planned;
              they are not part of the current SDK.
            </p>
          </div>
          <div className="theme-sample" aria-hidden="true">
            <div className="sample-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="sample-line sample-line-short" />
            <div className="sample-line" />
            <div className="sample-block">
              <span />
              <span />
            </div>
            <div className="sample-caption">
              <span>PORTAL APPEARANCE</span>
              <strong>Quiet by design.</strong>
            </div>
          </div>
        </section>

        <section
          className="section-shell studio-section"
          id="studio"
          tabIndex={-1}
        >
          <div className="studio-copy">
            <p className="eyebrow">DEVELOPMENT STUDIO</p>
            <h2>
              A deeper workspace
              <br />
              is on the roadmap.
            </h2>
            <p>
              A schema-validated configurator and a small component lab are
              available below. The full Studio will add broader scenarios,
              themes, and starter generation; those tools remain on the roadmap.
            </p>
            <a
              className="button button-primary"
              href={`${repository}/blob/master/docs/engineering/roadmap.md`}
              target="_blank"
              rel="noreferrer"
            >
              View development roadmap <span aria-hidden="true">↗</span>
            </a>
            <a className="text-link" href="#configurator">
              Try the local configurator <span aria-hidden="true">↓</span>
            </a>
            <a className="text-link" href="#component-lab">
              Explore the Component Lab <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="studio-status">
            <div className="studio-status-head">
              <span>STUDIO MODULES</span>
              <span className="status-pill">IN PROGRESS</span>
            </div>
            <ul>
              {studioCapabilities.map(([capability, status]) => (
                <li key={capability}>
                  <span>{capability}</span>
                  <span>{status}</span>
                </li>
              ))}
            </ul>
            <p>
              The configurator previews the real workspace package. Edits are
              not persisted or sent to a server.
            </p>
          </div>
        </section>

        <section className="section-shell docs-section" id="docs" tabIndex={-1}>
          <div className="section-heading">
            <p className="eyebrow">FOLLOW THE WORK</p>
            <h2>Documentation that tells you what exists.</h2>
            <p>
              The public contracts are still drafts. Browse the source of truth
              and follow implementation as the SDK takes shape.
            </p>
          </div>
          <div className="doc-links">
            <a
              href={`${repository}/blob/master/docs/contracts/sdk-and-schema.md`}
              target="_blank"
              rel="noreferrer"
            >
              <span>01</span>
              <strong>SDK and schema draft</strong>
              <span aria-hidden="true">↗</span>
            </a>
            <a
              href={`${repository}/blob/master/docs/architecture/product-and-system.md`}
              target="_blank"
              rel="noreferrer"
            >
              <span>02</span>
              <strong>Product architecture</strong>
              <span aria-hidden="true">↗</span>
            </a>
            <a
              href={`${repository}/blob/master/docs/engineering/implementation-status.md`}
              target="_blank"
              rel="noreferrer"
            >
              <span>03</span>
              <strong>Implementation status</strong>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <section
          className="section-shell open-source-section"
          id="open-source"
          tabIndex={-1}
        >
          <div>
            <p className="eyebrow">OPEN SOURCE · APACHE-2.0</p>
            <h2>
              Built in the open.
              <br />
              Released with care.
            </h2>
          </div>
          <div className="open-source-copy">
            <p>
              The code and development decisions are public. This repository is
              a work in progress; no package or website release is implied.
            </p>
            <div className="open-source-links">
              <a href={repository} target="_blank" rel="noreferrer">
                Repository ↗
              </a>
              <a
                href={`${repository}/blob/master/LICENSE`}
                target="_blank"
                rel="noreferrer"
              >
                Apache-2.0 license ↗
              </a>
              <a href={`${repository}/issues`} target="_blank" rel="noreferrer">
                Issues and discussion ↗
              </a>
            </div>
          </div>
        </section>

        <section
          className="section-shell final-section"
          id="finish"
          tabIndex={-1}
        >
          <p className="eyebrow">MOORKYZ TOOLBAR</p>
          <h2>
            Make your interface
            <br />
            more capable.
          </h2>
          <p>Start with a toolbar. Build an experience.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#quick-start">
              Explore the SDK <span aria-hidden="true">↑</span>
            </a>
            <a
              className="button button-secondary"
              href={repository}
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="footer-brand" href="#home">
          moorkyz toolbar
        </a>
        <span>Easy to start. Easy to use. Powerful to master.</span>
        <a
          href={`${repository}/blob/master/LICENSE`}
          target="_blank"
          rel="noreferrer"
        >
          Apache-2.0
        </a>
      </footer>
    </>
  );
}
