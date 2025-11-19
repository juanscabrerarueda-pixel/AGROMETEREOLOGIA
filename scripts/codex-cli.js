#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function usage() {
  console.log(`Usage:
  node scripts/codex-cli.js preview <file> --prompt "..."    # show mock patch
  node scripts/codex-cli.js apply <file> --prompt "..."      # apply mock patch (asks confirmation)
  node scripts/codex-cli.js run <build|test>                  # run project scripts (pnpm)

Notes:
  - This is a mock Codex tool for local testing (no OpenAI key required).
  - To integrate a real API later, replace runMockCodex with a real client call.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0];
  const file = args[1];
  let prompt = '';
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--prompt' && i + 1 < args.length) {
      prompt = args[i + 1];
      i++;
    }
  }
  return { cmd, file, prompt };
}

function runMockCodex(filePath, original, prompt) {
  const normalized = summarizePrompt(prompt);
  const header = buildMockComment(
    filePath,
    `MOCK Codex preview (${new Date().toISOString()}): ${normalized}`
  );
  const footer = buildMockComment(
    filePath,
    'MOCK Codex: reemplaza este bloque con la respuesta real'
  );
  return `${header}\n${original}\n${footer}\n`;
}

function summarizePrompt(prompt) {
  if (!prompt) return 'sin prompt';
  const compact = prompt.trim().replace(/\s+/g, ' ');
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

function buildMockComment(filePath, text) {
  const ext = (path.extname(filePath) || '').toLowerCase();
  switch (ext) {
    case '.html':
    case '.htm':
    case '.md':
      return `<!-- ${text} -->`;
    case '.css':
    case '.scss':
    case '.less':
    case '.json':
      return `/* ${text} */`;
    case '.sh':
    case '.bash':
    case '.zsh':
    case '.ps1':
    case '.py':
    case '.rb':
      return `# ${text}`;
    default:
      return `// ${text}`;
  }
}

function previewPatch(filePath, prompt) {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  const original = fs.readFileSync(filePath, 'utf8');
  const modified = runMockCodex(filePath, original, prompt);
  console.log('--- ORIGINAL ---');
  console.log(original);
  console.log('\n--- MOCK MODIFIED (preview) ---');
  console.log(modified);
}

function applyPatch(filePath, prompt) {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  const original = fs.readFileSync(filePath, 'utf8');
  const modified = runMockCodex(filePath, original, prompt);
  console.log('Preview of changes:\n');
  console.log(modified);
  process.stdout.write('\nApply changes? (y/N): ');
  process.stdin.setEncoding('utf8');
  process.stdin.once('data', (d) => {
    const ans = d.toString().trim().toLowerCase();
    if (ans === 'y' || ans === 'yes') {
      const bak = `${filePath}.bak.${Date.now()}`;
      fs.writeFileSync(bak, original, 'utf8');
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`Applied. Backup saved to ${bak}`);
    } else {
      console.log('Aborted. No changes applied.');
    }
    process.exit(0);
  });
}

function runScript(name) {
  const cmd = 'pnpm';
  const args = ['run', name];
  console.log(`Running: ${cmd} ${args.join(' ')}`);
  const child = spawn(cmd, args, { stdio: 'inherit' });
  child.on('close', (code) => process.exit(code));
}

function main() {
  const { cmd, file, prompt } = parseArgs(process.argv);
  if (!cmd) return usage();
  if (cmd === 'preview') {
    if (!file) return usage();
    previewPatch(file, prompt);
  } else if (cmd === 'apply') {
    if (!file) return usage();
    applyPatch(file, prompt);
  } else if (cmd === 'run') {
    if (!file) return usage();
    runScript(file);
  } else {
    usage();
  }
}

main();
