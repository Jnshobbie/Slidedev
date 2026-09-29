// src/app/api/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { auth } from "@clerk/nextjs/server";
import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { z } from "zod";
import { consumeMcpSearchCredit } from "@/lib/mcp-usage";
import { searchDesignPatterns, type Category } from "@/lib/design-library";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { savePreview } from "@/lib/preview-store";

const CATEGORIES: [Category, ...Category[]] = [
  "gsap",
  "mobile-ui",
  "landing-page",
  "motion",
];

function buildPreviewHtml(hash: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  body{margin:0;background:transparent;font-family:-apple-system,system-ui,sans-serif}
  #wrap{display:flex;justify-content:center;padding:12px}
  #phone{box-sizing:content-box;width:393px;height:852px;padding:12px;border-radius:67px;background:#1c1c1e;box-shadow:0 0 0 2px #3a3a3c,0 20px 40px rgba(0,0,0,.35)}
  #screen{position:relative;width:393px;height:852px;border-radius:55px;overflow:hidden;background:#000;isolation:isolate}
  #root{position:absolute;inset:0;display:flex}
  #island{position:absolute;top:11px;left:50%;margin-left:-62px;width:124px;height:36px;border-radius:18px;background:#000;z-index:3}
  #status{position:absolute;top:0;left:0;right:0;height:54px;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:6px 36px 0 52px;color:#fff;mix-blend-mode:difference;font:600 17px -apple-system,system-ui,sans-serif;pointer-events:none}
  #home{position:absolute;bottom:8px;left:50%;margin-left:-67px;width:134px;height:5px;border-radius:3px;background:#fff;mix-blend-mode:difference;z-index:2;pointer-events:none}
  #err{position:absolute;inset:0;background:#1a0000;color:#ff6b6b;font:12px/1.5 monospace;padding:16px;white-space:pre-wrap;overflow:auto;display:none;z-index:4}
  #status-text{font-size:12px;color:#888;text-align:center;padding:4px}
</style></head>
<body>
<div id="status-text">loading...</div>
<div id="wrap"><div id="phone"><div id="screen">
  <div id="root"></div>
  <div id="err"></div>
  <div id="status"><span>9:41</span><svg width="66" height="14" viewBox="0 0 66 14" fill="#fff"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/><path d="M27 4c3-3 8-3 11 0l-1.5 1.5c-2-2-6-2-8 0zM29.5 7c1.5-1.5 4.5-1.5 6 0L32.5 10z"/><rect x="42" y="1" width="21" height="12" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="44" y="3" width="17" height="8" rx="2"/></svg></div>
  <div id="island"></div>
  <div id="home"></div>
</div></div></div>
<script type="module">
    var statusText = document.getElementById("status-text");
  var errBox = document.getElementById("err");
  var rootEl = document.getElementById("root");
  var HASH = ${JSON.stringify(hash)};
  var API = "https://mcp.slidedevai.com/api/preview-code/" + HASH;

  function send(m){ window.parent.postMessage(m, "*"); }
  function size(){ send({jsonrpc:"2.0",method:"ui/notifications/size-changed",params:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}}); }
  window.addEventListener("message", function(e){
    var m = e.data;
    if (m && m.id === 1) { send({jsonrpc:"2.0",method:"ui/notifications/initialized",params:{}}); size(); }
  });
  send({jsonrpc:"2.0",id:1,method:"ui/initialize",params:{appInfo:{name:"slidedev-preview",version:"0.1.0"},appCapabilities:{},protocolVersion:"2026-01-26"}});

  function loadWithTimeout(label, promiseFn, ms){
    statusText.textContent = "loading " + label + "...";
    size();
    return Promise.race([
      promiseFn().then(function(m){ statusText.textContent = label + " ok"; size(); return m; }),
      new Promise(function(_, reject){ setTimeout(function(){ reject(new Error(label + " timed out after " + ms + "ms")); }, ms); })
    ]);
  }

  loadWithTimeout("react", function(){ return import("https://esm.sh/react@18.3.1"); }, 12000)
    .then(function(React){
      return loadWithTimeout("react-dom", function(){ return import("https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1"); }, 12000)
        .then(function(RD){ return [React, RD]; });
    })
    .then(function(r){
      var React = r[0], RD = r[1];
      return loadWithTimeout("react-native-web", function(){ return import("https://esm.sh/react-native-web@0.19.13?deps=react@18.3.1,react-dom@18.3.1"); }, 12000)
        .then(function(RNW){ return [React, RD, RNW]; });
    })
    .then(function(r){
      var React = r[0], RD = r[1], RNW = r[2];
      return loadWithTimeout("sucrase", function(){ return import("https://esm.sh/sucrase@3.35.0"); }, 12000)
        .then(function(Sucrase){ return [React, RD, RNW, Sucrase]; });
    })
    .then(function(mods){
      var React = mods[0].default;
      var createRoot = mods[1].createRoot;
      var RNW = mods[2];
      var Sucrase = mods[3];
      var root = createRoot(rootEl);
      var lastCode = null;

      var RNShim = Object.assign({}, RNW, {
        Platform: { OS: "ios", select: function(o){ return o.ios !== undefined ? o.ios : o.default; } },
        Dimensions: { get: function(){ return { width: 393, height: 852 }; }, addEventListener: function(){ return { remove: function(){} }; } },
        useWindowDimensions: function(){ return { width: 393, height: 852 }; },
        SafeAreaView: function(props){ return React.createElement(RNW.View, Object.assign({}, props, { style: [{ paddingTop: 59, paddingBottom: 34 }, props.style] }), props.children); }
      });

      function renderCode(code, entry){
        try {
          var compiled = Sucrase.transform(code, { transforms: ["jsx", "typescript", "imports"] }).code;
          var mod = { exports: {} };
          var req = function(name){
            if (name === "react") return React;
            if (name === "react-native") return RNShim;
            throw new Error("Module not available in preview: " + name);
          };
          new Function("module", "exports", "require", compiled)(mod, mod.exports, req);
          var Comp = mod.exports[entry] || mod.exports.default;
          if (!Comp) throw new Error("No export named " + entry + " or default found");
          errBox.style.display = "none";
          root.render(React.createElement(Comp));
          statusText.textContent = "updated";
        } catch (err) {
          errBox.textContent = String(err && err.stack || err);
          errBox.style.display = "block";
          statusText.textContent = "compile error";
        }
        size();
      } 

      function poll(){ 
        fetch(API, { cache: "no-store" }).then(function(r){
          if (!r.ok) throw new Error("HTTP " + r.status + " from preview-code endpoint");
          return r.json();
        }).then(function(data){
          if (data.code !== lastCode) {
            lastCode = data.code;
            renderCode(data.code, data.entry || "App");
          }
        }).catch(function(err){
          statusText.textContent = "poll failed: " + err.message;
          size();
        });
      }
    .catch(function(err){
      errBox.textContent = String(err && err.stack || err);
      errBox.style.display = "block";
      statusText.textContent = "FAILED";
      size();
    });
</script></body></html>`;
}

const baseHandler = createMcpHandler(
  (server) => {
    server.tool(
      "search_design_patterns",
      "Search SlideDev's design pattern library for GSAP animations, UI components, and layout techniques matching a natural-language description. Returns code, a description, and a usageNote for each match — read the usageNote before adapting the code, since patterns are framework-specific and copying syntax across frameworks (React vs Vue vs vanilla) will break. IMPORTANT: if the user hasn't specified an animation style, do not leave it generic or minimal by default — pick a mood yourself that fits the site's context and purpose (a portfolio calls for different motion than a SaaS dashboard), the same way a professional designer would without being told exactly what to do. Also call this tool multiple times per build, once for each distinct moment that needs motion (hero entrance, scroll-triggered reveals, hover/interactive states), rather than a single call applied everywhere — one pattern reused site-wide is what makes AI-built sites look basic. Layering 2-4 well-chosen patterns is the actual differentiator this tool exists for.",
      {
        query: z
          .string()
          .describe(
            "Natural-language description of the desired effect or component, e.g. 'staggered card entrance animation' or 'sticky navbar that hides on scroll'"
          ),
        category: z
          .enum(CATEGORIES)
          .optional()
          .describe(
            "Optional filter: 'gsap' (scroll/entrance animations), 'mobile-ui' (mobile components), 'landing-page' (page-level layouts), or 'motion' (general motion patterns)"
          ),
        framework: z
          .string()
          .optional()
          .describe("Optional filter, e.g. 'react', 'vue', 'vanilla'"),
        mood: z
          .string()
          .optional()
          .describe(
            "Filter for animation feel: 'minimal-snappy', 'bold-elastic', 'cinematic-slow', 'playful-bouncy', or 'luxury-smooth'. If the user didn't specify a style, don't skip this — choose whichever mood fits the site's actual purpose and audience yourself, rather than leaving it blank and accepting whatever ranks first by default."
          ),
        limit: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("Max number of patterns to return (default 3)"),
        excludeMoods: z
          .array(z.string())
          .optional()
          .describe("Optional: mood tags to exclude from results, e.g. ['playful-bouncy'] if that style doesn't fit"),
        context: z
          .string()
          .optional()
          .describe("Optional: describe existing design tokens/components in the target app (e.g. 'primary color token --brand-500, existing Button and Card components') so retrieval favors compatible patterns"),
      },
      async ({ query, category, framework, mood, limit, excludeMoods, context }, extra) => {
        const userId = extra.authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          return { content: [{ type: "text", text: "Authentication required." }], isError: true };
        }

        const usage = await consumeMcpSearchCredit(userId);
        if (!usage.allowed) {
          return {
            content: [{ type: "text", text: "Monthly search limit reached. Upgrade to Pro for more searches." }],
            isError: true,
          };
        }

        const results = await searchDesignPatterns(query, {
          category,
          framework,
          mood,
          limit,
          excludeMoods,
          context,
        });

        const formatted = results.map((r) => ({
          whyItFits: r.description,
          frameworkCompatibility: r.framework,
          mood: r.mood,
          technique: r.technique,
          usageNote: r.usageNote,
          constraints: r.constraints,
          antiPatterns: r.antiPatterns,
          accessibilityNotes: r.accessibilityNotes,
          motionBudget: r.motionBudget,
          sourceRepo: r.sourceRepo,
          license: r.license,
          code: r.code,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(formatted, null, 2),
            },
          ],
        };
      }
    );

    server.registerResource(
      "mobile-preview",
      new ResourceTemplate("ui://slidedev/preview/{hash}.html", { list: undefined }),
      { mimeType: "text/html;profile=mcp-app" },
      async (uri, { hash }) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/html;profile=mcp-app",
            text: buildPreviewHtml(hash as string),
            _meta: {
              ui: {
                csp: {
                  resourceDomains: ["https://esm.sh"],
                  connectDomains: ["https://mcp.slidedevai.com"],
                },
              },
            },
          },
        ],
      })
    );

    server.registerTool(
      "preview_mobile_app",
      {
        description:
          "Renders the given React Native (core components only) component code as a live, interactive phone preview inside the chat. Pass the full source of one file exporting the root component as default, or as a named export matching entryComponentName.",
        inputSchema: {
          code: z.string().describe("Full source code of the app, using only react and react-native imports"),
          entryComponentName: z.string().optional().describe("Name of the exported root component, defaults to 'App' or default export"),
        },
        _meta: { ui: { resourceUri: "ui://slidedev/preview/{hash}.html" } },
      },
      async ({ code, entryComponentName }, extra) => {
        const userId = (extra.authInfo?.extra?.userId as string | undefined) ?? "anonymous";
        const entry = entryComponentName || "App";
        const hash = await savePreview(userId, code, entry);
        return {
          content: [{ type: "text", text: "Preview rendered." }],
          _meta: { ui: { resourceUri: `ui://slidedev/preview/${hash}.html` } },
        };
      }
    );
  },
  {},
  {
    basePath: "/api",
    verboseLogs: true,
    maxDuration: 60,
  }
);

const handler = withMcpAuth(
  baseHandler,
  async (_req, bearerToken) => {
    const clerkAuth = await auth({ acceptsToken: "oauth_token" });
    return verifyClerkToken(clerkAuth, bearerToken);
  },
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
  }
);

export { handler as GET, handler as POST, handler as DELETE };