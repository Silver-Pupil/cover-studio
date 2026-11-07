'use strict';
// 静态托管（GitHub Pages / Cloudflare Pages / Netlify / Vercel 静态）时的直连配置。
// 页面启动时会先请求 /api/config；拿不到就回落到这里，由浏览器直接调用下面的接口。
// 注意：仓库是公开的，不要把 Key 写在这里。进页面后点右上角「API 设置」手动填。
window.COVER_DIRECT = {
  base: 'https://api.klong.lat/v1',
  model: 'gpt-image-1',
  splitModel: 'gpt-image-1',
  sizeMode: 'standard', // standard | ratio | none
  key: '',
  body: {}
};
