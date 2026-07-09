Refine: Build Enterprise Grade Internal Tools With AI window.dataLayer = window.dataLayer || \[\]; function gtag(){dataLayer.push(arguments);} // gtag.js reads queued dataLayer commands when it loads. gtag('consent', 'default', { 'ad\_storage': 'denied', 'ad\_user\_data': 'denied', 'ad\_personalization': 'denied', 'analytics\_storage': 'denied', 'functionality\_storage': 'denied', 'personalization\_storage': 'denied', 'security\_storage': 'granted', 'wait\_for\_update': 500 }); gtag('set', 'ads\_data\_redaction', true); gtag('set', 'url\_passthrough', true); (function(w,d,s,l,i){w\[l\]=w\[l\]||\[\];w\[l\].push({'gtm.start': new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)\[0\], j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src= 'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f); })(window,document,'script','dataLayer','GTM-TPCTPDFK');

!function(){try{var d=document.documentElement,c=d.classList;c.remove('light','dark');var e=localStorage.getItem('theme');if('system'===e||(!e&&false)){var t='(prefers-color-scheme: dark)',m=window.matchMedia(t);if(m.media!==t||m.matches){d.style.colorScheme = 'dark';c.add('dark')}else{d.style.colorScheme = 'light';c.add('light')}}else if(e){c.add(e|| '')}else{c.add('dark')}if(e==='light'||e==='dark'||!e)d.style.colorScheme=e||'dark'}catch(e){}}()

:root { --bprogress-color: hsl(var(--primary)); --bprogress-height: 2px; --bprogress-spinner-size: 18px; --bprogress-spinner-animation-duration: 400ms; --bprogress-spinner-border-size: 2px; --bprogress-box-shadow: 0 0 10px hsl(var(--primary)), 0 0 5px hsl(var(--primary)); --bprogress-z-index: 99999; --bprogress-spinner-top: 15px; --bprogress-spinner-bottom: auto; --bprogress-spinner-right: 15px; --bprogress-spinner-left: auto; } .bprogress { width: 0; height: 0; pointer-events: none; z-index: var(--bprogress-z-index); } .bprogress .bar { background: var(--bprogress-color); position: fixed; z-index: var(--bprogress-z-index); top: 0; left: 0; width: 100%; height: var(--bprogress-height); } /\* Fancy blur effect \*/ .bprogress .peg { display: block; position: absolute; right: 0; width: 100px; height: 100%; box-shadow: var(--bprogress-box-shadow); opacity: 1.0; transform: rotate(3deg) translate(0px, -4px); } /\* Remove these to get rid of the spinner \*/ .bprogress .spinner { display: block; position: fixed; z-index: var(--bprogress-z-index); top: var(--bprogress-spinner-top); bottom: var(--bprogress-spinner-bottom); right: var(--bprogress-spinner-right); left: var(--bprogress-spinner-left); } .bprogress .spinner-icon { width: var(--bprogress-spinner-size); height: var(--bprogress-spinner-size); box-sizing: border-box; border: solid var(--bprogress-spinner-border-size) transparent; border-top-color: var(--bprogress-color); border-left-color: var(--bprogress-color); border-radius: 50%; -webkit-animation: bprogress-spinner var(--bprogress-spinner-animation-duration) linear infinite; animation: bprogress-spinner var(--bprogress-spinner-animation-duration) linear infinite; } .bprogress-custom-parent { overflow: hidden; position: relative; } .bprogress-custom-parent .bprogress .spinner, .bprogress-custom-parent .bprogress .bar { position: absolute; } .bprogress .indeterminate { position: fixed; top: 0; left: 0; width: 100%; height: var(--bprogress-height); overflow: hidden; } .bprogress .indeterminate .inc, .bprogress .indeterminate .dec { position: absolute; top: 0; height: 100%; background-color: var(--bprogress-color); } .bprogress .indeterminate .inc { animation: bprogress-indeterminate-increase 2s infinite; } .bprogress .indeterminate .dec { animation: bprogress-indeterminate-decrease 2s 0.5s infinite; } @-webkit-keyframes bprogress-spinner { 0% { -webkit-transform: rotate(0deg); transform: rotate(0deg); } 100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); } } @keyframes bprogress-spinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } @keyframes bprogress-indeterminate-increase { from { left: -5%; width: 5%; } to { left: 130%; width: 100%; } } @keyframes bprogress-indeterminate-decrease { from { left: -80%; width: 80%; } to { left: 110%; width: 10%; } }

[

RefineRefine

## Refine



](/)

[Use cases](/use-cases/)[Pricing](/pricing/)[Blog](/blog/)[About](/about/)

[

Refine Core

](/core/)

