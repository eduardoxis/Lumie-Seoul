module.exports = async (req, res) => {
  const userId = process.env.INSTAGRAM_USER_ID, token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!userId || !token) return res.status(204).end();
  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(userId)}/media?fields=id,media_type,media_url,permalink,thumbnail_url,username,video_duration,timestamp&limit=25&access_token=${encodeURIComponent(token)}`;
    const data = await (await fetch(url)).json();
    const reel = (data.data || []).find(item => item.media_type === 'REELS' || item.media_type === 'VIDEO');
    if (!reel) return res.status(204).end();
    const seconds = Math.round(reel.video_duration || 0), duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`;
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.status(200).json({ thumbnail: reel.thumbnail_url || reel.media_url, url: reel.permalink, username: reel.username || 'lumie.seoul', duration });
  } catch (error) { console.error('Instagram Reels:', error); return res.status(204).end(); }
};
