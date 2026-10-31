export const config = {
  api: {
    bodyParser: false
  }
};

const SHEIN_HOST = "https://m.shein.com";

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://m.shein.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  
  const requestedHeaders =
    req.headers["access-control-request-headers"];

  if (requestedHeaders) {
    res.setHeader("Access-Control-Allow-Headers", requestedHeaders);
  } else {
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, X-Requested-With"
    );
  }

  res.setHeader("Access-Control-Max-Age", "86400");
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  cors(req, res);

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

    const targetPath = incoming.searchParams.get("path");

    if (
      !targetPath ||
      !targetPath.startsWith("/ar/bff-api/") ||
      targetPath.includes("..")
    ) {
      return res.status(400).json({
        error: "Invalid API path"
      });
    }

    // إزالة معامل path والإبقاء على بقية معاملات الطلب
    incoming.searchParams.delete("path");

    const query = incoming.searchParams.toString();

    const targetUrl =
      SHEIN_HOST +
      targetPath +
      (query ? "?" + query : "");

    // تمرير الرؤوس الضرورية فقط
    const headers = {};

    const allowedHeaders = [
      "accept",
      "accept-language",
      "content-type",
      "x-requested-with",
      "user-agent"
    ];

    for (const name of allowedHeaders) {
      if (req.headers[name]) {
        headers[name] = req.headers[name];
      }
    }

    headers["referer"] = "https://m.shein.com/ar/";

    const options = {
      method: req.method,
      headers,
      redirect: "follow"
    };

    if (req.method === "POST") {
      options.body = await readBody(req);
    }

    const upstream = await fetch(targetUrl, options);
    console.log("TARGET URL:", targetUrl);
console.log("UPSTREAM STATUS:", upstream.status);
console.log("UPSTREAM CONTENT TYPE:", upstream.headers.get("content-type"));
    const responseBody = Buffer.from(
      await upstream.arrayBuffer()
    );

    res.status(upstream.status);

    const contentType = upstream.headers.get("content-type");

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    res.setHeader("Cache-Control", "no-store");

    return res.send(responseBody);

  } catch (error) {
    console.error("SHEIN PROXY ERROR:", error.message);

    return res.status(502).json({
      error: "Proxy request failed",
      message: error.message
    });
  }
}