[

Refine/ops

New

](https://ops.refine.dev)

Menu

[Refine CoreRefine Core](/core/)

# Internal software at the speed of AI

Turn your APIs into production-grade, React-based internal apps.

Frame Inner Corner top-rightFrame Inner Corner bottom-rightFrame Inner Corner bottom-leftFrame Inner Corner top-left

V Shape Glow

Send

SupabaseConnect to SupabaseREST APIConnect to Rest API

## How does it work?

Flexible enough for vibe coding, precise enough for spec-driven development.

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right![01\. BRING YOUR OWN DATA](https://refine.ams3.cdn.digitaloceanspaces.com/refine-ai/landing/c/describe-your-backend.webp)

### 01\. BRING YOUR OWN DATA

Connect to your existing REST APIs or Supabase projects.

No backend yet? Start vibe coding now and publish whenever you're ready.

Frame Inner Corner top-leftFrame Inner Corner top-right![01\. BRING YOUR OWN DATA](https://refine.ams3.cdn.digitaloceanspaces.com/refine-ai/landing/c/describe-your-backend.webp)

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right

### 01\. BRING YOUR OWN DATA

Connect to your existing REST APIs or Supabase projects.

No backend yet? Start vibe coding now and publish whenever you're ready.

### 02\. analyze & plan

Refine analyzes your backend to create a blueprint for our AI agents. This context ensures they generate precise, error-free code that perfectly aligns with your data model.

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right![02\. analyze & plan](https://refine.ams3.cdn.digitaloceanspaces.com/refine-ai/landing/c/data-structure-analysis.webp)

![02\. analyze & plan](https://refine.ams3.cdn.digitaloceanspaces.com/refine-ai/landing/c/data-structure-analysis.webp)

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right

### 02\. analyze & plan

Refine analyzes your backend to create a blueprint for our AI agents. This context ensures they generate precise, error-free code that perfectly aligns with your data model.

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right![03\. Preview & Modify](https://refine.ams3.cdn.digitaloceanspaces.com/refine-ai/landing/c/preview-and-modify.webp)

### 03\. Preview & Modify

Develop your app on our Web IDE. Vibe code with AI or inspect your codebase as you wish.

![03\. Preview & Modify](https://refine.ams3.cdn.digitaloceanspaces.com/refine-ai/landing/c/preview-and-modify.webp)

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right

### 03\. Preview & Modify

Develop your app on our Web IDE. Vibe code with AI or inspect your codebase as you wish.

### 04\. Download or publish

Get your app with pure React code, no black box and it’s yours alone. Or, publish your app wherever you want.

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-left![04\. Download or publish](https://refine.ams3.cdn.digitaloceanspaces.com/refine-ai/landing/c/download-or-deploy.webp)

![04\. Download or publish](https://refine.ams3.cdn.digitaloceanspaces.com/refine-ai/landing/c/download-or-deploy.webp)

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right

### 04\. Download or publish

Get your app with pure React code, no black box and it’s yours alone. Or, publish your app wherever you want.

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right

[Start for free!](/start/)

## Showcase

Refine supports a wide range of use cases. Teams use it to build admin dashboards, CRM and CMS platforms, HR systems, customer ops and project tools, often replacing third-party SaaS solutions.

Whether you’re building a simple admin panel or an enterprise portal, Refine helps you create software that scales with your business.

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right

CRM ApplicationE-Commerce ApplicationHR ApplicationDevOps Dashboard

Showcase Image

[See live demo](https://example.crm.refine.dev)

[See live demoArrow Right Icon

](https://example.crm.refine.dev)

## Enterprise developersHeartRefine

Refine is designed to target the specific pain points of larger organizations by giving top priority to security.

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-rightFrame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner top-leftFrame Inner Corner top-right

Self Hosted

### Self-host for compliance

Publish on your own infrastructure without worrying about regulations, performance, and stability. Maintain your current security best practices with no compromises.

Frame Inner Corner top-leftFrame Inner Corner bottom-leftFrame Inner Corner bottom-rightFrame Inner Corner bottom-rightFrame Inner Corner top-rightFrame Inner Corner top-leftFrame Inner Corner top-right

Identity

### Leverage the power of your existing Identity Provider

Native support for Okta, Azure AD, Amazon Cognito & Google Cloud Identity.

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-rightFrame Inner Corner top-rightFrame Inner Corner top-leftFrame Inner Corner top-right

Access Control

### Achieve fine-grained access control

Out-of-the-box support for widely accepted authorization models including ACL, RBAC & ABAC.

Frame Inner Corner top-leftFrame Inner Corner bottom-leftFrame Inner Corner bottom-rightFrame Inner Corner bottom-rightFrame Inner Corner top-leftFrame Inner Corner top-right

Black Box

### Unlock the black box

Implement an open-source solution with an open architecture. Save yourself from the hassle of adding another proprietary component to your stack.

Frame Inner Corner bottom-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-rightFrame Inner Corner top-leftFrame Inner Corner top-right

Monitor

### Effortlessly monitor your application

Ready-made providers and components for audit logging and usage analytics.

Frame Inner Corner top-rightFrame Inner Corner bottom-rightFrame Inner Corner bottom-rightFrame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right

Support

### Get supported by the experts

Enroll in plans that provide priority support, trainings and consulting.

Frame Inner Corner bottom-leftFrame Inner Corner bottom-right

[

Contact us for enterprise Solutions

](mailto:info@refine.dev)

## The difference that Refine makes

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-rightFrame Inner Corner bottom-right

I find CRUD boring, but Refine makes it fun for developers again!

[![Zeno Rocha](https://refine.ams3.cdn.digitaloceanspaces.com/website/static/assets/testimonials/zeno-rocha.png)

Zeno Rocha

CEO - Resend



](https://twitter.com/zenorocha)

Frame Inner Corner top-leftFrame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-rightFrame Inner Corner bottom-right

Refine perfectly aligns with the philosophy of React Hook Form, and they work seamlessly together.

[![Beier Luo](https://refine.ams3.cdn.digitaloceanspaces.com/website/static/assets/testimonials/beier-luo.png)

Beier Luo

Author of React Hook Form



](https://twitter.com/HookForm)

Frame Inner Corner top-leftFrame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-rightFrame Inner Corner bottom-left

Refine has codemod support for major version transitions, making it easy for users to integrate new versions into their existing codebases seamlessly.

[![Daniel Del Core](https://refine.ams3.cdn.digitaloceanspaces.com/website/static/assets/testimonials/daniel-del-core.png)

Daniel Del Core

Sr. Software Engineer at Atlassian



](https://twitter.com/danieldelcore)

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-rightFrame Inner Corner bottom-right

I find CRUD boring, but Refine makes it fun for developers again!

[![Zeno Rocha](https://refine.ams3.cdn.digitaloceanspaces.com/website/static/assets/testimonials/zeno-rocha.png)

Zeno Rocha

CEO - Resend



](https://twitter.com/zenorocha)

Frame Inner Corner top-leftFrame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-rightFrame Inner Corner bottom-right

Refine perfectly aligns with the philosophy of React Hook Form, and they work seamlessly together.

[![Beier Luo](https://refine.ams3.cdn.digitaloceanspaces.com/website/static/assets/testimonials/beier-luo.png)

Beier Luo

Author of React Hook Form



](https://twitter.com/HookForm)

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-rightSee more

## Built on a Solid foundation

Frame Inner Corner bottom-leftFrame Inner Corner bottom-right

Refine is backed by Y Combinator (YC S23), 500 Emerging Europe and Senovo.

Frame Inner Corner top-leftFrame Inner Corner top-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-rightFrame Inner Corner bottom-leftFrame Inner Corner bottom-right![Solid Foundation](https://refine.ams3.cdn.digitaloceanspaces.com/refine-ai/landing/c/solid-foundation.webp)

Frame Inner Corner top-rightFrame Inner Corner bottom-right

![refine.ai](/refine-ai-logo-dark.png)![refine.ai](/refine-ai-logo-light.png)

Product Hunt Badge

Refine Inc.

447 Sutter St 405

San Francisco

[info@refine.dev](mailto:info@refine.dev)

Join us on

[Github](https://github.com/refinedev/refine)[3Discord](https://discord.gg/refine)[Reddit](https://reddit.com/r/refine)[Twitter](https://twitter.com/refine_dev)[LinkedIn](https://linkedin.com/company/refine-dev)

Product Hunt Badge

Join us on

[Github](https://github.com/refinedev/refine)[3Discord](https://discord.gg/refine)[Reddit](https://reddit.com/r/refine)[Twitter](https://twitter.com/refine_dev)[LinkedIn](https://linkedin.com/company/refine-dev)

[Terms & Conditions](/terms-and-conditions/)[Privacy Policy](/privacy-policy/)

© 2026, Refine from SF to wherever you areHeart

Frame Inner Corner top-rightFrame Inner Corner bottom-right

![refine.ai](/refine-ai-logo-dark.png)![refine.ai](/refine-ai-logo-light.png)

Refine Inc.

447 Sutter St 405

San Francisco

[info@refine.dev](mailto:info@refine.dev)

[Use cases](/use-cases/)[Resources](/resources/)[Alternatives](/alternatives/)[VS](/vs/)[Comparison](/compare/)

[Pricing](/pricing/)[Blog](/blog/)[About](/about/)

Product Hunt Badge

Join us on

[Github](https://github.com/refinedev/refine)[3Discord](https://discord.gg/refine)[Reddit](https://reddit.com/r/refine)[Twitter](https://twitter.com/refine_dev)[LinkedIn](https://linkedin.com/company/refine-dev)

[Terms & Conditions](/terms-and-conditions/)[Privacy Policy](/privacy-policy/)

© 2026, Refine from SF to wherever you areHeart

{"props":{"pageProps":{},"\_\_N\_SSP":true},"page":"/","query":{},"buildId":"Cs-Qp1uPqvxX-vi2kEF3k","isFallback":false,"isExperimentalCompile":false,"gssp":true,"scriptLoader":\[\]}