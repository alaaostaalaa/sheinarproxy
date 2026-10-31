export const config = {
  api: {
    bodyParser: false
  }
};

const SHEIN_HOST = "https://m.shein.com";

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "https://m.shein.com");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "https://m.shein.com");
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const incoming = new URL(req.url, "https://proxy.local");
    const originalPath = incoming.searchParams.get("path");

    if (!originalPath || !originalPath.startsWith("/eur/bff-api/")) {
      return res.status(400).json({
        error: "Expected an /eur/bff-api/ path"
      });
    }

    const targetPath = originalPath.replace(
      "/eur/bff-api/",
      "/ar/bff-api/"
    );

    incoming.searchParams.delete("path");

    const query = incoming.searchParams.toString();

    const targetUrl =
      SHEIN_HOST + targetPath + (query ? "?" + query : "");

    const headers = {
      "Accept": req.headers.accept || "*/*",
      "Accept-Language": req.headers["accept-language"] || "ar,en;q=0.9",
      "Referer": "https://m.shein.com/ar/"
    };

    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }

    const options = {
      method: req.method,
      headers,
      redirect: "follow"
    };

    if (req.method === "POST") {
      options.body = await readBody(req);
    }

    console.log("TARGET:", targetUrl);

    const upstream = await fetch(targetUrl, options);

    const responseBody = Buffer.from(
      await upstream.arrayBuffer()
    );

    console.log("UPSTREAM STATUS:", upstream.status);
    console.log("UPSTREAM TYPE:", upstream.headers.get("content-type"));

    res.status(upstream.status);

    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    return res.send(responseBody);

  } catch (error) {
    console.error("PROXY ERROR:", error.message);
    return res.status(502).json({
      error: "Proxy failed",
      message: error.message
    });
  }
}
