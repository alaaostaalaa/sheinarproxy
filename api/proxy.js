export const config = {
  api: {
    bodyParser: false
  }
};

const SHEIN_HOST = "https://m.shein.com";

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {

  // CORS
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://m.shein.com"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, X-Shein-Cookie"
  );

  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const incoming = new URL(
      req.url,
      "https://proxy.local"
    );

    // المسار الأصلي القادم من المتصفح
    const originalPath = incoming.searchParams.get("path");

    if (
      !originalPath ||
      !originalPath.startsWith("/eur/bff-api/") ||
      originalPath.includes("..")
    ) {
      return res.status(400).json({
        error: "Invalid API path"
      });
    }

    // تحويل EUR إلى TR
    const targetPath = originalPath.replace(
      "/eur/bff-api/",
      "/tr/bff-api/"
    );

    // المحافظة على جميع Query Parameters
    incoming.searchParams.delete("path");

    const query = incoming.searchParams.toString();

    const targetUrl =
      SHEIN_HOST +
      targetPath +
      (query ? "?" + query : "");

    // Headers
    const headers = {
      "Accept": req.headers.accept || "*/*",
      "Accept-Language":
        req.headers["accept-language"] || "ar,en;q=0.9",
      "Referer": "https://m.shein.com/tr/"
    };

    if (req.headers["content-type"]) {
      headers["Content-Type"] =
        req.headers["content-type"];
    }

    // تمرير Cookies
    const sessionCookie = req.headers["x-shein-cookie"];

    if (sessionCookie) {
      headers["Cookie"] = sessionCookie;
    }

    // إعداد الطلب
    const options = {
      method: req.method,
      headers: headers,
      redirect: "follow"
    };

    if (req.method === "POST") {
      options.body = await readBody(req);
    }

    console.log(
      "PROXY TARGET:",
      req.method,
      targetUrl
    );

    // إرسال الطلب إلى SHEIN
    const upstream = await fetch(
      targetUrl,
      options
    );

    const responseBody = Buffer.from(
      await upstream.arrayBuffer()
    );

    const contentType =
      upstream.headers.get("content-type");

    console.log(
      "UPSTREAM RESULT:",
      req.method,
      targetUrl,
      "STATUS:",
      upstream.status,
      "TYPE:",
      contentType
    );

    res.status(upstream.status);

    if (contentType) {
      res.setHeader(
        "Content-Type",
        contentType
      );
    }

    return res.send(responseBody);

  } catch (error) {

    console.error(
      "PROXY ERROR:",
      error.message
    );

    return res.status(502).json({
      error: "Proxy failed",
      message: error.message
    });
  }
}
