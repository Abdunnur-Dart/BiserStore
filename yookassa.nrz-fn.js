// yookassa.nrz-fn.ts
// Это entry-файл для ONREZA Function

export default {
  async fetch(request: Request, ctx: any) {
    // Разрешаем запросы с твоего сайта (CORS)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Для теста. Потом замени на свой домен
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { 
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    try {
      const body = await request.json();
      const action = body.action;

      // В ONREZA переменные окружения берутся из ctx.env, а не process.env
      const shopId = ctx.env.YOOKASSA_SHOP_ID;
      const secretKey = ctx.env.YOOKASSA_SECRET_KEY;

      if (!shopId || !secretKey) {
        throw new Error("Не найдены переменные окружения YOOKASSA_SHOP_ID или YOOKASSA_SECRET_KEY");
      }

      // Кодируем для Basic Auth (работает в стандартном Node.js)
      const authString = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
      const apiUrl = "https://api.yookassa.ru/v3/payments";

      if (action === "create_payment") {
        const payload = {
          amount: {
            value: body.amount || "1000.00",
            currency: "RUB"
          },
          capture: false, // Заморозка средств
          description: body.description || "Покупка браслета",
          confirmation: {
            type: "redirect",
            return_url: body.return_url || "https://example.com"
          }
        };

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotence-Key": crypto.randomUUID(), // В Node.js 18+ crypto доступен глобально
            "Authorization": `Basic ${authString}`
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        // Логируем через ctx.log, чтобы видеть в панели ONREZA
        ctx.log.info("Ответ от ЮKassa", data);

        return new Response(JSON.stringify(data), { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });

    } catch (error: any) {
      ctx.log.error("Ошибка в функции", error.message);
      return new Response(JSON.stringify({ 
        error: "Ошибка внутри функции", 
        details: error.message 
      }), { 
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
  }
};
