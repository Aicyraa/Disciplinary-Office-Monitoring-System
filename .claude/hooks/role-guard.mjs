#!/usr/bin/env node
// PreToolUse role guard for the parallel dev team (see CLAUDE.md, "Parallel dev team").
// Reads the hook JSON on stdin. Exit 0 = no objection, exit 2 = block (stderr goes to the agent).
// Inside a team role it fails closed: any error blocks the call.
import { readFileSync, realpathSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEAM_ROLES = ['lead', 'scout', 'dev', 'reviewer', 'integrator'];
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
const SERENA_EDIT_TOOLS = [
  'mcp__serena__replace_symbol_body',
  'mcp__serena__insert_after_symbol',
  'mcp__serena__insert_before_symbol',
  'mcp__serena__rename_symbol',
  'mcp__serena__safe_delete_symbol',
];
const TEST_MODE = process.env.ROLE_GUARD_TEST === '1';

function block(message) {
  process.stderr.write(`role-guard: ${message}\n`);
  process.exit(2);
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function currentBranch(cwd) {
  // The override exists only so the guard can be tested; it is ignored unless ROLE_GUARD_TEST=1.
  if (TEST_MODE && typeof process.env.ROLE_GUARD_BRANCH === 'string') return process.env.ROLE_GUARD_BRANCH;
  return git(cwd, ['branch', '--show-current']);
}

function globToRegExp(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        source += '(?:.*/)?';
        i += 2;
      } else {
        source += '.*';
        i += 1;
      }
    } else if (ch === '*') {
      source += '[^/]*';
    } else if (ch === '?') {
      source += '[^/]';
    } else {
      source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

function matchesAny(globs, relPath) {
  return globs.some((glob) => globToRegExp(glob).test(relPath));
}

// Resolve through symlinks even when the target file does not exist yet.
function realResolve(target) {
  let existing = target;
  const rest = [];
  while (!existsSync(existing)) {
    rest.unshift(path.basename(existing));
    const parent = path.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  return path.join(realpathSync(existing), ...rest);
}

function relativeToRoot(root, cwd, target) {
  const resolved = realResolve(path.resolve(cwd, target));
  const rel = path.relative(root, resolved);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function checkEdit(role, rules, root, cwd, target) {
  if (typeof target !== 'string' || target === '') block('edit call without a file path');
  const rel = relativeToRoot(root, cwd, target);
  if (rel === null) block(`${role} may not edit outside the working tree: ${target}`);
  if (matchesAny(rules.denyEdit, rel)) block(`${role} may not edit ${rel}`);
  if (!matchesAny(rules.editable, rel)) block(`${role} may not edit ${rel} (allowed: ${rules.editable.join(', ') || 'nothing'})`);
}

// Split on && || ; | & and newlines outside quotes. Redirection, expansions and unterminated quotes block.
function splitCommand(command) {
  if (/\$|`/.test(command)) block('command substitution and variable expansion are not allowed');
  const segments = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (ch === '\\' && quote === '"') {
        current += command[i + 1] ?? '';
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '\\') {
      current += ch + (command[i + 1] ?? '');
      i += 1;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
    } else if (ch === '>' || ch === '<') {
      block('redirection and heredocs are not allowed');
    } else if (ch === ';' || ch === '\n' || ch === '&' || ch === '|') {
      segments.push(current);
      current = '';
      if ((ch === '&' || ch === '|') && command[i + 1] === ch) i += 1;
    } else {
      current += ch;
    }
  }
  if (quote) block('unterminated quote in command');
  segments.push(current);
  return segments.map((s) => s.trim()).filter((s) => s !== '');
}

function checkPathWords(role, root, cwd, segment) {
  for (const word of segment.split(/\s+/)) {
    const bare = word.replace(/^['"]+|['"]+$/g, '');
    for (const part of bare.split('=')) {
      if (part === '' || part.startsWith('-')) continue;
      if (part.startsWith('~')) block(`${role} command touches the home directory: ${part}`);
      if (part.startsWith('/') || part === '..' || part.startsWith('../') || part.includes('/../')) {
        if (relativeToRoot(root, cwd, part) === null) block(`${role} command touches a path outside the working tree: ${part}`);
      }
    }
  }
}

function checkBash(role, rules, root, cwd, command) {
  if (typeof command !== 'string' || command.trim() === '') block('empty command');
  const segments = splitCommand(command);
  if (segments.length === 0) block('empty command');
  const allowed = rules.bashAllow.map((pattern) => new RegExp(`^(?:${pattern})$`));
  const fragments = rules.globalDenyFragments;
  for (const segment of segments) {
    if (/(^|\s)tee(\s|$)/.test(segment)) block('tee is not allowed');
    if (fragments.some((fragment) => segment.includes(fragment))) block(`forbidden option in: ${segment}`);
    if (!allowed.some((re) => re.test(segment))) block(`${role} may not run: ${segment}`);
    checkPathWords(role, root, cwd, segment);
    const verb = /^git (add|commit|merge)( |$)/.exec(segment);
    if (verb && rules.branchGated.includes(verb[1])) {
      const branch = currentBranch(cwd);
      if (!rules.commitBranchPrefix || !branch.startsWith(rules.commitBranchPrefix)) {
        block(`${role} may run git ${verb[1]} only on branches starting with "${rules.commitBranchPrefix}" (current: "${branch}")`);
      }
    }
  }
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const role = input.agent_type;

  if (TEST_MODE && process.env.ROLE_GUARD_DEBUG_FILE) {
    appendFileSync(process.env.ROLE_GUARD_DEBUG_FILE, `agent_type=${role ?? '(none)'} tool=${input.tool_name} cwd=${input.cwd}\n`);
  }

  if (!TEAM_ROLES.includes(role)) return; // ordinary session: layers 1 and 3 decide

  const here = path.dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(readFileSync(path.join(here, 'role-rules.json'), 'utf8'));
  const rules = { ...config.roles[role], globalDenyFragments: config.globalDenyFragments };
  if (!config.roles[role]) block(`no rules defined for role ${role}`);

  const cwd = input.cwd || process.cwd();
  const root = realpathSync(git(cwd, ['rev-parse', '--show-toplevel']));
  const tool = input.tool_name;
  const args = input.tool_input ?? {};

  if (EDIT_TOOLS.includes(tool)) {
    checkEdit(role, rules, root, cwd, args.file_path ?? args.notebook_path);
  } else if (SERENA_EDIT_TOOLS.includes(tool)) {
    checkEdit(role, rules, root, cwd, args.relative_path);
  } else if (tool === 'Bash') {
    checkBash(role, rules, root, cwd, args.command);
  }
}

try {
  main();
  process.exit(0);
} catch (error) {
  block(`internal error, failing closed: ${error instanceof Error ? error.message : String(error)}`);
}
