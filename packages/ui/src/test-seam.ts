import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "@typescript/typescript6";

// ponytail: parses with the TypeScript compiler, so comments, strings, and
// template literals stop being a problem by construction. Ceiling: it still
// can't see a class assembled inside an imported function, or one arriving
// through a prop at runtime.
const HEX_LITERAL = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;

// `<utility>-[<value>]` has no trailing colon; an arbitrary variant like
// `data-[state=open]:` does — that colon is what tells the two apart.
const ARBITRARY_VALUE = /[\w-]+-\[[^\]\s]*\](?!:)/;

// Arbitrary *properties* have no utility prefix and no regex tracks bracket
// nesting, so this scans each `[...]` to its matching close: `:` right after
// the close is a variant (ignore); `:` inside the unnested content is a property (flag).
function hasArbitraryProperty(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[") continue;
    let depth = 1;
    let topLevelColon = false;
    let j = i + 1;
    for (; j < text.length && depth > 0; j++) {
      if (text[j] === "[") depth++;
      else if (text[j] === "]") depth--;
      else if (text[j] === ":" && depth === 1) topLevelColon = true;
    }
    if (depth !== 0) continue; // unmatched bracket — not our concern here
    if (text[j] !== ":" && topLevelColon) return true;
    i = j - 1;
  }
  return false;
}

function hasRawValue(content: string): boolean {
  return (
    HEX_LITERAL.test(content) || ARBITRARY_VALUE.test(content) || hasArbitraryProperty(content)
  );
}

const EXEMPT_COMMENT = /^\s*\/\/\s*design-exempt:\s*(.+)$/;

function isExempt(precedingLine: string | undefined): boolean {
  if (precedingLine === undefined) return false;
  const match = EXEMPT_COMMENT.exec(precedingLine);
  if (!match) return false;
  return match[1].trim().split(/\s+/).filter(Boolean).length >= 4;
}

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

interface Classification {
  rawValue: boolean;
  assembled: boolean;
}

function stringLiteralClassification(text: string): Classification {
  return { rawValue: hasRawValue(text), assembled: false };
}

function unwrapParens(node: ts.Expression): ts.Expression {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

// One argument to a `cn(...)` call: a string literal, the `className` prop,
// `cond && "literal"`, `cond ? a : b` where both branches are themselves
// valid arguments, or a call to a name bound to `cva(...)` or ending in
// `Variants`. Anything else is assembled.
function classifyCnArg(
  arg: ts.Expression,
  isVariantsCall: (call: ts.CallExpression) => boolean,
): Classification {
  const node = unwrapParens(arg);

  if (ts.isStringLiteral(node)) return stringLiteralClassification(node.text);
  if (ts.isIdentifier(node) && node.text === "className") {
    return { rawValue: false, assembled: false };
  }

  if (ts.isConditionalExpression(node)) {
    const trueResult = classifyCnArg(node.whenTrue, isVariantsCall);
    const falseResult = classifyCnArg(node.whenFalse, isVariantsCall);
    if (!trueResult.assembled && !falseResult.assembled) {
      return { rawValue: trueResult.rawValue || falseResult.rawValue, assembled: false };
    }
    return { rawValue: false, assembled: true };
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return classifyCnArg(node.right, isVariantsCall);
  }

  if (ts.isCallExpression(node) && isVariantsCall(node)) {
    return { rawValue: false, assembled: false };
  }

  return { rawValue: false, assembled: true };
}

// The full `className` value: a string literal, or a `cn(...)` call whose
// every argument is valid per `classifyCnArg`. Anything else — a bare
// identifier, a template literal, a concatenation, a lookup — is banned.
function classifyValue(
  value: ts.Expression | undefined,
  isVariantsCall: (call: ts.CallExpression) => boolean,
): Classification {
  if (value === undefined) return { rawValue: false, assembled: true };
  const node = unwrapParens(value);

  if (ts.isStringLiteral(node)) return stringLiteralClassification(node.text);

  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "cn"
  ) {
    let rawValue = false;
    let assembled = false;
    // Every argument must be scanned — do not short-circuit, or a later
    // argument's raw value or assembly is silently skipped.
    for (const arg of node.arguments) {
      const result = classifyCnArg(arg, isVariantsCall);
      rawValue = rawValue || result.rawValue;
      assembled = assembled || result.assembled;
    }
    return { rawValue, assembled };
  }

  return { rawValue: false, assembled: true };
}

