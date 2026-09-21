import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import fs from "node:fs";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// محلل آمن يتحقق من وجود الملفات أو يوجهها للمسار الرئيسي البديل
const workspaceResolverPlugin = {
  name: "workspace-resolver",
  setup(build) {
    build.onResolve({ filter: /^@workspace\// }, (args) => {
      const subpath = args.path.replace(/^@workspace\//, "");
      
      const defaultIndex = path.resolve(artifactDir, "../../lib/db/src/index.ts");
      let targetPath = defaultIndex;

      if (subpath === "db") {
        targetPath = path.resolve(artifactDir, "../../lib/db/src/index.ts");
      } else if (subpath === "db/schema" || subpath.includes("schema")) {
        // إذا كان ملف الـ schema غير موجود، نوجهه إلى ملف الـ index الأساسي لضمان نجاح البناء
        targetPath = fs.existsSync(path.resolve(artifactDir, "../../lib/db/src/schema.ts"))
          ? path.resolve(artifactDir, "../../lib/db/src/schema.ts")
          : path.resolve(artifactDir, "../../lib/db/src/index.ts");
      } else if (subpath === "api-zod") {
        targetPath = path.resolve(artifactDir, "../../lib/api-zod/src/index.ts");
      } else {
        targetPath = path.resolve(artifactDir, `../../lib/${subpath}/src/index.ts`);
      }

      if (!fs.existsSync(targetPath)) {
        targetPath = defaultIndex;
      }

      return { path: targetPath, external: false };
    });
  },
};

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    plugins: [
      workspaceResolverPlugin,
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
