import videoCrunchFiles from "../../../../tools/videocrunch.files.json" with { type: "json" };

export interface ToolDefinition {
  readonly slug: string;
  readonly title: string;
  readonly category: string;
  readonly monogram: string;
  readonly version: string;
  readonly releaseDate: string | null;
  readonly updatedOn: string;
  readonly summary: string;
  readonly description: string;
  readonly useCases: readonly string[];
  readonly setup: readonly {
    readonly title: string;
    readonly text: string;
    readonly command?: string;
  }[];
  readonly workspace?: "toolbar" | "videocrunch";
  readonly source?: {
    readonly bundle: string;
    readonly files: readonly string[];
  };
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    slug: "toolbar",
    title: "Moorkyz Toolbar",
    category: "INTERFACE TOOLKIT",
    monogram: "tb",
    version: "0.1.0 development preview",
    releaseDate: null,
    updatedOn: "2026-10-23",
    summary:
      "One adaptive toolbar for your interface. Design, preview and export a dock that feels at home.",
    description:
      "A framework-neutral, accessible toolbar SDK with optional adapters and a working design playground. Explore four local applications, ten structural styles, manual themes and host-owned commands. The SDK is a development preview, not a published stable release.",
    useCases: [
      "Build consistent navigation and contextual actions across web applications.",
      "Prototype accessible docks with keyboard support and reduced motion.",
      "Validate themes, replay scenarios and export a Vanilla starter locally.",
    ],
    setup: [
      {
        title: "Prepare the workspace",
        text: "Use the repository's pinned pnpm version and install its locked development dependencies.",
        command: "pnpm install --frozen-lockfile",
      },
      {
        title: "Start the portal",
        text: "Open the local address printed by Next.js. No account or external demo service is required.",
        command: "pnpm --filter @moorkyz/portal dev",
      },
      {
        title: "Design and export",
        text: "Open the Playground below. Follow its personalized quick start for a local SDK path; the package is not yet published.",
      },
    ],
    workspace: "toolbar",
  },
  {
    slug: "videocrunch",
    title: "VideoCrunch",
    category: "VIDEO WORKSPACE",
    monogram: "vc",
    version: "1.0.0 local preview",
    releaseDate: null,
    updatedOn: "2026-10-23",
    summary:
      "Save authorized videos, keep the original and create a smaller MP4 for offline playback.",
    description:
      "A Windows-first local web service for downloading and compressing videos you own or have permission to save. The complete original app, PowerShell exporter, launchers, tests and guides live in this repository. Original bytes are preserved alongside optional MP4 derivatives, an offline player and an integrity manifest. Public hosting, accounts and multi-user processing are off.",
    useCases: [
      "Keep authorized source videos and watch them offline.",
      "Create smaller playback copies with Balanced, Crunch or Extreme compression.",
      "Download just the original, inspect live logs and revisit the last 50 local exports.",
    ],
    setup: [
      {
        title: "Prepare Windows prerequisites",
        text: "Requires Node.js 22+, Windows PowerShell 5.1, yt-dlp and FFmpeg. The original launcher checks prerequisites and uses winget to install missing tools when you explicitly run it; installation may require approval and internet access.",
        command: ".\\tools\\videocrunch\\Start-WebVideoCrunch.cmd",
      },
      {
        title: "Start the local service",
        text: "If prerequisites are already available, use this instead of the launcher. Keep its terminal open. The service binds only to 127.0.0.1:8765.",
        command: "pnpm tool:videocrunch",
      },
      {
        title: "Enable the portal connection",
        text: "In a second PowerShell terminal, opt in and start the portal on loopback. The connection is disabled by default and never starts or installs the service itself.",
        command:
          '$env:MOORKYZ_VIDEOCRUNCH_ENABLED = "1"\npnpm --filter @moorkyz/portal dev --hostname 127.0.0.1',
      },
      {
        title: "Open your workspace",
        text: "Use the button below after both services are ready. Exports and history stay on this PC. Do not expose either service through a public address or reverse proxy. No DRM, login or paywall bypass is provided.",
      },
    ],
    workspace: "videocrunch",
    source: { bundle: "videocrunch", files: videoCrunchFiles },
  },
];

export function findTool(slug: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function formatToolDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
