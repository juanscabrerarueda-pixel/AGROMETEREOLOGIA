# Local Codex CLI (mock)

This workspace includes a small mock "Codex" CLI to test editing workflows without an OpenAI key.

Files included:

- `scripts/codex-cli.js` - a small Node script that supports:
  - `preview <file> --prompt "..."`: show a mock transformation of the file
  - `apply <file> --prompt "..."`: preview and then apply the mock patch (creates a backup)
  - `run <build|test>`: run project scripts via `pnpm run <name>`

Usage examples (PowerShell):

```powershell
node .\scripts\codex-cli.js preview Index.html --prompt "fix grammar"
node .\scripts\codex-cli.js apply Index.html --prompt "fix grammar"
node .\scripts\codex-cli.js run build
```

Notes:
- This is explicitly a MOCK implementation for local testing and demos. It does not call OpenAI or Codex APIs.
- The mock now injects language-aware comment headers/footers so you can preview cambios sin tocar el cuerpo del archivo.
- To integrate a real API later, replace `runMockCodex` in `scripts/codex-cli.js` with a call to your preferred client and use an env-var-held API key.

Safety:
- The `apply` command creates a timestamped `.bak` file before writing changes.
