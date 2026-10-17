import { headers } from "next/headers";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { VisualConfigurator } from "../../components/visual-configurator";
import { DeveloperWorkbench } from "../../components/developer-workbench";
import { ComponentLab } from "../../components/component-lab";
import { ScenarioLab } from "../../components/scenario-lab";
import { ThemeStudio } from "../../components/theme-studio";
import { ExtensionStudio } from "../../components/extension-studio";
import { StarterStudio } from "../../components/starter-studio";
import { VersionedDocs } from "../../components/versioned-docs";

export const metadata: Metadata = {
  title: "Development Studio",
  alternates: { canonical: "/studio" },
};
export default async function StudioPage() {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader homePath="/" />
      <main id="main-content" className="studio-page" tabIndex={-1}>
        <section className="hero section-shell" id="home" tabIndex={-1}>
          <div className="hero-copy">
            <p className="eyebrow">REAL SDK · LOCAL EXPERIMENTS</p>
            <h1>Development Studio.</h1>
            <p className="hero-lede">
              Inspect real components, replay host scenarios and author
              validated themes. No arbitrary code execution or remote services.
            </p>
            <a className="text-link" href="/#playground">
              Return to your Playground design ↗
            </a>
          </div>
        </section>
        <nav
          className="section-shell studio-module-nav"
          aria-label="Studio modules"
        >
          <a href="#configurator">Configuration</a>
          <a href="#component-lab">Components</a>
          <a href="#scenario-lab">Scenarios</a>
          <a href="#theme-studio">Themes</a>
          <a href="#extension-studio">Extensions</a>
          <a href="#starter-gallery">Vanilla starters</a>
          <a href="#versioned-docs">Reference</a>
        </nav>
        <section
          className="section-shell website-section"
          id="configurator"
          tabIndex={-1}
        >
          <h2>Configuration & local Inspector</h2>
          <p>
            Explicit draft/file workflows remain separate from Playground
            autosave. The live preview follows the global theme; JSON remains an
            inspectable SDK configuration draft.
          </p>
          <VisualConfigurator />
          <DeveloperWorkbench />
        </section>
        <section
          className="section-shell website-section"
          id="component-lab"
          tabIndex={-1}
        >
          <h2>Component Lab</h2>
          <ComponentLab />
        </section>
        <section
          className="section-shell website-section"
          id="scenario-lab"
          tabIndex={-1}
        >
          <h2>Scenario Lab</h2>
          <ScenarioLab />
        </section>
        <section
          className="section-shell website-section"
          id="theme-studio"
          tabIndex={-1}
        >
          <h2>Theme Design Studio</h2>
          <p>
            Author the current global theme variant; the other variant is
            preserved independently.
          </p>
          <ThemeStudio nonce={nonce} />
        </section>
        <section
          className="section-shell website-section"
          id="extension-studio"
          tabIndex={-1}
        >
          <h2>Trusted Extension Studio</h2>
          <ExtensionStudio />
        </section>
        <section
          className="section-shell website-section"
          id="starter-gallery"
          tabIndex={-1}
        >
          <h2>Local Vanilla starter gallery</h2>
          <StarterStudio />
        </section>
        <section
          className="section-shell website-section"
          id="versioned-docs"
          tabIndex={-1}
        >
          <h2>Versioned SDK reference</h2>
          <VersionedDocs />
        </section>
        <section className="section-shell website-section">
          <h2>Beyond this MVP</h2>
          <p>
            Professional geometry, workflow/integration designers,
            untrusted-code sandboxes, share links, additional framework
            generators and interactive courses remain future capabilities.
            M10/M11 release holds are unchanged.
          </p>
          <a href="/#quick-start">Personalized Quick Start</a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
