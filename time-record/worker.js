/**
 * Cloudflare Worker - 简易 JSON 存储服务
 * 
 * 部署步骤：
 * 1. 登录 https://dash.cloudflare.com/
 * 2. 左侧菜单选择 "Workers & Pages"
 * 3. 点击 "Create Worker"
 * 4. 给 Worker 起个名字（如 nanny-tracker）
 * 5. 删除默认代码，粘贴这个文件的内容
 * 6. 点击 "Deploy"
 * 7. 回到 Worker 页面，点击 "Settings" -> "Variables"
 * 8. 添加 KV Namespace：
 *    - 先去 "Workers & Pages" -> "KV" 创建一个 namespace（如 NANNY_DATA）
 *    - 回到 Worker Settings，绑定 KV，变量名填 DATA
 * 9. 复制 Worker 的 URL（如 https://nanny-tracker.xxx.workers.dev）
 */

export default {
  async fetch(request, env) {
    // 处理 CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /data/:id - 读取数据
      if (request.method === 'GET' && path.startsWith('/data/')) {
        const id = path.split('/')[2];
        if (!id) {
          return jsonResponse({ error: 'ID required' }, 400, corsHeaders);
        }
        
        const data = await env.DATA.get(id, 'json');
        if (!data) {
          return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
        }
        return jsonResponse(data, 200, corsHeaders);
      }

      // POST /data - 创建新数据
      if (request.method === 'POST' && path === '/data') {
        const body = await request.json();
        const id = generateId();
        await env.DATA.put(id, JSON.stringify(body));
        return jsonResponse({ id, ...body }, 201, corsHeaders);
      }

      // PUT /data/:id - 更新数据
      if (request.method === 'PUT' && path.startsWith('/data/')) {
        const id = path.split('/')[2];
        if (!id) {
          return jsonResponse({ error: 'ID required' }, 400, corsHeaders);
        }
        
        const body = await request.json();
        await env.DATA.put(id, JSON.stringify(body));
        return jsonResponse({ id, ...body }, 200, corsHeaders);
      }

      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
      
    } catch (error) {
      return jsonResponse({ error: error.message }, 500, corsHeaders);
    }
  }
};

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
