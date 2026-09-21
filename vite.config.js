import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiPort = Number(process.env.IKAMVA_API_PORT || 4178);

function ensureApiServer() {
  const existing = globalThis.__ikamvaApiServerProcess;
  if (existing && existing.exitCode == null) {
    return existing;
  }

  const child = spawn(process.execPath, [path.join(__dirname, "backend", "dev-server.js")], {
    stdio: "inherit",
    env: {
      ...process.env,
      IKAMVA_API_PORT: String(apiPort),
      IKAMVA_API_HOST: "127.0.0.1",
    },
    windowsHide: true,
  });

  globalThis.__ikamvaApiServerProcess = child;
  return child;
}

async function proxyApiRequest(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const requestBody = Buffer.concat(chunks);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await new Promise((resolve, reject) => {
        const proxyReq = http.request({
          hostname: "127.0.0.1",
          port: apiPort,
          path: req.url,
          method: req.method,
          headers: req.headers,
        }, proxyRes => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(res);
          resolve();
        });
        proxyReq.on("error", reject);
        proxyReq.end(requestBody);
      });
      return;
    } catch (error) {
      if (error.code !== "ECONNREFUSED" || attempt === 9) {
        console.error("[ikamva-api] Proxy error:", error);
        if (!res.writableEnded) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "API backend unavailable" }));
        }
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

export default defineConfig(({ command, mode }) => {
  const runtimeEnv = loadEnv(mode, __dirname, "");
  Object.assign(process.env, runtimeEnv);
  return {
    define: {
      __IKAMVA_SKIP_EMAIL_CONFIRMATION__: JSON.stringify(runtimeEnv.SKIP_EMAIL_CONFIRMATION === "true"),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    plugins: [
      react(),
      {
        name: "ikamva-api-proxy",
        configureServer(server) {
          ensureApiServer();

          server.middlewares.use((req, res, next) => {
            if (!req.url?.startsWith("/api/")) {
              return next();
            }
            proxyApiRequest(req, res);
          });

          server.httpServer?.once("close", () => {
            const child = globalThis.__ikamvaApiServerProcess;
            if (child && child.exitCode == null) {
              child.kill();
            }
          });
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('three') || id.includes('@react-three') || id.includes('ogl')) return 'vendor-webgl';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-documents';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('react') || id.includes('@tanstack') || id.includes('react-router')) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
  };
});