interface Offenders {
  rawValue: string[];
  assembled: string[];
}

function scanFile(filePath: string, offenders: Offenders): void {
  const source = readFileSync(filePath, "utf8");
  const lines = source.split("\n");
  const kind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, false, kind);

  // createSourceFile recovers from syntax errors rather than throwing, which
  // would otherwise yield a partial tree and a silent false negative.
  const parseErrors =
    (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (parseErrors.length > 0) {
    throw new Error(`${filePath}: cannot parse — ${parseErrors.length} syntax error(s)`);
  }

  const cva = new Set<string>();
  const imported = new Set<string>();
  const otherLocal = new Set<string>();

  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      const init = node.initializer;
      if (
        init &&
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        init.expression.text === "cva"
      ) {
        cva.add(name);
      } else {
        otherLocal.add(name);
      }
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      otherLocal.add(node.name.text);
    } else if (ts.isClassDeclaration(node) && node.name) {
      otherLocal.add(node.name.text);
    } else if (ts.isImportDeclaration(node) && node.importClause) {
      const clause = node.importClause;
      if (clause.name) imported.add(clause.name.text);
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const spec of clause.namedBindings.elements) imported.add(spec.name.text);
      }
    }
    ts.forEachChild(node, collect);
  };
  ts.forEachChild(sf, collect);

  function isVariantsCall(call: ts.CallExpression): boolean {
    if (!ts.isIdentifier(call.expression)) return false;
    const name = call.expression.text;
    if (cva.has(name)) return true;
    return name.endsWith("Variants") && imported.has(name) && !otherLocal.has(name);
  }

  function handle(name: string, value: ts.Expression | undefined, node: ts.Node): void {
    if (name !== "className" && name !== "style") return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    if (isExempt(lines[line - 2])) return;

    if (name === "style") {
      offenders.rawValue.push(`${filePath}:${line}`);
      return;
    }

    const { rawValue, assembled } = classifyValue(value, isVariantsCall);
    if (rawValue) offenders.rawValue.push(`${filePath}:${line}`);
    if (assembled) offenders.assembled.push(`${filePath}:${line}`);
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const init = node.initializer;
      const value =
        init === undefined ? undefined : ts.isJsxExpression(init) ? init.expression : init; // a plain string-literal attribute value
      handle(node.name.text, value, node);
    } else if (ts.isJsxSpreadAttribute(node) && ts.isObjectLiteralExpression(node.expression)) {
      for (const prop of node.expression.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        if (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name)) continue;
        handle(prop.name.text, prop.initializer, prop);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
}

// Raw design value + className-assembly + inline-style guard. rule 6 in
// docs/agents/code-standards.md; .scratch/foundation/issues/12. Escape
// hatch: `// design-exempt: <reason>` (4+ words), line above the offender.
export function assertNoRawDesignValues(dir: string): void {
  const offenders: Offenders = { rawValue: [], assembled: [] };

  for (const filePath of collectFiles(dir).filter(
    (path) => /\.tsx?$/.test(path) && !path.includes("/generated/"),
  )) {
    scanFile(filePath, offenders);
  }

  const messages: string[] = [];
  if (offenders.rawValue.length > 0) {
    messages.push(`Raw design values found in:\n${offenders.rawValue.join("\n")}`);
  }
  if (offenders.assembled.length > 0) {
    messages.push(
      `className assembled outside the attribute (use a component variant, or ` +
        `cn(...) with literal/className/cond && "literal"/cond ? a : b/cva arguments — code-standards.md rule 6) in:\n${offenders.assembled.join("\n")}`,
    );
  }
  if (messages.length > 0) throw new Error(messages.join("\n\n"));
}
