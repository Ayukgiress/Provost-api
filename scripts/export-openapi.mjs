import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const port = Number(process.env.OPENAPI_EXPORT_PORT ?? 3100);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/apps/api/main.js'], {
  env: { ...process.env, NODE_ENV: 'development', PORT: String(port) },
  stdio: 'ignore',
});

try {
  let response;
  let lastError;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(
        `API exited before serving OpenAPI (code ${server.exitCode})`,
      );
    try {
      response = await fetch(`${baseUrl}/openapi.json`);
      if (response.ok) break;
      lastError = new Error(
        `OpenAPI endpoint returned HTTP ${response.status}`,
      );
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!response?.ok)
    throw (
      lastError ?? new Error('Timed out waiting for the API OpenAPI endpoint')
    );

  const document = await response.json();
  await writeFile(
    new URL('../openapi.json', import.meta.url),
    `${JSON.stringify(document, null, 2)}\n`,
  );
} finally {
  server.kill('SIGTERM');
}
