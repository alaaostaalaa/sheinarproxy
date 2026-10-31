export const config = {
  api: {
    bodyParser: false
  }
};

const SHEIN_HOST = "https://m.shein.com";

const ALLOWED_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "x-requested-with",
  "x-csrf-token",
  "anti-in",
  "x-oest",
  "webversion",
  "x-ad-flag",
  "x-time-zone",
  "timezone",
  "armortoken",
  "uber-trace-id",
  "hdata-c",
  "x-gw-auth",
  "x-cs-random"
];

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {

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
    "Content-Type, Accept, X-Shein-Cookie, X-Shein-Headers"
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

    const originalPath =
      incoming.searchParams.get("path");

    if (
      !originalPath ||
      !originalPath.startsWith("/eur/bff-api/") ||
      originalPath.includes("..")
    ) {
      return res.status(400).json({
        error: "Invalid API path"
      });
    }

    const targetPath = originalPath.replace(
      "/eur/bff-api/",
      "/tr/bff-api/"
    );

    incoming.searchParams.delete("path");

    const query = incoming.searchParams.toString();

    const targetUrl =
      SHEIN_HOST +
      targetPath +
      (query ? "?" + query : "");

    const headers = {
      "Origin": SHEIN_HOST,
      "Referer": "https://m.shein.com/tr/",
      "Accept": "*/*"
    };

    // استقبال الترويسات الأصلية
    const forwarded = req.headers["x-shein-headers"];

    if (forwarded) {
      const parsed = JSON.parse(forwarded);

      for (const [name, value] of Object.entries(parsed)) {

        const key = name.toLowerCase();

        if (
          ALLOWED_HEADERS.includes(key) &&
          typeof value === "string"
        ) {
          headers[name] = value;
        }
      }
    }

    // Cookie اختياري
    const cookie = req.headers["x-shein-cookie"];

    if (cookie) {
      headers["Cookie"] = cookie;
    }

    const options = {
      method: req.method,
      headers,
      redirect: "follow"
    };

    if (req.method === "POST") {
      options.body = await readBody(req);
    }

    console.log(
      "PROXY TARGET:",
      req.method,
      targetPath
    );

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
      targetPath,
      "STATUS:",
      upstream.status,
      "TYPE:",
      contentType
    );

    res.status(upstream.status);

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    return res.send(responseBody);

  } catch (error) {

    console.error(
      "PROXY ERROR:",
      error.message
    );

    return res.status(502).json({
      error: "Proxy failed"
    });
  }
}
