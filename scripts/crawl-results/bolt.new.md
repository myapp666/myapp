{"revision":"f7b5f69","release":"f7b5f6916ad3a25513772faf57d3972ebe602569"}(function setMinViewport() { const MIN\_WIDTH = 360; const meta = document.querySelector('meta\[name="viewport"\]'); if (!meta) { return; } function update() { /\*\* \* Never let the layout drop below the min width: on narrower screens the \* browser scales the page down to fit instead of reflowing or scrolling. \*/ const width = Math.max(window.screen.width, MIN\_WIDTH); meta.setAttribute('content', 'width=' + width); } update(); window.addEventListener('resize', update); window.addEventListener('orientationchange', update); })(); Bolt AI builder: Websites, apps & prototypes{"@context":"https://schema.org","@type":"WebApplication","name":"Bolt.new","url":"https://bolt.new","applicationCategory":"DeveloperApplication","operatingSystem":"Web browser","description":"Build and scale high-performing websites \\u0026 apps using your words. Join millions and start building today.","browserRequirements":"Requires JavaScript. Requires HTML5.","image":"https://bolt.new/static/social\_preview\_index.jpg","publisher":{"@type":"Organization","name":"Bolt.new"},"offers":{"@type":"AggregateOffer","lowPrice":"0","highPrice":"30.00","priceCurrency":"USD","offerCount":"4","availability":"https://schema.org/InStock","url":"https://bolt.new/pricing"}}{"@context":"https://schema.org","@type":"Organization","name":"Bolt.new","alternateName":"Bolt","description":"Build and scale high-performing websites \\u0026 apps using your words. Join millions and start building today.","url":"https://bolt.new","logo":"https://bolt.new/bolt-logo.svg","sameAs":\["https://discord.com/invite/stackblitz","https://www.linkedin.com/company/boltdotnew/","https://x.com/boltdotnew","https://www.reddit.com/r/boltnewbuilders/","https://www.youtube.com/@BoltDotNew","https://www.instagram.com/boltdotnew/"\]}(function detectTheme() { const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; globalThis.prefersDark = prefersDark; const themeOption = document.documentElement.getAttribute('data-theme-option'); if (themeOption === 'system') { document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light'); } })(); (function createWorkaroundGlobal() { /\*\* \* A bug in wrangler injects a \_\_name call in these script tags. \* \* @see https://github.com/cloudflare/workers-sdk/issues/7107#issuecomment-2454829854 \*/ window\['\_\_' + 'name'\] = () => { // noop }; })(); // prevent modifications to the DOM until hydration is finished (function blockDOMMutations() { let allowed = false; const observer = new MutationObserver((mutations) => { observer.disconnect(); // we iterate backwards so that the oldValue is always correct by the end, in the case of simultaneous changes mutations.reverse().forEach((mutation) => { if (mutation.type === 'childList') { mutation.addedNodes.forEach((node) => { /\*\* \* Modifications to the head do not affect hydration (vite uses this for HMR styles). \* \* Nodes added as children of the body do not affect hydration (WebContainer uses this for the iframe). \*/ if (\[document.head, document.body, document.documentElement\].includes(node.parentNode)) { return; } if (node.parentNode) { node.parentNode.removeChild(node); } }); mutation.removedNodes.forEach((node) => { if (mutation.previousSibling) { mutation.target.insertBefore(node, mutation.previousSibling.nextSibling); } else if (mutation.target) { mutation.target.appendChild(node); } }); } if (mutation.type === 'attributes') { const { target, attributeName, oldValue } = mutation; if (attributeName) { if (oldValue === null) { target.removeAttribute(attributeName); } else { target.setAttribute(attributeName, oldValue); } } } if (mutation.type === 'characterData') { mutation.target.data = mutation.oldValue ?? ''; } }); observe(); }); function observe() { /\*\* \* Deferred module scripts (the client entry that calls \_\_allowDOMMutations and \* starts hydration) run BEFORE DOMContentLoaded. Without this guard the observer \* would re-arm here after hydration has already begun and revert React's own DOM \* writes, breaking hydration ("Root did not complete"). \*/ if (allowed) { return; } observer.observe(document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true, }); } window.addEventListener('DOMContentLoaded', observe); window.\_\_allowDOMMutations = () => { allowed = true; window.removeEventListener('DOMContentLoaded', observe); observer.disconnect(); window.\_\_loadingPrompt = document.querySelector('textarea')?.value; }; })();

[](/)

