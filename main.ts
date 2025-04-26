// tweet-banner.ts
import 'dotenv/config';
import fetch from 'node-fetch';
import sharp from 'sharp';
import { TwitterApi } from 'twitter-api-v2';

type VimStats = {
    totalSolutions: number;
    averageKeystrokes: number;
    averageTimeTakenSeconds: number;
    uniqueSubmitters: number;
  };
  
  type NewsStats = {
    totalUsers: number;
    newUsersToday: number;
    dau: number;
    appOpensToday: number;
    likesToday: number;
    sharesToday: number;
    totalLikes: number;
  };


/** 1 ▸ fetch both analytics endpoints */
async function getStats(): Promise<{ vim: VimStats, news: NewsStats }> {
  const [vimRaw, newsRaw] = await Promise.all([
    fetch('https://golf-d5bs.onrender.com/v1/solutions/analytics').then(r => r.json() as Promise<VimStats>),
    fetch('https://news-app-nmzn.onrender.com/api/analytics').then(r => r.json() as Promise<NewsStats>),
  ]);
  return { vim: vimRaw, news: newsRaw };
}

/** 2 ▸ build a 1500×500 PNG banner */
async function buildBanner({ vim, news }: { vim: VimStats, news: NewsStats }) {
  const svg = `
    <svg width="1500" height="500" xmlns="http://www.w3.org/2000/svg">
      <style>
        .txt { font-family: 'Inter', sans-serif; fill:#fff }
        .big { font-size:72px; font-weight:700 }
        .small{ font-size:32px }
      </style>
      <rect width="1500" height="500" fill="#0d1117"/>
      <text x="60"  y="150" class="txt small">VimGolf solves</text>
      <text x="60"  y="240" class="txt big">${vim.totalSolutions}</text>
      <text x="520" y="150" class="txt small">AI Satire users</text>
      <text x="520" y="240" class="txt big">${news.totalUsers}</text>

      <text x="60"  y="380" class="txt small">Avg keys: ${vim.averageKeystrokes.toFixed(1)}</text>
      <text x="520" y="380" class="txt small">Likes today: ${news.likesToday}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** 3 ▸ update profile banner */
async function updateBanner(img: Buffer) {
  const client = new TwitterApi({
    appKey:        process.env.TW_CONSUMER_KEY!,
    appSecret:     process.env.TW_CONSUMER_SECRET!,
    accessToken:   process.env.TW_ACCESS_TOKEN!,
    accessSecret:  process.env.TW_ACCESS_SECRET!,
  });
  const mediaId = await client.v1.uploadMedia(img, { mimeType: 'image/png' });
  await client.v1.updateAccountProfileBanner(mediaId);
  console.log('✅  Banner updated');
}

(async () => {
  const stats  = await getStats();
  const banner = await buildBanner(stats);
  await updateBanner(banner);
})();
