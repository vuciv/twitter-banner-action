// tweet-banner.ts
import 'dotenv/config';
import sharp from 'sharp';
import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs/promises';

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
  const fetch = (await import('node-fetch')).default;
  const [vimRaw, newsRaw] = await Promise.all([
    fetch('https://golf-d5bs.onrender.com/v1/solutions/analytics').then(r => r.json() as Promise<VimStats>),
    fetch('https://news-app-nmzn.onrender.com/api/analytics').then(r => r.json() as Promise<{ analytics: NewsStats }>),
  ]);
  return { vim: vimRaw, news: newsRaw.analytics };
}

/** 2 ▸ build a 1500×500 PNG banner */
async function buildBanner({ vim, news }: { vim: VimStats, news: NewsStats }, previousStats: { vim: VimStats, news: NewsStats } | null) {

  // --- Layout Constants ---
  const HEADER_X = 450;
  const LEFT_COL_X = 500;
  const RIGHT_COL_X = 1000;

  const HEADER_Y = 50;
  const ROW1_Y = 240;
  const ROW2_Y = 280;
  const ROW3_Y = 315;

  // --- End Layout Constants ---

  // --- Helper for Percentage Change ---
  const calculateChange = (current: number, previous: number | undefined): { text: string; color: string } => {
    const defaultColor = "#888888"; // Grey for no change/data
    const greenColor = "#2ecc71";   // Green for increase
    const redColor = "#e74c3c";     // Red for decrease

    if (previous === undefined || previous === null) return { text: "", color: defaultColor };
    if (current === previous) return { text: "(+/- 0.0%)", color: defaultColor };

    let percentageText = "";
    let color = defaultColor;

    if (previous === 0) {
      if (current > 0) {
        percentageText = "(New)"; // Simplified text for new entries
        color = greenColor;
      } else {
        percentageText = "(+/- 0.0%)"; // Still 0
      }
    } else {
      const change = ((current - previous) / previous) * 100;
      const sign = change > 0 ? "+" : "";
      percentageText = `${sign}${change.toFixed(1)}%`;
      color = change > 0 ? greenColor : redColor;
    }

    return { text: percentageText, color };
  };

  const vimChangeData = calculateChange(vim.totalSolutions, previousStats?.vim?.totalSolutions);
  const newsChangeData = calculateChange(news.totalUsers, previousStats?.news?.totalUsers);
  // --- End Helper ---

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const svg = `
  <svg width="1500" height="500" xmlns="http://www.w3.org/2000/svg">
    <style>
      .txt { font-family: 'Inter', sans-serif; fill: #ffffff; }
      .big { font-size: 72px; font-weight: 700; }
      .small { font-size: 32px; }
      .tiny { font-size: 28px; }
      .change-news { font-size: 24px; fill: ${newsChangeData.color}; }
      .change-vim { font-size: 24px; fill: ${vimChangeData.color}; }
    </style>
    <rect width="1500" height="500" fill="#0d1117" />
    
    <text x="${HEADER_X}" y="${HEADER_Y}" class="txt tiny">
      Hi, I'm Josh – I build indie projects 🚀
    </text>

    <text x="${HEADER_X}" y="${HEADER_Y + 40}" class="txt tiny">
      Here are my current projects and their live stats (updated daily):
    </text>

    <text x="${LEFT_COL_X}"  y="${ROW1_Y}" class="txt big">${vim.totalSolutions}</text>
    <text x="${LEFT_COL_X}"  y="${ROW2_Y}" class="txt small">Total golf.vim Solutions</text>
    <text x="${LEFT_COL_X}"  y="${ROW3_Y}" class="txt change-vim">${vimChangeData.text}</text>

    <text x="${RIGHT_COL_X}" y="${ROW1_Y}" class="txt big">${news.totalUsers}</text>
    <text x="${RIGHT_COL_X}" y="${ROW2_Y}" class="txt small">Total AI Satire News Users</text>
    <text x="${RIGHT_COL_X}" y="${ROW3_Y}" class="txt change-news">${newsChangeData.text}</text>
  </svg>
`;


  
  // Generate PNG with high quality settings
  return sharp(Buffer.from(svg))
    .png({ quality: 100, compressionLevel: 0 })
    .toBuffer();
}