*   [Community](https://discord.com/invite/stackblitz)
*   [Enterprise](/enterprise)
*   Resources
*   [Careers](/careers)
*   [Pricing](/pricing)

*   [](https://discord.com/invite/stackblitz)
*   [](https://www.linkedin.com/company/boltdotnew/)
*   [](https://x.com/boltdotnew)
*   [](https://www.reddit.com/r/boltnewbuilders/)

Sign inGet started

# What will you build today?

Create stunning apps & websites by chatting with AI.

Let's build

Plan

Build now

or import from

FigmaGitHub

## Your company's design system, now in Bolt

![Porsche](/static/design-systems/brands/Porsche.png)

![Porsche](/api/design-systems/96de9aa8-2543-4658-aef6-abda7df52e2f/files/logo.webp)

### Porsche

Porsche Design System

![Material UI](</static/design-systems/brands/Material Design.png>)

![Material UI](/api/design-systems/c780062a-25f0-4a60-bdaf-c5b27da476fb/files/logo.webp)

### Material UI

Material Design

![Chakra](/static/design-systems/brands/Chakra.png)

![Chakra](/api/design-systems/e560d0e7-4fba-4857-a197-a03f50115e72/files/logo.webp)

### Chakra

Chakra UI

![Shadcn](/static/design-systems/brands/Shadcn.png)

![Shadcn](/api/design-systems/24db67f1-2979-4ee4-8881-1cf620ecf1e9/files/logo.webp)

### Shadcn

Shadcn UI

![Washington Post](/static/design-systems/brands/WAPO.png)

![Washington Post](/api/design-systems/8c0d5ecc-f2f4-486d-baee-8d50d61280ea/files/logo.webp)

### Washington Post

Washington Post Design System

## Use your team's components and brand guidelines to build for production

Try one of the examples above or get started with your own

[Learn more](https://support.bolt.new/building/design-system/introduction)

Import your design system

The #1 professional vibe coding tool trusted by

![](/static/marketing/homepage/value/glow.svg)

## Empowering product builders  
with the most powerful coding agents

Bolt does the heavy lifting for you, so you can focus on your vision instead of fighting errors.

### The best model, every time

Bolt automatically routes to the right model for each task, balancing quality and cost. No more juggling platforms or guessing which agent to use.

Bolt Agent

StandardAll users

MaxPro only

Standard

Recommended for general development.

*   SpeedHigh
*   IntelligenceHigh
*   Token costBalanced

98%

less errors

Bolt automatically tests, refactors, and iterates reducing errors so you keep building instead of fixing.

### Build big without breaking

Bolt handles projects 1,000 times larger than before. Its improved built-in context management can handle complexity and keep your projects running smoothly.

![](/static/marketing/homepage/value/build-without-breaking.png)

Build with ![your](/static/marketing/homepage/value/your-1.svg) design system

Stop building from scratch. Start building on-brand.

## Everything you need to scale Built in.

Stop stitching together platforms. Bolt Cloud gives you enterprise-grade backend infrastructure including hosting, databases, integrations and more.

### Unlimited databases

![](/static/marketing/homepage/features/unlimited-db.svg)

### Enterprise-grade

![](/static/marketing/homepage/features/graph.png)

### User Management & Authentication

![](/static/marketing/homepage/features/auth.svg)

### SEO optimization so your project ranks from day one.

![](/static/marketing/homepage/features/seo.svg)

### Hosting with analytics & custom domains

![](/static/marketing/homepage/features/publish.svg)

![Divider](/static/marketing/homepage/features/divider.svg)

Bolt gives you everything you need inside one familiar interface no extra accounts, no steep learning curve.

Whatever your role

## Bolt gives you superpowers

From idea to live product, Bolt adapts to the way you work turning every vision into something real & fast

### Product managers

Go from insight to prototype in hours and test ideas with your team before the day is over.

![](/static/marketing/homepage/personas/pm.svg)

### Entrepreneurs

Launch a full business in days, not months. From landing page to product, all in one flow.

![](/static/marketing/homepage/personas/entrepreneurs.svg)

### Marketers

Spin up high-performing campaign pages in hours, with SEO and hosting built in.

![](/static/marketing/homepage/personas/marketers.svg)

### Agencies

Multiply your impact: deliver more projects, faster, without scaling headcount.

![](/static/marketing/homepage/personas/agency.png)

### Students & builders

Learn by doing. Take ideas from class or side projects and turn them into fully working apps.

![](/static/marketing/homepage/personas/students.png)

## Ready to build something amazing?

Try it out and start building for free

Let's build

Plan

Build now

### Resources

*   [Pricing](/pricing)
*   [Support](https://support.bolt.new)
*   [Blog](/blog)
*   [Status](https://status.bolt.new)

### Company

*   [Careers](/careers)
*   [Privacy](https://stackblitz.com/privacy-policy)
*   [Terms](https://stackblitz.com/terms-of-service)

### Social

*   [Discord](https://discord.com/invite/stackblitz)
*   [LinkedIn](https://www.linkedin.com/company/boltdotnew/)
*   [YouTube](https://www.youtube.com/@BoltDotNew)
*   [Twitter/X](https://x.com/boltdotnew)
*   [Instagram](https://www.instagram.com/boltdotnew/)
*   [Reddit](https://www.reddit.com/r/boltnewbuilders/)

© 2026 StackBlitz - All rights reserved.

((STORAGE\_KEY3, restoreKey) => { if (!window.history.state || !window.history.state.key) { let key2 = Math.random().toString(32).slice(2); window.history.replaceState({ key: key2 }, ""); } try { let positions = JSON.parse(sessionStorage.getItem(STORAGE\_KEY3) || "{}"); let storedY = positions\[restoreKey || window.history.state.key\]; if (typeof storedY === "number") { window.scrollTo(0, storedY); } } catch (error7) { console.error(error7); sessionStorage.removeItem(STORAGE\_KEY3); } })("positions", null)window.\_\_remixContext = {"basename":"/","future":{"v3\_fetcherPersist":true,"v3\_relativeSplatPath":true,"v3\_throwAbortReason":true,"v3\_routeConfig":false,"v3\_singleFetch":true,"v3\_lazyRouteDiscovery":true,"unstable\_optimizeDeps":false},"isSpaMode":false};window.\_\_remixContext.stream = new ReadableStream({start(controller){window.\_\_remixContext.streamController = controller;}}).pipeThrough(new TextEncoderStream());; import \* as route0 from "/assets/root-D0v4L1Sj.js"; import \* as route1 from "/assets/\_chat-y4nNBieI.js"; import \* as route2 from "/assets/\_chat.\_index-C2CD4ZEJ.js"; window.\_\_remixManifest = { "entry": { "module": "/assets/entry.client-6BF\_A7zZ.js", "imports": \[ "/assets/react-vendor-eXveGTm0.js", "/assets/Toast-rt1SftC0.js", "/assets/EmptyState-CXTABFLt.js", "/assets/internal-CxQizVhm.js", "/assets/constants-BVvrI3gl.js", "/assets/sentry.client-B2czhc35.js", "/assets/performance-BrbW0GMs.js", "/assets/node-ompUHcan.js", "/assets/breadcrumbs-BvK0zds3.js", "/assets/bundle-mjs-5MOacnAK.js" \], "css": \[ "/assets/EmptyState-scVdpVyl.css" \] }, "routes": { "root": { "id": "root", "path": "", "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": true, "module": "/assets/root-D0v4L1Sj.js", "imports": \[ "/assets/react-vendor-eXveGTm0.js", "/assets/Toast-rt1SftC0.js", "/assets/EmptyState-CXTABFLt.js", "/assets/internal-CxQizVhm.js", "/assets/constants-BVvrI3gl.js", "/assets/sentry.client-B2czhc35.js", "/assets/performance-BrbW0GMs.js", "/assets/node-ompUHcan.js", "/assets/breadcrumbs-BvK0zds3.js", "/assets/bundle-mjs-5MOacnAK.js", "/assets/index-Dk9ImwWM.js", "/assets/stripIndents-pFh2tRUP.js", "/assets/compare-Br3z3FUS-gK8\_L3Nk.js", "/assets/client-only-Dr\_j\_YXk.js", "/assets/analytics-D7fdxS0S.js", "/assets/oauth-c4ry3v6q.js", "/assets/ErrorBoundary-MVOV-ffP.js", "/assets/growthbook-Cxy8XwQ8.js", "/assets/theme-CJU5zshU.js", "/assets/index-BksVgDcL.js", "/assets/login-BD8R8OD2.js", "/assets/settings-CThoD\_-u.js", "/assets/Alert-D70IFKqL.js", "/assets/cello-attribution-DUEq64JY.js", "/assets/login-CnDhu\_IL.js", "/assets/preload-helper-2mcYJXfA.js", "/assets/authFlowRoutes-0PvSSBdp.js", "/assets/cello-config-DYx1Gvkk.js", "/assets/queryClient-KUJ3ZMVh.js", "/assets/QueryClientProvider-D0MlixU1.js", "/assets/urls-CKc\_8Rby.js", "/assets/logger-D1LAYgtA.js", "/assets/index-DyxeRtzf.js", "/assets/Header-Bx7BdqwP.js", "/assets/config-BL\_OVB2I.js", "/assets/classNames-7O2R7-dU.js", "/assets/Logo-Brw-EMHu.js", "/assets/Link-Cg4FStYl.js", "/assets/Avatar-D2U\_1rBh.js", "/assets/store-C4c9zDQL.js", "/assets/index--OtwLk\_z.js", "/assets/ai-DkVHr5D1.js", "/assets/index-DRXXH9YX.js", "/assets/invariant-DO\_RTA5C.js", "/assets/chat-started-petdANlK.js", "/assets/noops-TSSrUl-c.js", "/assets/page-visibility-6WPc68Q5.js", "/assets/util-8UGItnT4.js", "/assets/url-x\_E2PVS\_.js", "/assets/index-BxE9UzoT.js", "/assets/text\_line\_stream-DtdTslVH.js", "/assets/chat-hooks-BNDj0LCI.js", "/assets/path-C47uQrgn.js", "/assets/download-rUGbmDk0.js", "/assets/plural-BsaMFzOq.js", "/assets/artifacts-DxQBXx56.js", "/assets/description-sReWbGaa.js", "/assets/unreachable-dJ0nIuQ4.js", "/assets/useDuplicateProject.client-4DTIVlZv.js", "/assets/useQuery-Bj2YS92G.js", "/assets/query-CEQQB\_8G.js", "/assets/LoadingDots-C0I6g8lo.js", "/assets/netlify-BCc7H3gW.js", "/assets/useMutation-Bc99gY5N.js", "/assets/mutation-Bzq65ZEs.js", "/assets/queryOptions-dfte2Pzq.js", "/assets/domains-BTgH6Wiz.js", "/assets/parse-domain-Djua73yQ.js", "/assets/withSpinner-DGE-K6ya.js", "/assets/openWithStackblitzAuth-B0DsTtM8.js", "/assets/menu-hvWWjZYm.js", "/assets/useProjectsOwnerContext-Bphv-Fya.js", "/assets/version-history-DIOvXljD.js", "/assets/useProjectRename-C\_DfjccL.js", "/assets/animationVariants-BB6l7uMr.js", "/assets/easings-\_f2BXEab.js", "/assets/teamTemplates-DytbZ7S1.js", "/assets/mutationOptions-DuEc1oJu.js", "/assets/LazyLoadWrapper-Dlw01QQW.js", "/assets/LightRays.client-CdDm\_afh.js", "/assets/LightRaysCore-DbJWbgkS.js", "/assets/LightRays.module-Bxd9H68z.js", "/assets/detectBrowser-DCyV7zrH.js", "/assets/LightRaysCloud-CJYtQy1T.js", "/assets/infiniteQueryBehavior-B-BAohMJ.js" \], "css": \[ "/assets/EmptyState-scVdpVyl.css", "/assets/root-CTaFUhGG.css", "/assets/LightRaysCloud-\_RGYDnNX.css", "/assets/LightRays-apN2LHcc.css" \] }, "routes/\_chat": { "id": "routes/\_chat", "parentId": "root", "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/\_chat-y4nNBieI.js", "imports": \[ "/assets/preload-helper-2mcYJXfA.js", "/assets/react-vendor-eXveGTm0.js", "/assets/index-Dk9ImwWM.js", "/assets/client-only-Dr\_j\_YXk.js", "/assets/EmptyState-CXTABFLt.js", "/assets/AgentSwitchDialog-BIth3pbu.js", "/assets/index-BksVgDcL.js", "/assets/Toast-rt1SftC0.js", "/assets/organizations-DMuKa4cy.js", "/assets/constants-BVvrI3gl.js", "/assets/useChatAgent-Cu2TdcGU.js", "/assets/MembersTable-BCPxMNjx.js", "/assets/designSystemStepper-BA4M0V3g.js", "/assets/persistentBanner-DsCAm9MO.js", "/assets/team-CQkcApEp.js", "/assets/classNames-7O2R7-dU.js", "/assets/withSpinner-DGE-K6ya.js", "/assets/analytics-D7fdxS0S.js", "/assets/oauth-c4ry3v6q.js", "/assets/settings-CThoD\_-u.js", "/assets/confetti-Bt3rUYAx.js", "/assets/Alert-D70IFKqL.js", "/assets/Skeletons-CP6rNA-O.js", "/assets/useDesignSystemDraft-wsFIDPeo.js", "/assets/useDesignSystems-D-cO8dRN.js", "/assets/useDuplicateProject.client-4DTIVlZv.js", "/assets/IndexLayout-jBO9tEN2.js", "/assets/config-BL\_OVB2I.js", "/assets/TransferProjectDialogContent-Dc0eTg5h.js", "/assets/urls-CKc\_8Rby.js", "/assets/menu-hvWWjZYm.js", "/assets/logger-D1LAYgtA.js", "/assets/useQuery-Bj2YS92G.js", "/assets/StripeLogo-YI31aQ22.js", "/assets/index--OtwLk\_z.js", "/assets/queryOptions-dfte2Pzq.js", "/assets/PricingSelector-Cl7MTbWA.js", "/assets/format-FBMKGxjf.js", "/assets/organizations-DdWmqBC3.js", "/assets/LazyLoadWrapper-Dlw01QQW.js", "/assets/meta-DIE13tBV.js", "/assets/noops-TSSrUl-c.js", "/assets/bundle-mjs-5MOacnAK.js", "/assets/invariant-DO\_RTA5C.js", "/assets/internal-CxQizVhm.js", "/assets/sentry.client-B2czhc35.js", "/assets/index-DRXXH9YX.js", "/assets/chat-started-petdANlK.js", "/assets/page-visibility-6WPc68Q5.js", "/assets/cello-attribution-DUEq64JY.js", "/assets/util-8UGItnT4.js", "/assets/url-x\_E2PVS\_.js", "/assets/index-BxE9UzoT.js", "/assets/chat-hooks-BNDj0LCI.js", "/assets/agent-C-Xd9Qdk.js", "/assets/SearchInput-B\_cja17d.js", "/assets/plural-BsaMFzOq.js", "/assets/ActionMenu-PxEylJNK.js", "/assets/useRequestUpgrade-C4fVS6\_R.js", "/assets/AccountDisplay-D8J8NW0Y.js", "/assets/Avatar-D2U\_1rBh.js", "/assets/plan-info-DKyspSDj.js", "/assets/ClippedTextTooltip-9hG6EVcc.js", "/assets/Pagination-pfqCG6r1.js", "/assets/usePaginatedData-Cv3O7cyw.js", "/assets/openWithStackblitzAuth-B0DsTtM8.js", "/assets/index-DyxeRtzf.js", "/assets/theme-CJU5zshU.js", "/assets/confetti.module-W9IyG\_S9.js", "/assets/QueryClientProvider-D0MlixU1.js", "/assets/useMutation-Bc99gY5N.js", "/assets/mutation-Bzq65ZEs.js", "/assets/designSystems-DqhpN8MD.js", "/assets/mutationOptions-DuEc1oJu.js", "/assets/index-CK9VEMO-.js", "/assets/LoadingDots-C0I6g8lo.js", "/assets/netlify-BCc7H3gW.js", "/assets/domains-BTgH6Wiz.js", "/assets/parse-domain-Djua73yQ.js", "/assets/Logo-Brw-EMHu.js", "/assets/Header-Bx7BdqwP.js", "/assets/login-CnDhu\_IL.js", "/assets/LightRaysCloud-CJYtQy1T.js", "/assets/login-BD8R8OD2.js", "/assets/detectBrowser-DCyV7zrH.js", "/assets/Link-Cg4FStYl.js", "/assets/store-C4c9zDQL.js", "/assets/description-sReWbGaa.js", "/assets/useProjectsOwnerContext-Bphv-Fya.js", "/assets/version-history-DIOvXljD.js", "/assets/useProjectRename-C\_DfjccL.js", "/assets/animationVariants-BB6l7uMr.js", "/assets/easings-\_f2BXEab.js", "/assets/teamTemplates-DytbZ7S1.js", "/assets/index-C8NWAjEj.js", "/assets/formatDistanceToNow-ChGI-9e1.js", "/assets/constructNow-YeRgAtJ7.js", "/assets/command-BhkWWsXT.js", "/assets/AccountSelector.client-DeK7goip.js", "/assets/teamPlans-CaGy3uol.js", "/assets/index-B-0uHRKW.js", "/assets/index-DH87RIIZ.js", "/assets/github-ClKg2Kz3.js", "/assets/cello-config-DYx1Gvkk.js", "/assets/authFlowRoutes-0PvSSBdp.js", "/assets/proctor-\_ZvEa-2Z.js", "/assets/init-ref-dwi0zPk7.js", "/assets/Sheet-5d30Cfbc.js", "/assets/subscription-NIML\_ASC.js", "/assets/useInitializeUserStore-ByeSOnV7.js", "/assets/growthbook-Cxy8XwQ8.js", "/assets/token-DqefYbQA.js", "/assets/AccountSelectMenu-DbbNSA5T.js", "/assets/query-CEQQB\_8G.js", "/assets/ai-DkVHr5D1.js", "/assets/text\_line\_stream-DtdTslVH.js", "/assets/path-C47uQrgn.js", "/assets/download-rUGbmDk0.js", "/assets/artifacts-DxQBXx56.js", "/assets/unreachable-dJ0nIuQ4.js" \], "css": \[ "/assets/EmptyState-scVdpVyl.css", "/assets/LightRaysCloud-\_RGYDnNX.css" \] }, "routes/\_chat.\_index": { "id": "routes/\_chat.\_index", "parentId": "routes/\_chat", "index": true, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/\_chat.\_index-C2CD4ZEJ.js", "imports": \[ "/assets/react-vendor-eXveGTm0.js", "/assets/index-ClU6054n.js", "/assets/client-only-Dr\_j\_YXk.js", "/assets/Chat.client-DKLpUHE5.js", "/assets/constants-BVvrI3gl.js", "/assets/index-BksVgDcL.js", "/assets/preload-helper-2mcYJXfA.js", "/assets/settings-CThoD\_-u.js", "/assets/index-DRXXH9YX.js", "/assets/logger-D1LAYgtA.js", "/assets/analytics-D7fdxS0S.js", "/assets/internal-CxQizVhm.js", "/assets/sentry.client-B2czhc35.js", "/assets/index-DyxeRtzf.js", "/assets/EmptyState-CXTABFLt.js", "/assets/bundle-mjs-5MOacnAK.js", "/assets/invariant-DO\_RTA5C.js", "/assets/Toast-rt1SftC0.js", "/assets/chat-started-petdANlK.js", "/assets/noops-TSSrUl-c.js", "/assets/page-visibility-6WPc68Q5.js", "/assets/index-d-16m4Nt.js", "/assets/index--OtwLk\_z.js", "/assets/ai-DkVHr5D1.js", "/assets/util-8UGItnT4.js", "/assets/url-x\_E2PVS\_.js", "/assets/index-BxE9UzoT.js", "/assets/text\_line\_stream-DtdTslVH.js", "/assets/store-C4c9zDQL.js", "/assets/chat-hooks-BNDj0LCI.js", "/assets/path-C47uQrgn.js", "/assets/download-rUGbmDk0.js", "/assets/plural-BsaMFzOq.js", "/assets/artifacts-DxQBXx56.js", "/assets/description-sReWbGaa.js", "/assets/unreachable-dJ0nIuQ4.js", "/assets/index-Dk9ImwWM.js", "/assets/index-B-0uHRKW.js", "/assets/index-DH87RIIZ.js", "/assets/stripIndents-pFh2tRUP.js", "/assets/Markdown-D4cy-TnQ.js", "/assets/Alert-D70IFKqL.js", "/assets/version-history-DIOvXljD.js", "/assets/theme-CJU5zshU.js", "/assets/classNames-7O2R7-dU.js", "/assets/index-DFRlLVKB.js", "/assets/easings-\_f2BXEab.js", "/assets/stripe-CdgHgpEh.js", "/assets/withSpinner-DGE-K6ya.js", "/assets/Link-Cg4FStYl.js", "/assets/deploy.client-DVpgfaKO.js", "/assets/UpgradeLink-BqTAcuWx.js", "/assets/team-CQkcApEp.js", "/assets/config-BL\_OVB2I.js", "/assets/openWithStackblitzAuth-B0DsTtM8.js", "/assets/cello-attribution-DUEq64JY.js", "/assets/organizations-DMuKa4cy.js", "/assets/useFreeTrialVariant-CfZWO233.js", "/assets/growthbook-Cxy8XwQ8.js", "/assets/SupabaseConfigurationDialog.client-Bb-RMLjj.js", "/assets/command-BhkWWsXT.js", "/assets/support-GFSpfcBW.js", "/assets/useQuery-Bj2YS92G.js", "/assets/QueryClientProvider-D0MlixU1.js", "/assets/query-CEQQB\_8G.js", "/assets/queryOptions-dfte2Pzq.js", "/assets/useMutation-Bc99gY5N.js", "/assets/mutation-Bzq65ZEs.js", "/assets/csv-DNicIMRr.js", "/assets/useApplications-9\_Zdpgs5.js", "/assets/Header-Bx7BdqwP.js", "/assets/login-CnDhu\_IL.js", "/assets/LightRaysCloud-CJYtQy1T.js", "/assets/login-BD8R8OD2.js", "/assets/oauth-c4ry3v6q.js", "/assets/detectBrowser-DCyV7zrH.js", "/assets/urls-CKc\_8Rby.js", "/assets/LoadingDots-C0I6g8lo.js", "/assets/Logo-Brw-EMHu.js", "/assets/Avatar-D2U\_1rBh.js", "/assets/useDuplicateProject.client-4DTIVlZv.js", "/assets/netlify-BCc7H3gW.js", "/assets/domains-BTgH6Wiz.js", "/assets/parse-domain-Djua73yQ.js", "/assets/menu-hvWWjZYm.js", "/assets/useProjectsOwnerContext-Bphv-Fya.js", "/assets/useProjectRename-C\_DfjccL.js", "/assets/animationVariants-BB6l7uMr.js", "/assets/teamTemplates-DytbZ7S1.js", "/assets/mutationOptions-DuEc1oJu.js", "/assets/LazyLoadWrapper-Dlw01QQW.js", "/assets/UpgradePlanDialogs-BPtH2KAF.js", "/assets/UpdatePlanScreenDialog-DSzX5uxF.js", "/assets/IntervalSelector-Bf02CfJw.js", "/assets/teamPlans-CaGy3uol.js", "/assets/format-FBMKGxjf.js", "/assets/PricingSelector-Cl7MTbWA.js", "/assets/tokens-stats-BWsF6vgl.js", "/assets/formatDistanceToNow-ChGI-9e1.js", "/assets/constructNow-YeRgAtJ7.js", "/assets/parseISO-uWjI\_NLy.js", "/assets/designSystemStepper-BA4M0V3g.js", "/assets/useDesignSystemDraft-wsFIDPeo.js", "/assets/AccountDisplay-D8J8NW0Y.js", "/assets/plan-info-DKyspSDj.js", "/assets/ClippedTextTooltip-9hG6EVcc.js", "/assets/AccountSelectMenu-DbbNSA5T.js", "/assets/DesignSources-B0WmWMrs.js", "/assets/zod-uOfdeKoh.js", "/assets/index.esm-COQ2djG-.js", "/assets/index-C1KrZpO9.js", "/assets/getDefaultOptions-Bk4D5Tfo.js", "/assets/TextArea-D-TM-Bov.js", "/assets/init-ref-dwi0zPk7.js", "/assets/ProgressBar-DG7cjs91.js", "/assets/ActionMenu-PxEylJNK.js", "/assets/confetti-Bt3rUYAx.js", "/assets/confetti.module-W9IyG\_S9.js", "/assets/useDesignSystems-D-cO8dRN.js", "/assets/designSystems-DqhpN8MD.js", "/assets/index-CK9VEMO-.js", "/assets/ConfirmationDialog.client-Wf3i64I8.js", "/assets/Prompt-CGlYtC3Z.js", "/assets/scroll-overflow-mask-CZucQH8U.js", "/assets/useChatAgent-Cu2TdcGU.js", "/assets/agent-C-Xd9Qdk.js", "/assets/index-CSDK1fVY.js", "/assets/store-Bz\_dBazl.js", "/assets/selectors-BtGCP55w.js", "/assets/Sheet-5d30Cfbc.js", "/assets/subscription-NIML\_ASC.js", "/assets/useSelectedDesignSystem-D1Fpn8rg.js", "/assets/mcp-known-servers-BlA0p\_Q5.js", "/assets/mcp-CsaMrE2y.js", "/assets/useEnsureSkillsLoaded-DQTqGwZR.js", "/assets/persistentBanner-DsCAm9MO.js", "/assets/ConnectToFigmaDialog-b-NAykZB.js", "/assets/StripeLogo-YI31aQ22.js", "/assets/useTokenRefresh-DYwZveT\_.js", "/assets/token-DqefYbQA.js", "/assets/DiscordSupportModal.client-CN7NNQVP.js", "/assets/AgentSwitchDialog-BIth3pbu.js", "/assets/utils-BQ1d7oeD.js", "/assets/useTrackOnMount-DxUT8cJg.js", "/assets/compare-Br3z3FUS-gK8\_L3Nk.js", "/assets/SearchInput-B\_cja17d.js", "/assets/proctor-\_ZvEa-2Z.js", "/assets/differenceInDays-CjuB2\_vd.js", "/assets/isYesterday-Bt7an-ey.js", "/assets/addDays-Dj4c5Qpv.js", "/assets/TransferProjectDialogContent-Dc0eTg5h.js", "/assets/sso-tTgddE69.js", "/assets/AllProjects-ktox5sTf.js", "/assets/FiltersBar-52iIwQbW.js", "/assets/Pagination-pfqCG6r1.js", "/assets/RecentProjects-BDVXnTb5.js", "/assets/github-ClKg2Kz3.js", "/assets/cello-config-DYx1Gvkk.js", "/assets/authFlowRoutes-0PvSSBdp.js", "/assets/ErrorBoundary-MVOV-ffP.js", "/assets/LightRays.client-CdDm\_afh.js", "/assets/LightRaysCore-DbJWbgkS.js", "/assets/LightRays.module-Bxd9H68z.js", "/assets/node-ompUHcan.js", "/assets/queryClient-KUJ3ZMVh.js", "/assets/infiniteQueryBehavior-B-BAohMJ.js", "/assets/useProjectCollaborationV2-C72xT7S7.js", "/assets/usePaginatedData-Cv3O7cyw.js", "/assets/sheetNavigation-CAGP4vRq.js", "/assets/command-D\_9BAQ71.js", "/assets/index-C8NWAjEj.js", "/assets/chart-xeys2b04.js", "/assets/serialize-messages-BES-Yqxi.js", "/assets/client-error-DejbHZY5.js", "/assets/theme-CaxmedKW.js", "/assets/unpublish-project-BT9BczV9.js", "/assets/organizationMembers-pejtmAFd.js", "/assets/organizations-DdWmqBC3.js", "/assets/breadcrumbs-BvK0zds3.js", "/assets/mcp-oauth-listener-B6O6vkRQ.js", "/assets/index-C\_s9gSTi.js", "/assets/prepare-body-DYGx4hdI.js", "/assets/usePaymentIntentStatusMessage-BIWQRdUl.js" \], "css": \[ "/assets/Chat-Czbss2A6.css", "/assets/EmptyState-scVdpVyl.css", "/assets/Markdown-Cy6kMErP.css", "/assets/LightRaysCloud-\_RGYDnNX.css", "/assets/Prompt-BAuldNfg.css", "/assets/LightRays-apN2LHcc.css" \] } }, "url": "/assets/manifest-a9c41f52.js", "version": "a9c41f52" }; window.\_\_remixRouteModules = {"root":route0,"routes/\_chat":route1,"routes/\_chat.\_index":route2}; import("/assets/entry.client-6BF\_A7zZ.js");window.\_\_remixContext.streamController.enqueue("\[{\\"\_1\\":2,\\"\_358\\":-5,\\"\_359\\":-5},\\"loaderData\\",{\\"\_3\\":4,\\"\_290\\":291,\\"\_357\\":-5},\\"root\\",{\\"\_5\\":-7,\\"\_6\\":7,\\"\_261\\":262,\\"\_270\\":-5,\\"\_271\\":-5,\\"\_272\\":273,\\"\_274\\":275,\\"\_276\\":277,\\"\_284\\":15,\\"\_285\\":15,\\"\_286\\":287,\\"\_288\\":289},\\"banner\\",\\"growthbookPayload\\",{\\"\_8\\":9,\\"\_10\\":11,\\"\_257\\":258,\\"\_259\\":260},\\"status\\",200,\\"features\\",{\\"\_12\\":13,\\"\_54\\":55,\\"\_56\\":57,\\"\_58\\":59,\\"\_61\\":62,\\"\_63\\":64,\\"\_71\\":72,\\"\_92\\":93,\\"\_131\\":132,\\"\_172\\":173,\\"\_198\\":199,\\"\_219\\":220,\\"\_238\\":239},\\"insta-teams\\",{\\"\_14\\":15,\\"\_16\\":17},\\"defaultValue\\",false,\\"rules\\",\[18\],{\\"\_19\\":20,\\"\_21\\":22,\\"\_27\\":28,\\"\_29\\":30,\\"\_31\\":32,\\"\_35\\":36,\\"\_37\\":38,\\"\_39\\":40,\\"\_42\\":43,\\"\_45\\":46,\\"\_47\\":48,\\"\_53\\":50},\\"id\\",\\"fr\_19g6smq6mtc2b\\",\\"condition\\",{\\"\_23\\":24},\\"createdAt\\",{\\"\_25\\":26},\\"$gt\\",\\"2026-06-09T09:43\\",\\"coverage\\",1,\\"hashAttribute\\",\\"email\\",\\"namespace\\",\[33,34,28\],\\"ns-19g6smm9ksjuu\\",0.95,\\"seed\\",\\"0921cd29-b3b2-4aa9-8816-dd749413bc02\\",\\"hashVersion\\",2,\\"variations\\",\[15,41\],true,\\"weights\\",\[44,44\],0.5,\\"key\\",\\"insta-teams\_june-re-launch\\",\\"meta\\",\[49,51\],{\\"\_45\\":50},\\"0\\",{\\"\_45\\":52},\\"1\\",\\"phase\\",\\"team-aware-switcher\\",{\\"\_14\\":15},\\"plan-mode-enable\\",{\\"\_14\\":15},\\"free-tier-experiment-group\\",{\\"\_14\\":60},\\"OFF\\",\\"free-trial-popup\\",{\\"\_14\\":60},\\"free-tier-min-messages-per-day\\",{\\"\_14\\":65,\\"\_16\\":66},0,\[67\],{\\"\_19\\":68,\\"\_69\\":70},\\"fr\_mpx0zzuq\\",\\"force\\",3,\\"anthropic-model-provider\\",{\\"\_14\\":73,\\"\_16\\":74},\\"anthropic\\",\[75\],{\\"\_19\\":76,\\"\_27\\":28,\\"\_29\\":30,\\"\_77\\":78,\\"\_35\\":79,\\"\_37\\":38,\\"\_39\\":80,\\"\_42\\":83,\\"\_45\\":71,\\"\_47\\":86,\\"\_53\\":91},\\"fr\_19g6rmpd0xd9h\\",\\"bucketVersion\\",6,\\"fe53f041-77c0-461e-adb6-11a769a6f071\\",\[73,81,82\],\\"bedrock\\",\\"foundry\\",\[65,84,85\],0.9,0.1,\[87,88,89\],{\\"\_45\\":50},{\\"\_45\\":52},{\\"\_45\\":90},\\"2\\",\\"6\\",\\"glm-5-1-provider\\",{\\"\_14\\":94,\\"\_16\\":95},\\"baseten\\",\[96\],{\\"\_19\\":97,\\"\_21\\":98,\\"\_27\\":28,\\"\_29\\":30,\\"\_77\\":100,\\"\_35\\":101,\\"\_37\\":38,\\"\_39\\":102,\\"\_42\\":104,\\"\_45\\":108,\\"\_47\\":109,\\"\_53\\":130},\\"fr\_19g6smqikil4k\\",{\\"\_99\\":15},\\"isPaid\\",21,\\"dbade002-03dd-4e14-adf4-494a33f65930\\",\[94,94,94,94,94,94,94,94,103,94\],\\"fireworks\\",\[65,65,105,44,106,65,65,107,65,105\],0.05,0.25,0.15,\\"free-tier-model-provider-harness-2\\",\[110,112,114,116,118,120,122,124,126,128\],{\\"\_45\\":111},\\"SH\\",{\\"\_45\\":113},\\"S2\\",{\\"\_45\\":115},\\"S3\\",{\\"\_45\\":117},\\"G-B\\",{\\"\_45\\":119},\\"G2-B\\",{\\"\_45\\":121},\\"K-B\\",{\\"\_45\\":123},\\"G2S-B\\",{\\"\_45\\":125},\\"G2-FFW\\",{\\"\_45\\":127},\\"K-FW\\",{\\"\_45\\":129},\\"G2-B-v2\\",\\"21\\",\\"standard-model-routing\\",{\\"\_14\\":133,\\"\_16\\":136},{\\"\_134\\":135},\\"default\\",\\"claude-sonnet-4-6\\",\[137,168\],{\\"\_19\\":138,\\"\_21\\":139,\\"\_27\\":28,\\"\_29\\":30,\\"\_77\\":100,\\"\_35\\":101,\\"\_37\\":38,\\"\_39\\":140,\\"\_42\\":156,\\"\_45\\":108,\\"\_47\\":157,\\"\_53\\":130},\\"fr\_19g6smqik6g8r\\",{\\"\_99\\":15},\[141,144,145,146,148,150,152,153,154,155\],{\\"\_134\\":135,\\"\_142\\":143},\\"followup\\",\\"claude-haiku-4-5-20251001\\",{\\"\_134\\":135},{\\"\_134\\":135},{\\"\_134\\":147},\\"zai-org/GLM-5.1\\",{\\"\_134\\":149},\\"zai-org/GLM-5.2\\",{\\"\_134\\":151},\\"moonshotai/Kimi-K2.6\\",{\\"\_134\\":149,\\"\_142\\":135},{\\"\_134\\":149},{\\"\_134\\":151},{\\"\_134\\":149},\[65,65,105,44,106,65,65,107,65,105\],\[158,159,160,161,162,163,164,165,166,167\],{\\"\_45\\":111},{\\"\_45\\":113},{\\"\_45\\":115},{\\"\_45\\":117},{\\"\_45\\":119},{\\"\_45\\":121},{\\"\_45\\":123},{\\"\_45\\":125},{\\"\_45\\":127},{\\"\_45\\":129},{\\"\_19\\":169,\\"\_21\\":170,\\"\_69\\":171},\\"fr\_mpyc7gxd\\",{\\"\_99\\":15},{\\"\_134\\":135,\\"\_142\\":143},\\"max-model-routing\\",{\\"\_14\\":174,\\"\_16\\":176},{\\"\_134\\":175},\\"claude-opus-4-6\\",\[177\],{\\"\_19\\":178,\\"\_21\\":179,\\"\_27\\":28,\\"\_29\\":19,\\"\_77\\":38,\\"\_35\\":180,\\"\_37\\":38,\\"\_39\\":181,\\"\_42\\":189,\\"\_45\\":191,\\"\_47\\":192,\\"\_53\\":197},\\"fr\_19g6smq178k71\\",{\\"\_99\\":41},\\"7c1fe5f2-453a-4feb-b3f0-e8420576fad0\\",\[182,183,185,187\],{\\"\_134\\":175},{\\"\_134\\":184},\\"claude-opus-4-7\\",{\\"\_134\\":186},\\"claude-opus-4-8\\",{\\"\_134\\":188},\\"claude-fable-5\\",\[190,85,85,105\],0.75,\\"max-agent-underlying-model\\",\[193,194,195,196\],{\\"\_45\\":50},{\\"\_45\\":52},{\\"\_45\\":90},{\\"\_45\\":197},\\"3\\",\\"harness\\",{\\"\_14\\":200,\\"\_16\\":201},\\"v2\\",\[202\],{\\"\_19\\":203,\\"\_21\\":204,\\"\_27\\":28,\\"\_29\\":30,\\"\_77\\":100,\\"\_35\\":101,\\"\_37\\":38,\\"\_39\\":205,\\"\_42\\":207,\\"\_45\\":108,\\"\_47\\":208,\\"\_53\\":130},\\"fr\_19g6smqikgh25\\",{\\"\_99\\":15},\[200,200,206,200,206,206,206,206,206,200\],\\"v3\\",\[65,65,105,44,106,65,65,107,65,105\],\[209,210,211,212,213,214,215,216,217,218\],{\\"\_45\\":111},{\\"\_45\\":113},{\\"\_45\\":115},{\\"\_45\\":117},{\\"\_45\\":119},{\\"\_45\\":121},{\\"\_45\\":123},{\\"\_45\\":125},{\\"\_45\\":127},{\\"\_45\\":129},\\"kimi-k2-6-provider\\",{\\"\_14\\":94,\\"\_16\\":221},\[222\],{\\"\_19\\":223,\\"\_21\\":224,\\"\_27\\":28,\\"\_29\\":30,\\"\_77\\":100,\\"\_35\\":101,\\"\_37\\":38,\\"\_39\\":225,\\"\_42\\":226,\\"\_45\\":108,\\"\_47\\":227,\\"\_53\\":130},\\"fr\_19g6smqikhr1d\\",{\\"\_99\\":15},\[94,94,94,94,94,94,94,94,103,94\],\[65,65,105,44,106,65,65,107,65,105\],\[228,229,230,231,232,233,234,235,236,237\],{\\"\_45\\":111},{\\"\_45\\":113},{\\"\_45\\":115},{\\"\_45\\":117},{\\"\_45\\":119},{\\"\_45\\":121},{\\"\_45\\":123},{\\"\_45\\":125},{\\"\_45\\":127},{\\"\_45\\":129},\\"glm-5-2-provider\\",{\\"\_14\\":94,\\"\_16\\":240},\[241\],{\\"\_19\\":242,\\"\_21\\":243,\\"\_27\\":28,\\"\_29\\":30,\\"\_77\\":100,\\"\_35\\":101,\\"\_37\\":38,\\"\_39\\":244,\\"\_42\\":245,\\"\_45\\":108,\\"\_47\\":246,\\"\_53\\":130},\\"fr\_mr0w5w9k\\",{\\"\_99\\":15},\[94,94,94,94,94,94,94,82,94,94\],\[65,65,105,44,106,65,65,107,65,105\],\[247,248,249,250,251,252,253,254,255,256\],{\\"\_45\\":111},{\\"\_45\\":113},{\\"\_45\\":115},{\\"\_45\\":117},{\\"\_45\\":119},{\\"\_45\\":121},{\\"\_45\\":123},{\\"\_45\\":125},{\\"\_45\\":127},{\\"\_45\\":129},\\"experiments\\",\[\],\\"dateUpdated\\",\\"2026-07-08T13:37:28.757Z\\",\\"latestReleaseNote\\",{\\"\_19\\":263,\\"\_264\\":265,\\"\_266\\":267,\\"\_268\\":269},\\"3d3db4bdaad3290a\\",\\"title\\",\\"June 20 - 29\\",\\"url\\",\\"https://support.bolt.new/release-notes#june-20-29\\",\\"publishedAt\\",\\"2026-06-29T14:14:36.000Z\\",\\"user\\",\\"token\\",\\"serverTime\\",\\"2026-07-09T17:00:50.570Z\\",\\"country\\",\\"HK\\",\\"cello\\",{\\"\_278\\":15,\\"\_279\\":41,\\"\_280\\":281,\\"\_282\\":283},\\"enabled\\",\\"configured\\",\\"scriptSrc\\",\\"https://assets.cello.so/app/latest/cello.js\\",\\"attributionScriptSrc\\",\\"https://assets.cello.so/attribution/latest/cello-attribution.js\\",\\"isMobileExperience\\",\\"sidebarCollapsed\\",\\"swk\\",\\"ta1kDK49qdEDEfd8KYxI37mW0GPkLKn1\\",\\"gbk\\",\\"sdk-ye5YC6vB6I5SoRX\\",\\"routes/\_chat\\",{\\"\_270\\":-5,\\"\_292\\":293},\\"publicDesignSystems\\",\[294,311,320,329,339,348\],{\\"\_19\\":295,\\"\_296\\":297,\\"\_298\\":299,\\"\_300\\":301},\\"e560d0e7-4fba-4857-a197-a03f50115e72\\",\\"name\\",\\"Chakra\\",\\"logoUrl\\",\\"/api/design-systems/e560d0e7-4fba-4857-a197-a03f50115e72/files/logo.webp\\",\\"publicMetadata\\",{\\"\_302\\":303,\\"\_304\\":305},\\"type\\",\\"open-source\\",\\"prompts\\",\[306\],{\\"\_307\\":308,\\"\_309\\":310},\\"text\\",\\"Build a movie streaming web app\\",\\"replayId\\",\\"abe042b0-1514-4f5f-999c-47611556dd5a\\",{\\"\_19\\":312,\\"\_296\\":313,\\"\_298\\":314,\\"\_300\\":315},\\"c780062a-25f0-4a60-bdaf-c5b27da476fb\\",\\"Material UI\\",\\"/api/design-systems/c780062a-25f0-4a60-bdaf-c5b27da476fb/files/logo.webp\\",{\\"\_302\\":303,\\"\_304\\":316},\[317\],{\\"\_307\\":318,\\"\_309\\":319},\\"Build a Google Drive dashboard\\",\\"cf113b81-bbe3-4168-b53f-7fa2696bceeb\\",{\\"\_19\\":321,\\"\_296\\":322,\\"\_298\\":323,\\"\_300\\":324},\\"24db67f1-2979-4ee4-8881-1cf620ecf1e9\\",\\"Shadcn\\",\\"/api/design-systems/24db67f1-2979-4ee4-8881-1cf620ecf1e9/files/logo.webp\\",{\\"\_302\\":303,\\"\_304\\":325},\[326\],{\\"\_307\\":327,\\"\_309\\":328},\\"Build an appointment booking landing page\\",\\"eb619f11-6227-41d2-a63e-f34d2f723546\\",{\\"\_19\\":330,\\"\_296\\":331,\\"\_298\\":332,\\"\_300\\":333},\\"8c0d5ecc-f2f4-486d-baee-8d50d61280ea\\",\\"Washington Post\\",\\"/api/design-systems/8c0d5ecc-f2f4-486d-baee-8d50d61280ea/files/logo.webp\\",{\\"\_302\\":334,\\"\_304\\":335},\\"corporate\\",\[336\],{\\"\_307\\":337,\\"\_309\\":338},\\"Build a news blog\\",\\"2f69f91d-24f2-452b-8619-f8a4c29d1889\\",{\\"\_19\\":340,\\"\_296\\":341,\\"\_298\\":342,\\"\_300\\":343},\\"c2cae65c-e390-4bba-989e-4ddf6f0be5ca\\",\\"AWS Cloudscape\\",\\"/api/design-systems/c2cae65c-e390-4bba-989e-4ddf6f0be5ca/files/logo.webp\\",{\\"\_302\\":334,\\"\_304\\":344},\[345\],{\\"\_307\\":346,\\"\_309\\":347},\\"Build a management dashboard for a database service\\",\\"a63d181f-7693-4862-b1c8-ad8f7244c7bb\\",{\\"\_19\\":349,\\"\_296\\":350,\\"\_298\\":351,\\"\_300\\":352},\\"96de9aa8-2543-4658-aef6-abda7df52e2f\\",\\"Porsche\\",\\"/api/design-systems/96de9aa8-2543-4658-aef6-abda7df52e2f/files/logo.webp\\",{\\"\_302\\":334,\\"\_304\\":353},\[354\],{\\"\_307\\":355,\\"\_309\\":356},\\"Build a landing page for the Porsche GT3 RS\\",\\"68fab858-6204-4f09-99b9-8371d504df2e\\",\\"routes/\_chat.\_index\\",\\"actionData\\",\\"errors\\"\]\\n");window.\_\_remixContext.streamController.close();