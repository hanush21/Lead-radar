const fs = require("fs");
const path = require("path");

const appDir = path.resolve(__dirname, "..");
const standaloneDir = path.join(appDir, ".next", "standalone");
const staticDir = path.join(appDir, ".next", "static");
const publicDir = path.join(appDir, "public");
const envExamplePath = path.join(appDir, ".env.example");
const outputDir = path.join(appDir, "dist-hostinger");

function copyDir(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

function copyDirContents(source, destination) {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      fs.cpSync(sourcePath, destinationPath, { recursive: true });
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function findServerRelativePath(rootDir) {
  const directServer = path.join(rootDir, "server.js");
  if (fs.existsSync(directServer)) return "server.js";

  const queue = [rootDir];
  while (queue.length > 0) {
    const currentDir = queue.shift();
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === "server.js") {
        return path.relative(rootDir, fullPath);
      }
    }
  }

  return null;
}

function writeLauncher(serverRelativePath) {
  const launcherPath = path.join(outputDir, "start.js");
  const launcherSource = `'use strict';

const path = require('path');
const fs = require('fs');

const candidates = [
  ${JSON.stringify(serverRelativePath.replace(/\\/g, "/"))},
  'server.js',
  'apps/web/server.js',
].filter(Boolean);

const resolved = candidates
  .map((candidate) => path.join(__dirname, candidate))
  .find((candidate) => fs.existsSync(candidate));

if (!resolved) {
  throw new Error('No se encontro server.js en el paquete standalone.');
}

process.chdir(path.dirname(resolved));
require(resolved);
`;

  fs.writeFileSync(launcherPath, launcherSource, "utf8");
}

function writeInstructions(serverRelativePath) {
  const instructionsPath = path.join(outputDir, "HOSTINGER_DEPLOY.txt");
  const appRootRelative = path.dirname(serverRelativePath).replace(/\\/g, "/");
  const staticLocation = appRootRelative && appRootRelative !== "." ? `${appRootRelative}/.next/static` : ".next/static";
  const publicLocation = appRootRelative && appRootRelative !== "." ? `${appRootRelative}/public` : "public";

  const content = [
    "LeadRadar - despliegue manual para Hostinger",
    "",
    "1. Sube todo el contenido de esta carpeta al servidor Node de Hostinger.",
    "2. Configura las variables de entorno necesarias en Hostinger.",
    "3. Usa este comando de inicio:",
    "   node start.js",
    "",
    "El paquete generado incluye:",
    `- servidor standalone: ${serverRelativePath.replace(/\\/g, "/")}`,
    `- assets de Next: ${staticLocation}`,
    fs.existsSync(publicDir) ? `- assets publicos: ${publicLocation}` : "- assets publicos: no hay carpeta public en este proyecto",
    "",
    "Variables minimas recomendadas:",
    "- DATABASE_URL",
    "- DIRECT_URL",
    "- APP_BASE_URL",
    "- NEXTAUTH_URL",
    "- AUTH_URL",
    "- NEXTAUTH_SECRET",
    "- AUTH_SECRET",
    "- NEXT_PUBLIC_MAPBOX_TOKEN",
    "- RESEND_API_KEY",
    "- RESEND_FROM_EMAIL",
    "- RESEND_REPLY_TO",
    "",
    "Si usas PostgreSQL externo, aplica migraciones antes de arrancar el servidor.",
  ].join("\n");

  fs.writeFileSync(instructionsPath, content, "utf8");
}

function main() {
  if (!fs.existsSync(standaloneDir)) {
    throw new Error(`No existe el output standalone en ${standaloneDir}. Ejecuta primero next build.`);
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  copyDirContents(standaloneDir, outputDir);

  const serverRelativePath = findServerRelativePath(outputDir);
  if (!serverRelativePath) {
    throw new Error("No se encontro server.js dentro del output standalone generado por Next.js.");
  }

  const appRootRelative = path.dirname(serverRelativePath);
  const staticTarget =
    appRootRelative && appRootRelative !== "."
      ? path.join(outputDir, appRootRelative, ".next", "static")
      : path.join(outputDir, ".next", "static");

  copyDir(staticDir, staticTarget);

  if (fs.existsSync(publicDir)) {
    const publicTarget =
      appRootRelative && appRootRelative !== "."
        ? path.join(outputDir, appRootRelative, "public")
        : path.join(outputDir, "public");
    copyDir(publicDir, publicTarget);
  }

  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, path.join(outputDir, ".env.example"));
  }

  writeLauncher(serverRelativePath);
  writeInstructions(serverRelativePath);

  console.log(`[hostinger] paquete listo en ${outputDir}`);
  console.log(`[hostinger] arranque recomendado: node start.js`);
}

main();
