/**
 * Vercel Serverless Function - COS 预签名下载
 * GET /api/download?key=<cos-object-key>
 * 生成临时预签名 URL 后 302 跳转，有效期 10 分钟
 */
const COS = require('cos-nodejs-sdk-v5');

const BUCKET = 'slban-download-1441072440';
const REGION = 'ap-guangzhou';
const EXPIRE_SECONDS = 600; // 10分钟，足够开始传输

// 懒初始化 COS SDK（Vercel 冷启动优化）
let cosInstance = null;
function getCOS() {
  if (cosInstance) return cosInstance;
  cosInstance = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY,
  });
  return cosInstance;
}

module.exports = async (req, res) => {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }

  const key = req.query.key;
  if (!key) {
    res.status(400).json({ error: '缺少 key 参数' });
    return;
  }

  // 安全检查：防路径穿越
  if (key.includes('..') || key.startsWith('/')) {
    res.status(403).json({ error: '非法的文件路径' });
    return;
  }

  try {
    const url = await new Promise((resolve, reject) => {
      getCOS().getObjectUrl({
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Sign: true,
        Expires: EXPIRE_SECONDS,
      }, (err, data) => {
        if (err) return reject(err);
        resolve(data.Url);
      });
    });

    // 302 跳转到预签名 URL（浏览器开始下载）
    res.writeHead(302, { Location: url });
    res.end();
  } catch (err) {
    console.error('[API/download] COS签名失败:', err.message);
    res.status(500).json({ error: '下载链接生成失败，请稍后重试' });
  }
};
