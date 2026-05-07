const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
  body: JSON.stringify(body),
});

const configuredValue = (...keys) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
};

const validatedHTTPURL = (raw) => {
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol) || !url.host) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
};

const resolveQwenEndpoint = () => {
  const fullOverride = configuredValue("QWEN_CHAT_COMPLETIONS_URL");
  if (fullOverride) {
    const url = validatedHTTPURL(fullOverride);
    if (!url) throw new Error("Invalid QWEN_CHAT_COMPLETIONS_URL.");
    return url;
  }

  const baseURL = configuredValue("QWEN_BASE_URL") ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const normalizedBase = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  const endpoint = normalizedBase.endsWith("/chat/completions")
    ? normalizedBase
    : `${normalizedBase}/chat/completions`;
  const url = validatedHTTPURL(endpoint);
  if (!url) throw new Error("Invalid QWEN_BASE_URL.");
  return url;
};

const parseBody = (event) => {
  if (!event.body) return {};
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(body);
};

const validateRequest = (body) => {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return { ok: false, statusCode: 400, message: "Missing prompt." };
  }
  if (prompt.length > 12000) {
    return { ok: false, statusCode: 413, message: "Prompt is too large." };
  }

  const jsonMode = body.jsonMode === true;
  const rawTemperature = typeof body.temperature === "number" ? body.temperature : 0.4;
  const temperature = Math.min(1.2, Math.max(0, rawTemperature));
  return { ok: true, prompt, jsonMode, temperature };
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: {
        type: "method_not_allowed",
        message: "Use POST.",
      },
    });
  }

  let body;
  try {
    body = parseBody(event);
  } catch {
    return jsonResponse(400, {
      error: {
        type: "invalid_json",
        message: "Request body must be valid JSON.",
      },
    });
  }

  const request = validateRequest(body);
  if (!request.ok) {
    return jsonResponse(request.statusCode, {
      error: {
        type: "invalid_request",
        message: request.message,
      },
    });
  }

  const apiKey = configuredValue("QWEN_API_KEY", "DASHSCOPE_API_KEY");
  if (!apiKey) {
    return jsonResponse(500, {
      error: {
        type: "misconfigured",
        message: "AI backend is not configured.",
      },
    });
  }

  let endpoint;
  try {
    endpoint = resolveQwenEndpoint();
  } catch {
    return jsonResponse(500, {
      error: {
        type: "misconfigured",
        message: "AI backend endpoint is not configured.",
      },
    });
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: configuredValue("QWEN_MODEL") ?? "qwen3.5-plus",
        messages: [{ role: "user", content: request.prompt }],
        temperature: request.temperature,
        response_format: request.jsonMode ? { type: "json_object" } : undefined,
        enable_thinking: false,
      }),
    });

    const text = await upstream.text();
    const payload = text ? JSON.parse(text) : {};
    return jsonResponse(upstream.status, payload);
  } catch (error) {
    console.error("Echoknot AI proxy failed", error);
    return jsonResponse(502, {
      error: {
        type: "upstream",
        message: "AI provider request failed.",
      },
    });
  }
};