/** 3 ▸ update profile banner */
async function updateBanner(img: Buffer) {
  const client = new TwitterApi({
    appKey:        process.env.TW_CONSUMER_KEY!,
    appSecret:     process.env.TW_CONSUMER_SECRET!,
    accessToken:   process.env.TW_ACCESS_TOKEN!,
    accessSecret:  process.env.TW_ACCESS_SECRET!,
  });
  await client.v1.updateAccountProfileBanner(img, {
    width: 1500,
    height: 500,
    offset_left: 0,
    offset_top: 0,
  });
  console.log('✅  Banner updated');
}

(async () => {
  // Helper to get YYYY-MM-DD string in UTC to avoid timezone issues
  const getUTCDateString = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  const todayDateStr = getUTCDateString(today);
  const yesterdayDateStr = getUTCDateString(yesterday);

  const todayStatsFile = `stats_${todayDateStr}.json`;
  const yesterdayStatsFile = `stats_${yesterdayDateStr}.json`;

  // --- Clean up old stats files --- 
  try {
    const allFiles = await fs.readdir('.');
    const statsFiles = allFiles.filter(file => /^stats_\d{4}-\d{2}-\d{2}\.json$/.test(file));
    
    for (const file of statsFiles) {
      if (file !== todayStatsFile && file !== yesterdayStatsFile) {
        try {
          await fs.unlink(file);
          console.log(`🧹 Deleted old stats file: ${file}`);
        } catch (deleteError) {
          console.error(`⚠️ Could not delete old stats file ${file}:`, deleteError);
        }
      }
    }
  } catch (readDirError) {
    console.error('⚠️ Could not read directory for cleanup:', readDirError);
  }
  // --- End cleanup --- 

  let previousStatsData: { vim: VimStats, news: NewsStats } | null = null;

  // 1. Get current stats
  let currentStats;
  try {
    currentStats = await getStats();
    console.log('📊 Current Vim Stats:', currentStats.vim);
    console.log('📊 Current News Stats:', currentStats.news);
  } catch (error) {
    console.error('❌ Failed to fetch current stats:', error);
    process.exit(1);
  }

  // 2. Save current stats for today
  try {
    const dataToSave = {
      timestamp: today.toISOString(), // Store with UTC timestamp for reference
      stats: currentStats
    };
    await fs.writeFile(todayStatsFile, JSON.stringify(dataToSave, null, 2));
    console.log(`✅  Current stats saved to ${todayStatsFile}`);
  } catch (error) {
    console.error(`❌ Error saving current stats to ${todayStatsFile}:`, error);
    // Continue even if save fails, maybe we can still compare
  }

  // 3. Try to load yesterday's stats for comparison
  try {
    const fileContent = await fs.readFile(yesterdayStatsFile, 'utf-8');
    const storedData = JSON.parse(fileContent);
    if (storedData.stats) {
      previousStatsData = storedData.stats;
      console.log(`ℹ️  Using stats from ${yesterdayDateStr} for comparison.`);
    } else {
      console.warn(`⚠️  Stats data missing in ${yesterdayStatsFile}. Proceeding without comparison data.`);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`ℹ️  ${yesterdayStatsFile} not found. Cannot compare with yesterday.`);
    } else {
      console.error(`❌ Error reading yesterday's stats from ${yesterdayStatsFile}:`, error);
    }
    // previousStatsData remains null
  }


  // 4. Build banner
  const banner = await buildBanner(currentStats, previousStatsData);
  console.log('🖼️  Banner built.');

  // 5. Update Twitter banner
  try {
    await updateBanner(banner); // Uncomment when ready to push to Twitter
    console.log('✅  Banner updated on Twitter.');
  } catch (error) {
    console.error('❌ Error updating Twitter banner:', error);
  }

})();
