import crypto from 'node:crypto';

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // טיפול בבקשות מהדפדפן
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q');
      const page = searchParams.get('page') || "1"; 

      if (!query) {
        return new Response(JSON.stringify({ error: "אנא הזן מילת חיפוש" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // הבקשה לעליאקספרס
      const params = {
        app_key: env.ALI_APP_KEY,
        method: "aliexpress.affiliate.product.query",
        timestamp: Date.now(),
        format: "json",
        v: "2.0",
        sign_method: "md5",
        keywords: query,
        page_no: page,
        tracking_id: env.ALI_TRACKING_ID,
        ship_to_country: "IL",
        target_currency: "ILS",
        target_language: "HE",
        sort: "LAST_VOLUME_DESC" 
      };

      params.sign = generateSign(params, env.ALI_APP_SECRET);

      const url = new URL("https://api-sg.aliexpress.com/sync");
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

      const response = await fetch(url.toString(), { method: 'GET' });
      const data = await response.json();
      
      // === השינוי כאן: אנחנו מחזירים את התשובה הגולמית (data) כדי לראות מה השגיאה ===
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }
};

function generateSign(params, secret) {
  const sorted = Object.keys(params).sort();
  let base = secret;
  sorted.forEach(key => { base += key + params[key]; });
  base += secret;
  return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}
