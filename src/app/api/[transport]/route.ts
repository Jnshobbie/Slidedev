// src/app/api/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { auth } from "@clerk/nextjs/server";
import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { z } from "zod";
import { consumeMcpSearchCredit } from "@/lib/mcp-usage";
import { searchDesignPatterns, type Category } from "@/lib/design-library";
import { savePreview } from "@/lib/preview-store";

const CATEGORIES: [Category, ...Category[]] = [
  "gsap",
  "mobile-ui",
  "landing-page",
  "motion",
];

function buildPreviewHtml(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<meta name="color-scheme" content="light dark"/>
<style>
  html,body{margin:0;height:100%;background:transparent}
  body{font-family:-apple-system,system-ui,sans-serif}
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
</div></div>
<div style="text-align:center;font-size:11px;color:#888;margin-top:8px;max-width:393px">Layout preview only. Fonts and native controls may differ on a real device.</div>
<div id="qrbox" style="display:none;text-align:center;margin-top:12px;color:#888;font-size:11px"><canvas id="qr"></canvas><div>Scan with Expo Go to test on your phone</div></div>
</div>
<script type="module">
  var statusText = document.getElementById("status-text");
  var errBox = document.getElementById("err");
  var rootEl = document.getElementById("root");
  var HASH = null;
  var API_BASE = "https://app.slidedevai.com/api/preview-code/";
  var pending = null;
  var renderReady = null;

  function send(m){ window.parent.postMessage(m, "*"); }
  function size(){ send({jsonrpc:"2.0",method:"ui/notifications/size-changed",params:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}}); }
  window.addEventListener("message", function(e){
    var m = e.data;
    if (m && m.id === 1) { send({jsonrpc:"2.0",method:"ui/notifications/initialized",params:{}}); size(); }
    if (m && m.method === "ui/notifications/tool-result") {
      var sc = m.params && m.params.structuredContent;
      if (sc && sc.code) {
        HASH = sc.hash;
        if (sc.expUrl) { import("https://esm.sh/qrcode@1.5.4").then(function(m){ var Q = m.default || m; Q.toCanvas(document.getElementById("qr"), sc.expUrl, { width: 160, margin: 1 }, function(){ document.getElementById("qrbox").style.display = "block"; size(); }); }).catch(function(){}); }
        if (renderReady) { renderReady(sc.code, sc.entry || "App"); }
        else { pending = sc; }
      }
    }
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

      // ---- Alert.alert shim: RNW does not implement this at all, so we build a real one ----
      var alertListeners = [];
      var AlertShim = {
        alert: function(title, message, buttons){
          var btns = (buttons && buttons.length) ? buttons : [{ text: "OK" }];
          alertListeners.forEach(function(fn){ fn({ title: title, message: message, buttons: btns }); });
        }
      };
      function AlertHost(){
        var st = React.useState(null);
        React.useEffect(function(){
          var fn = function(a){ st[1](a); };
          alertListeners.push(fn);
          return function(){ alertListeners = alertListeners.filter(function(f){ return f !== fn; }); };
        }, []);
        if (!st[0]) return null;
        var a = st[0];
        function close(btn){
          st[1](null);
          if (btn.onPress) btn.onPress();
        }
        return React.createElement(RNW.View, { style: { position: "absolute", inset: 0, zIndex: 50, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" } },
          React.createElement(RNW.View, { style: { width: 270, borderRadius: 14, backgroundColor: "rgba(30,30,30,0.9)", overflow: "hidden" } },
            React.createElement(RNW.View, { style: { padding: 16, alignItems: "center" } },
              React.createElement(RNW.Text, { style: { color: "#fff", fontWeight: "600", fontSize: 16, marginBottom: a.message ? 4 : 0, textAlign: "center" } }, a.title || ""),
              a.message ? React.createElement(RNW.Text, { style: { color: "#ddd", fontSize: 13, textAlign: "center" } }, a.message) : null
            ),
            React.createElement(RNW.View, { style: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" } },
              a.buttons.map(function(btn, i){
                return React.createElement(RNW.Pressable, {
                  key: i,
                  onPress: function(){ close(btn); },
                  style: { flex: 1, paddingVertical: 12, alignItems: "center", borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: "rgba(255,255,255,0.15)" }
                }, React.createElement(RNW.Text, { style: { color: btn.style === "destructive" ? "#ff453a" : "#0a84ff", fontWeight: btn.style === "cancel" ? "400" : "600", fontSize: 15 } }, btn.text || "OK"));
              })
            )
          )
        );
      }

      // ---- Lightweight screen stack, push/pop with a slide transition ----
      var StackCtx = React.createContext(null);
      function useNavigation(){ return React.useContext(StackCtx); }
      function StackNavigator(props){
        var st = React.useState([{ key: "root", Screen: props.initial }]);
        var nav = {
          push: function(Screen, params){ st[1](st[0].concat([{ key: "s" + st[0].length + Date.now(), Screen: Screen, params: params }])); },
          pop: function(){ if (st[0].length > 1) st[1](st[0].slice(0, -1)); },
          params: {}
        };
        return React.createElement(StackCtx.Provider, { value: nav },
          React.createElement(RNW.View, { style: { flex: 1 } },
            st[0].map(function(entry, i){
              var isTop = i === st[0].length - 1;
              return React.createElement(RNW.View, {
                key: entry.key,
                style: {
                  willChange: "transform",
                  position: i === 0 ? "relative" : "absolute", inset: 0, flex: 1,
                  transitionProperty: "transform", transitionDuration: "260ms", transitionTimingFunction: "ease-out",
                  transform: [{ translateX: isTop ? 0 : (i === st[0].length - 2 ? -40 : 0) }]
                }
              }, React.createElement(entry.Screen, { navigation: Object.assign({}, nav, { params: entry.params || {} }) }));
            })
          )
        );
      }

      // ---- KeyboardAvoidingView using the real visualViewport API ----
      function KeyboardAvoidingView(props){
        var st = React.useState(0);
        React.useEffect(function(){
          if (!window.visualViewport) return;
          function onResize(){
            var h = window.innerHeight - window.visualViewport.height;
            st[1](h > 60 ? h : 0);
          }
          window.visualViewport.addEventListener("resize", onResize);
          return function(){ window.visualViewport.removeEventListener("resize", onResize); };
        }, []);
        return React.createElement(RNW.View, Object.assign({}, props, { style: [props.style, { paddingBottom: st[0] }] }), props.children);
      }

      // ---- Pressable with real scale/opacity feedback instead of RNW's default instant swap ----
      function PressableShim(props){
        var st = React.useState(false);
        return React.createElement(RNW.Pressable, Object.assign({}, props, {
          onPressIn: function(e){ st[1](true); props.onPressIn && props.onPressIn(e); },
          onPressOut: function(e){ st[1](false); props.onPressOut && props.onPressOut(e); },
          style: function(state){
            var base = typeof props.style === "function" ? props.style(state) : props.style;
            return [base, { transform: [{ scale: st[0] ? 0.96 : 1 }], opacity: st[0] ? 0.85 : 1, transitionProperty: "transform, opacity", transitionDuration: "120ms", willChange: "transform" }];
          }
        }), props.children);
      }

      // ---- ScrollView with momentum + contained overscroll instead of default web scroll ----
      function ScrollViewShim(props){
        return React.createElement(RNW.ScrollView, Object.assign({}, props, {
          style: [props.style, { WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }]
        }), props.children);
      }

      var RNShim = Object.assign({}, RNW, {
        Platform: { OS: "ios", select: function(o){ return o.ios !== undefined ? o.ios : o.default; } },
        Dimensions: { get: function(){ return { width: 393, height: 852 }; }, addEventListener: function(){ return { remove: function(){} }; } },
        useWindowDimensions: function(){ return { width: 393, height: 852 }; },
        SafeAreaView: function(props){ return React.createElement(RNW.View, Object.assign({}, props, { style: [{ paddingTop: 59, paddingBottom: 34 }, props.style] }), props.children); },
        Alert: AlertShim,
        Vibration: { vibrate: function(){}, cancel: function(){} },
        KeyboardAvoidingView: KeyboardAvoidingView,
        Pressable: PressableShim,
        ScrollView: ScrollViewShim
      });

      var NavShim = { StackNavigator: StackNavigator, useNavigation: useNavigation };

      function renderCode(code, entry){
        try {
          var compiled = Sucrase.transform(code, { transforms: ["jsx", "typescript", "imports"] }).code;
          var mod = { exports: {} };
          var req = function(name){
            if (name === "react") return React;
            if (name === "react-native") return RNShim;
            if (name === "slidedev-nav") return NavShim;
            throw new Error("Module not available in preview: " + name);
          };
          new Function("module", "exports", "require", compiled)(mod, mod.exports, req);
          var Comp = mod.exports[entry] || mod.exports.default;
          if (!Comp) throw new Error("No export named " + entry + " or default found");
          errBox.style.display = "none";
          root.render(React.createElement(React.Fragment, null, React.createElement(Comp), React.createElement(AlertHost)));
          statusText.textContent = "updated";
        } catch (err) {
          errBox.textContent = String(err && err.stack || err);
          errBox.style.display = "block";
          statusText.textContent = "compile error";
        }
        size();
      }

      renderReady = function(code, entry){ lastCode = code; renderCode(code, entry); };
      if (pending) { renderReady(pending.code, pending.entry); }

      function poll(){
        if (!HASH) return;
        fetch(API_BASE + HASH, { cache: "no-store" }).then(function(r){
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
      poll();
      setInterval(poll, 2000);
    })
    .catch(function(err){
      errBox.textContent = String(err && err.stack || err);
      errBox.style.display = "block";
      statusText.textContent = "FAILED";
      size();
    });
</script></body></html>`;
}

const SNACK_API = "https://slidedev-snack-service.vercel.app/api/create-snack";

const NATIVE_NAV_SHIM = `
import * as __R from 'react';
import { View as __V } from 'react-native';
const __Ctx = __R.createContext(null);
const useNavigation = () => __R.useContext(__Ctx);
function StackNavigator(props) {
  const [stack, setStack] = __R.useState([{ key: 'root', Screen: props.initial }]);
  const nav = {
    push: (Screen, params) => setStack(s => s.concat([{ key: 's' + s.length, Screen, params }])),
    pop: () => setStack(s => (s.length > 1 ? s.slice(0, -1) : s)),
  };
  const top = stack[stack.length - 1];
  return (
    <__Ctx.Provider value={nav}>
      <__V style={{ flex: 1 }}>
        <top.Screen navigation={{ ...nav, params: top.params || {} }} />
      </__V>
    </__Ctx.Provider>
  );
}
`;

function toNativeCode(code: string, entry: string): string {
  let out = code.replace(/^\s*import[^;\n]*['"]slidedev-nav['"];?\s*$/gm, "");
  if (code.includes("slidedev-nav")) out = NATIVE_NAV_SHIM + out;
  if (!/export\s+default/.test(out)) out += `\nexport default ${entry};\n`;
  return out;
}

async function createExpoGoLink(code: string, entry: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(SNACK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: { "App.js": toNativeCode(code, entry) }, name: "SlideDev Preview" }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const d = (await r.json()) as { expUrl?: string; snackUrl?: string };
    return d.expUrl ?? d.snackUrl?.replace("https://snack.expo.dev/", "exp://exp.host/") ?? null;
  } catch {
    return null;
  }
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
      "ui://slidedev/preview.html",
      { mimeType: "text/html;profile=mcp-app" },
      async () => ({
        contents: [
          {
            uri: "ui://slidedev/preview.html",
            mimeType: "text/html;profile=mcp-app",
            text: buildPreviewHtml(),
            _meta: {
              ui: {
                prefersBorder: false,
                csp: {
                  resourceDomains: ["https://esm.sh"],
                  connectDomains: ["https://app.slidedevai.com"],
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
          "Renders React Native component code as a live, interactive iPhone preview inside the chat. Pass the full source of one file exporting the root component as default, or as a named export matching entryComponentName. Only 'react' and 'react-native' may be imported, no Expo packages, no third-party libraries. For multi-screen apps, import { StackNavigator, useNavigation } from 'slidedev-nav': wrap your app in <StackNavigator initial={HomeScreen} />, and inside any screen, call const nav = useNavigation() then nav.push(OtherScreen, params) or nav.pop(). Use Alert from 'react-native' for confirmations, it's fully supported here even though standard react-native-web doesn't implement it.",
        inputSchema: {
          code: z.string().describe("Full source code of the app, using only react and react-native imports"),
          entryComponentName: z.string().optional().describe("Name of the exported root component, defaults to 'App' or default export"),
        },
        _meta: { ui: { resourceUri: "ui://slidedev/preview.html" } },
      },
      async ({ code, entryComponentName }, extra) => {
        const userId = (extra.authInfo?.extra?.userId as string | undefined) ?? "anonymous";
        const entry = entryComponentName || "App";
        const [hash, expUrl] = await Promise.all([
          savePreview(userId, code, entry),
          createExpoGoLink(code, entry),
        ]);
        return {
          content: [{ type: "text", text: "Preview rendered." }],
          structuredContent: { hash, code, entry, expUrl },
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