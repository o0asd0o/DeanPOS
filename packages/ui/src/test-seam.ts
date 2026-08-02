import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ponytail: this is a regex over source text, not a CSS parser or a runtime
// check. It cannot see a colour assembled dynamically (`` `#${r}${g}${b}` ``)
// or a value arriving through a prop. It catches the mistake that will
// actually happen — a raw hex or an arbitrary Tailwind value typed into a
// className — not a proof of token purity.
const HEX_LITERAL = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;

// Tailwind arbitrary-value syntax is `<utility>-[<value>]` with no trailing
// colon. An arbitrary variant/selector is `[<selector>]:` (or
// `<prefix>-[<selector>]:`, e.g. `data-[state=open]:`) — the colon right
// after the bracket is what tells the two apart.
const ARBITRARY_VALUE = /[\w-]+-\[[^\]\s]*\](?!:)/;

const INLINE_STYLE = /style=\{\{/;

const EXEMPT_COMMENT = /^\s*\/\/\s*design-exempt:\s*(.+)$/;

function isExempt(precedingLine: string | undefined): boolean {
  if (precedingLine === undefined) return false;
  const match = EXEMPT_COMMENT.exec(precedingLine);
  if (!match) return false;
  return match[1].trim().split(/\s+/).filter(Boolean).length >= 4;
}

function violatesLine(line: string): boolean {
  return INLINE_STYLE.test(line) || HEX_LITERAL.test(line) || ARBITRARY_VALUE.test(line);
}

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

// Raw design value guard for application code. docs/agents/code-standards.md
// rule 6; .scratch/foundation/issues/12. Escape hatch: `// design-exempt:
// <reason>` (4+ words) on the line immediately above the offending line.
export function assertNoRawDesignValues(dir: string): void {
  const offenders: string[] = [];

  for (const filePath of collectFiles(dir).filter((path) => /\.tsx?$/.test(path))) {
    const lines = readFileSync(filePath, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!violatesLine(line)) return;
      if (isExempt(lines[index - 1])) return;
      offenders.push(`${filePath}:${index + 1}`);
    });
  }

  if (offenders.length > 0) {
    throw new Error(`Raw design values found in:\n${offenders.join("\n")}`);
  }
}
