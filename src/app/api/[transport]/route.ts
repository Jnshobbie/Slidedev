// src/app/api/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { auth } from "@clerk/nextjs/server";
import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { z } from "zod";
import { consumeMcpSearchCredit } from "@/lib/mcp-usage";
import { searchDesignPatterns, type Category } from "@/lib/design-library";

const CATEGORIES: [Category, ...Category[]] = [
  "gsap",
  "mobile-ui",
  "landing-page",
  "motion",
];

const PREVIEW_URI = "ui://slidedev/preview-test.html";

const PREVIEW_HTML = `<!doctype html>
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
  #status-text{font-size:12px;color:#888;text-align:center;padding:4px}
</style></head>
<body>
<div id="status-text">loading...</div>
<div id="wrap"><div id="phone"><div id="screen">
  <div id="root"></div>
  <div id="status"><span>9:41</span><svg width="66" height="14" viewBox="0 0 66 14" fill="#fff"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/><path d="M27 4c3-3 8-3 11 0l-1.5 1.5c-2-2-6-2-8 0zM29.5 7c1.5-1.5 4.5-1.5 6 0L32.5 10z"/><rect x="42" y="1" width="21" height="12" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="44" y="3" width="17" height="8" rx="2"/></svg></div>
  <div id="island"></div>
  <div id="home"></div>
</div></div></div>
<script type="module">
  var statusText = document.getElementById("status-text");
  function send(m){ window.parent.postMessage(m, "*"); }
  function size(){ send({jsonrpc:"2.0",method:"ui/notifications/size-changed",params:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}}); }
  window.addEventListener("message", function(e){
    var m = e.data;
    if (m && m.id === 1) { send({jsonrpc:"2.0",method:"ui/notifications/initialized",params:{}}); size(); }
  });
  send({jsonrpc:"2.0",id:1,method:"ui/initialize",params:{appInfo:{name:"slidedev-preview",version:"0.1.0"},appCapabilities:{},protocolVersion:"2026-01-26"}});

  var deps = "?deps=react@18.3.1,react-dom@18.3.1";
  Promise.all([
    import("https://esm.sh/react@18.3.1"),
    import("https://esm.sh/react-dom@18.3.1/client" + "?deps=react@18.3.1"),
    import("https://esm.sh/react-native-web@0.19.13" + deps)
  ]).then(function(mods){
    var React = mods[0].default;
    var createRoot = mods[1].createRoot;
    var RNW = mods[2];
    function App(){
      var s = React.useState(0);
      return React.createElement(RNW.View, {style:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#0A0A0A",paddingTop:59}},
        React.createElement(RNW.Text, {style:{color:"#D2E70E",fontSize:28,marginBottom:16}}, "Taps: " + s[0]),
        React.createElement(RNW.Pressable, {onPress:function(){ s[1](s[0]+1); }, style:{backgroundColor:"#D2E70E",padding:16,borderRadius:12}},
          React.createElement(RNW.Text, {style:{color:"#0A0A0A",fontWeight:"700"}}, "Tap me")));
    }
    createRoot(document.getElementById("root")).render(React.createElement(App));
    statusText.textContent = "react-native-web loaded";
    size();
  }).catch(function(err){ statusText.textContent = "FAILED: " + err; size(); });
</script></body></html>`;

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
      "preview-test",
      PREVIEW_URI,
      { mimeType: "text/html;profile=mcp-app" },
      async () => ({
        contents: [
          {
            uri: PREVIEW_URI,
            mimeType: "text/html;profile=mcp-app",
            text: PREVIEW_HTML,
            _meta: { ui: { csp: { resourceDomains: ["https://esm.sh"] } } },
          },
        ],
      })
    );

    server.registerTool(
      "preview_test",
      {
        description:
          "Renders a small interactive phone preview test. Call this when the user asks to test the mobile preview.",
        _meta: { ui: { resourceUri: PREVIEW_URI } },
      },
      async () => ({
        content: [{ type: "text", text: "Preview rendered." }],
      })
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