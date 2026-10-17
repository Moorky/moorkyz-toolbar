import { headers } from "next/headers";
import { FunctionalPlayground } from "../components/functional-playground";
import { SiteHeader } from "../components/site-header";
import {
  ArchitectureExplorer,
  CapabilityExplorer,
  StudioShowcase,
} from "../components/website-explorers";
import { VersionedDocs } from "../components/versioned-docs";
import { SiteFooter } from "../components/site-footer";

const repository = "https://github.com/Moorky/moorkyz-toolbar";

export default async function HomePage() {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="hero section-shell" id="home" tabIndex={-1}>
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" aria-hidden="true" />
              OPEN SOURCE · DEVELOPMENT PREVIEW
            </p>
            <h1>One toolbar. Every interface.</h1>
            <p className="hero-lede">
              A customizable, adaptive toolbar for modern web applications.
              Built to fit your interface, not the other way around.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#playground">
                Try the Playground <span aria-hidden="true">↓</span>
              </a>
              <a className="button button-secondary" href={repository}>
                View on GitHub <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="draft-note">
              SDK 0.1.0 preview · no account, tracking or external demo services
              · not yet published
            </p>
          </div>
        </section>
        <FunctionalPlayground nonce={nonce} />
        <section
          className="section-shell website-section"
          id="environments"
          tabIndex={-1}
          aria-labelledby="capabilities-heading"
        >
          <div className="compact-section-heading">
            <p className="eyebrow">CAPABILITY EXPLORER</p>
            <h2 id="capabilities-heading">Less ceremony. More control.</h2>
            <p>
              One shared demonstration area. Every live example uses the actual
              SDK; links open the corresponding working tool.
            </p>
          </div>
          <span id="themes" tabIndex={-1} />
          <CapabilityExplorer nonce={nonce} />
        </section>
        <section
          className="section-shell website-section"
          id="studio"
          tabIndex={-1}
          aria-labelledby="studio-heading"
        >
          <div className="compact-section-heading">
            <p className="eyebrow">DEVELOPMENT STUDIO</p>
            <h2 id="studio-heading">A little deeper, when you need it.</h2>
          </div>
          <StudioShowcase />
        </section>
        <section
          className="section-shell website-section"
          id="docs"
          tabIndex={-1}
          aria-labelledby="docs-heading"
        >
          <div className="compact-section-heading">
            <p className="eyebrow">DOCUMENTATION & LEARNING</p>
            <h2 id="docs-heading">A clear path from first mount.</h2>
            <p>
              Current preview contracts, real feature defaults and tested
              consumer recipes. There is no stable release to select yet.
            </p>
          </div>
          <div className="docs-entry-links">
            <a href="#quick-start">Getting started</a>
            <a href={`${repository}/tree/master/examples`}>
              Framework fixtures
            </a>
            <a
              href={`${repository}/blob/master/docs/contracts/sdk-and-schema.md`}
            >
              API & schema
            </a>
            <a
              href={`${repository}/blob/master/docs/design/interaction-and-visual-system.md`}
            >
              Customization & accessibility
            </a>
            <a
              href={`${repository}/blob/master/docs/architecture/security-and-trust.md`}
            >
              Security
            </a>
            <a
              href={`${repository}/blob/master/docs/engineering/open-validations.md`}
            >
              Troubleshooting & limitations
            </a>
          </div>
          <div id="versioned-docs">
            <VersionedDocs />
          </div>
          <p className="section-footnote">
            Interactive courses, historical stable-version documentation and
            additional framework generators are future capabilities, not hidden
            features.
          </p>
        </section>
        <section
          className="section-shell website-section"
          id="engineering"
          tabIndex={-1}
          aria-labelledby="architecture-heading"
        >
          <div className="compact-section-heading">
            <p className="eyebrow">ARCHITECTURE & ENGINEERING</p>
            <h2 id="architecture-heading">Small core. Explicit boundaries.</h2>
            <p>
              Explore the implementation that powers this page. One
              published-package design, optional subpaths and host-owned
              authority.
            </p>
          </div>
          <ArchitectureExplorer />
          <p className="section-footnote">
            M10/M11 remain on hold for manual device/assistive-technology
            acceptance, approved performance/platform scope, distribution and
            independent review, container evidence and explicit release
            authorization.{" "}
            <a
              href={`${repository}/blob/master/docs/engineering/release-readiness.md`}
            >
              Read the release dossier.
            </a>
          </p>
        </section>
        <section
          className="section-shell website-section minimal-open-source"
          id="open-source"
          tabIndex={-1}
        >
          <div>
            <p className="eyebrow">OPEN SOURCE · APACHE-2.0</p>
            <h2>Built in the open. Released with care.</h2>
            <p>
              Moorkyz Toolbar is an independent, local-first SDK and developer
              website. No fabricated metrics, accounts or community promises.
            </p>
          </div>
          <nav aria-label="Open source resources">
            <a href={repository}>GitHub repository ↗</a>
            <a href={`${repository}/blob/master/LICENSE`}>
              Apache-2.0 license ↗
            </a>
            <a href="/contributing">Contribution guidelines ↗</a>
            <a href="#docs">Documentation</a>
          </nav>
        </section>
        <section
          className="section-shell website-section final-cta"
          id="finish"
          tabIndex={-1}
        >
          <p className="eyebrow">YOUR NEXT STEP</p>
          <h2>Make it belong to your interface.</h2>
          <p>Your saved design stays with you as you explore.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#playground">
              Design a Toolbar
            </a>
            <a className="button button-secondary" href="#quick-start">
              Start Building
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
