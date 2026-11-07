'use strict';
// 静态托管（GitHub Pages / Cloudflare Pages / Netlify / Vercel 静态）时的直连配置。
// 页面启动时会先请求 /api/config；拿不到就回落到这里，由浏览器直接调用下面的接口。
// 注意：仓库是公开的，不要把 Key 写在这里。进页面后点右上角「API 设置」手动填。
// 模型清单取自 draw.klong.lat（恐龙绘图站）的实际请求，同一套网关。
window.COVER_DIRECT = {
  base: 'https://api.klong.lat/v1',
  model: 'gpt-image-2',
  splitModel: 'gpt-image-2',
  models: [
    'gpt-image-2',
    'gpt-image-2.5',
    'gpt-image-2.5-flare',
    'gpt-image-2.5-sunburst',
    'gpt-image-2-exact',
    'gpt-image-2.5-exact',
    'gpt-image-2-vip',
    'gpt-image-2-high'
  ],
  sizeMode: 'standard', // standard | ratio | none
  key: '',
  body: { output_format: 'png', moderation: 'auto' }
};
