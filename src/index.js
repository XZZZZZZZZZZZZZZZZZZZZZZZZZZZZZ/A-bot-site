import crypto from 'node:crypto';

export default {
  async fetch(request, env) {
    // הגדרת CORS כדי שדף הנחיתה יוכל לדבר עם השרת שלנו
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // טיפול בבקשות מקדימות (Preflight) של הדפדפן
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. קבלת מילת החיפוש מתוך כתובת ה-URL
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q');

      if (!query) {
        return new Response(JSON.stringify({ error: "אנא הזן מילת חיפוש" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 2. הכנת הפרמטרים לעליאקספרס (כולל מיון לפי הכי נמכרים)
      const params = {
        app_key: env.ALI_APP_KEY,
        method: "aliexpress.affiliate.product.query",
        timestamp: Date.now(),
        format: "json",
        v: "2.0",
        sign_method: "md5",
        keywords: query,
        page_no: 1,
        tracking_id: env.ALI_TRACKING_ID,
        ship_to_country: "IL",
        target_currency: "ILS",
        target_language: "HE",
        sort: "LAST_VOLUME_DESC" 
      };

      // 3. יצירת החתימה (Sign) המאובטחת
      params.sign = generateSign(params, env.ALI_APP_SECRET);

      // 4. שליחת הבקשה ל-API של עליאקספרס
      const url = new URL("https://api-sg.aliexpress.com/sync");
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

      const response = await fetch(url.toString(), { method: 'GET' });
      const data = await response.json();
      
      const products = data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];

      // 5. סינון התוצאות (מחיר בין 10 ל-350, ומעל 40 רכישות)
      const filteredProducts = products.filter(p => {
        let priceStr = p.target_app_sale_price || "0";
        const price = parseFloat(priceStr.toString().split("-")[0]);
        return price >= 10 && price <= 350 && p.sale_volume > 40;
      });

      // 6. החזרת התוצאות לדף הנחיתה
      return new Response(JSON.stringify(filteredProducts), {
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

// פונקציית עזר לייצור החתימה של עליאקספרס
function generateSign(params, secret) {
  const sorted = Object.keys(params).sort();
  let base = secret;
  sorted.forEach(key => { base += key + params[key]; });
  base += secret;
  return crypto.createHash("md5").update(base).digest("hex").toUpperCase();
}
