import { Logo } from "@/components/Logo";
import { FolderTree, KeyRound, Link2 } from "lucide-react";

interface AuthShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const FEATURES = [
  { icon: FolderTree, text: "Projects and folders keep files organized" },
  { icon: KeyRound, text: "A separate API key for every project" },
  { icon: Link2, text: "Public links or key-protected private files" },
];

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Product panel: stays dark in both themes */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#101418] p-10 text-white lg:flex xl:p-14 dark:border-r">
        <Logo className="[&_span]:text-white" />

        <div className="max-w-md">
          <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.025em]">
            Your files, on your own server.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/65">
            Upload from any app with a single request and get back a link you can serve right away.
          </p>

          <div className="mt-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-3.5 py-2.5">
              <span className="h-2 w-2 rounded-full bg-white/15" />
              <span className="h-2 w-2 rounded-full bg-white/15" />
              <span className="h-2 w-2 rounded-full bg-white/15" />
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-[1.7] text-white/80">
              <code>
                <span className="text-white/40">$ </span>curl -X POST $FILERUNNER_URL/api/upload \{"\n"}
                {"    "}-H <span className="text-[#7fd4da]">&quot;X-API-Key: $KEY&quot;</span> \{"\n"}
                {"    "}-F <span className="text-[#7fd4da]">&quot;file=@avatar.png&quot;</span>
                {"\n\n"}
                <span className="text-white/45">
                  {"{"} &quot;original_name&quot;: &quot;avatar.png&quot;,{"\n"}
                  {"  "}&quot;download_url&quot;: &quot;/api/files/…&quot; {"}"}
                </span>
              </code>
            </pre>
          </div>
        </div>

        <ul className="space-y-3">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-white/70">
              <Icon className="h-4 w-4 text-[#7fd4da]" />
              {text}
            </li>
          ))}
        </ul>
      </aside>

      {/* Form */}
      <main className="flex flex-col bg-card px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 text-sm text-muted-foreground">{footer}</div>
        </div>
      </main>
    </div>
  );
}
