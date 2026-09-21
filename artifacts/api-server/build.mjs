import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import fs from "node:fs";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// محلل ذكي يبحث عن الملفات في جميع المسارات المحتملة تلقائياً
const workspaceResolverPlugin = {
  name: "workspace-resolver",
  setup(build) {
    build.onResolve({ filter: /^@workspace\// }, (args) => {
      const subpath = args.path.replace(/^@workspace\//, "");
      let possibleFiles = [];

      if (subpath === "db") {
        possibleFiles = [
          path.resolve(artifactDir, "../../lib/db/src/index.ts"),
          path.resolve(artifactDir, "../../lib/db/index.ts"),
          path.resolve(artifactDir, "../../lib/db/src/db.ts"),
        ];
      } else if (subpath === "db/schema") {
        possibleFiles = [
          path.resolve(artifactDir, "../../lib/db/schema.ts"),
          path.resolve(artifactDir, "../../lib/db/src/schema.ts"),
          path.resolve(artifactDir, "../../lib/db/src/db/schema.ts"),
          path.resolve(artifactDir, "../../lib/db/db/schema.ts"),
        ];
      } else if (subpath.startsWith("db/")) {
        const relativePart = subpath.replace("db/", "");
        possibleFiles = [
          path.resolve(artifactDir, `../../lib/db/src/${relativePart}.ts`),
          path.resolve(artifactDir, `../../lib/db/${relativePart}.ts`),
          path.resolve(artifactDir, `../../lib/db/src/${relativePart}/index.ts`),
        ];
      } else if (subpath === "api-zod") {
        possibleFiles = [
          path.resolve(artifactDir, "../../lib/api-zod/src/index.ts"),
          path.resolve(artifactDir, "../../lib/api-zod/index.ts"),
        ];
      } else if (subpath.startsWith("api-zod/")) {
        const relativePart = subpath.replace("api-zod/", "");
        possibleFiles = [
          path.resolve(artifactDir, `../../lib/api-zod/src/${relativePart}.ts`),
          path.resolve(artifactDir, `../../lib/api-zod/${relativePart}.ts`),
        ];
      } else {
        possibleFiles = [
          path.resolve(artifactDir, `../../lib/${subpath}.ts`),
          path.resolve(artifactDir, `../../lib/${subpath}/src/index.ts`),
          path.resolve(artifactDir, `../../lib/${subpath}/index.ts`),
        ];
      }

      // البحث عن أول ملف موجود فعلياً على النظام
      for (const filePath of possibleFiles) {
        if (fs.existsSync(filePath)) {
          return { path: filePath, external: false };
        }
      }

      // إذا لم يتم العثور عليه، إرجاع المسار الأول لتجنب التوقف المفاجئ
      return { path: possibleFiles[0], external: false };
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
