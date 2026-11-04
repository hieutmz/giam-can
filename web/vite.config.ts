import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Chạy các Vercel Function trong api/*.ts ngay trên `npm run dev` (bản deploy do Vercel chạy). */
function apiRoutes(): Plugin {
  return {
    name: "api-routes",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res, next) => {
        const name = req.url?.split("?")[0].replace(/^\//, "") ?? "";
        // Như Vercel: file bắt đầu bằng "_" là module dùng chung, không phải route
        if (!/^[\w-]+$/.test(name) || name.startsWith("_")) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const handler = mod[req.method ?? "GET"] as ((r: Request) => Promise<Response>) | undefined;
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
          const response = await handler(
            new Request(`http://localhost${req.originalUrl ?? req.url}`, {
              method: req.method,
              headers,
              body: chunks.length ? Buffer.concat(chunks) : undefined,
            }),
          );
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Biến không có tiền tố VITE_ (ANTHROPIC_API_KEY…) chỉ cho function phía server, không lộ ra trình duyệt
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return { plugins: [react(), apiRoutes()] };
});
