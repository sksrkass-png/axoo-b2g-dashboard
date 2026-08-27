const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");

const ARCHIVE_PATH = path.join(
  ROOT_DIR,
  "data",
  "art_commissions_archive.json"
);

const OUTPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "art_notice_attachments.json"
);

const TARGET_ID = String(
  process.env.ART_NOTICE_ID || ""
).trim();

const ALLOWED_EXTENSIONS = [
  ".hwp",
  ".hwpx",
  ".pdf"
];

const FETCH_ATTEMPTS = 3;


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}


function stripTags(value) {
  return decodeHtml(
    String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}


function getExtension(fileName) {
  const lower = String(fileName || "")
    .toLowerCase()
    .trim();

  return ALLOWED_EXTENSIONS.find(
    (ext) => lower.endsWith(ext)
  ) || "";
}


function normalizeUrl(href, baseUrl) {
  if (!href) {
    return "";
  }

  try {
    return new URL(
      decodeHtml(href),
      baseUrl
    ).toString();
  } catch (error) {
    return "";
  }
}


function uniqueAttachments(attachments) {
  const seen = new Set();

  return attachments.filter((item) => {
    const key = [
      item.name,
      item.url
    ].join("||");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}


function extractAnchorAttachments(
  html,
  pageUrl
) {
  const result = [];

  const anchorRegex =
    /<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

  let match;

  while (
    (
      match =
        anchorRegex.exec(html)
    )
  ) {
    const href = match[2];
    const label = stripTags(match[4]);

    const extension =
      getExtension(label) ||
      getExtension(href);

    if (!extension) {
      continue;
    }

    const url =
      normalizeUrl(
        href,
        pageUrl
      );

    if (!url) {
      continue;
    }

    result.push({
      name:
        label ||
        path.basename(
          new URL(url).pathname
        ),
      extension,
      url
    });
  }

  return result;
}


function extractScriptAttachments(
  html,
  pageUrl
) {
  const result = [];

  const scriptRegex =
    /(?:previewAjax|preListen)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+\.(?:hwp|hwpx|pdf))['"]/gi;

  let match;

  while (
    (
      match =
        scriptRegex.exec(html)
    )
  ) {
    const url =
      normalizeUrl(
        match[1],
        pageUrl
      );

    const name =
      decodeHtml(
        match[2]
      ).trim();

    const extension =
      getExtension(name);

    if (!url || !extension) {
      continue;
    }

    result.push({
      name,
      extension,
      url
    });
  }

  return result;
}


function extractAttachments(
  html,
  pageUrl
) {
  return uniqueAttachments([
    ...extractAnchorAttachments(
      html,
      pageUrl
    ),
    ...extractScriptAttachments(
      html,
      pageUrl
    )
  ]).sort((a, b) =>
    a.name.localeCompare(
      b.name,
      "ko"
    )
  );
}


function describeError(error) {
  const parts = [];

  if (error && error.message) {
    parts.push(error.message);
  }

  if (error && error.cause) {
    if (error.cause.code) {
      parts.push(
        String(error.cause.code)
      );
    }

    if (error.cause.message) {
      parts.push(
        String(error.cause.message)
      );
    }
  }

  return parts.join(" | ") ||
    "unknown fetch error";
}


async function fetchWithNativeFetch(url) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      20000
    );

  try {
    const response =
      await fetch(
        url,
        {
          redirect: "follow",
          signal:
            controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; AXOO-B2G-Collector/1.1)",
            "Accept":
              "text/html,application/xhtml+xml,*/*",
            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.7",
            "Cache-Control":
              "no-cache"
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        "HTTP " +
        response.status
      );
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}


function fetchWithCurl(url) {
  return execFileSync(
    "curl",
    [
      "-L",
      "--fail",
      "--silent",
      "--show-error",
      "--retry",
      "3",
      "--retry-delay",
      "2",
      "--connect-timeout",
      "15",
      "--max-time",
      "45",
      "-A",
      "Mozilla/5.0 (compatible; AXOO-B2G-Collector/1.1)",
      "-H",
      "Accept-Language: ko-KR,ko;q=0.9,en;q=0.7",
      url
    ],
    {
      encoding: "utf8",
      maxBuffer:
        20 *
        1024 *
        1024
    }
  );
}


async function fetchHtml(url) {
  const errors = [];

  for (
    let attempt = 1;
    attempt <= FETCH_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const html =
        await fetchWithNativeFetch(
          url
        );

      if (
        html &&
        html.length > 100
      ) {
        return html;
      }

      throw new Error(
        "empty html response"
      );
    } catch (error) {
      const message =
        "fetch attempt " +
        attempt +
        ": " +
        describeError(error);

      errors.push(message);
      console.warn(message);

      if (
        attempt < FETCH_ATTEMPTS
      ) {
        await sleep(
          attempt * 1500
        );
      }
    }
  }

  try {
    console.warn(
      "Native fetch failed. Trying curl fallback."
    );

    const html =
      fetchWithCurl(url);

    if (
      html &&
      html.length > 100
    ) {
      return html;
    }

    throw new Error(
      "curl returned empty html"
    );
  } catch (error) {
    errors.push(
      "curl: " +
      describeError(error)
    );
  }

  throw new Error(
    errors.join(" || ")
  );
}


async function main() {
  if (!fs.existsSync(ARCHIVE_PATH)) {
    throw new Error(
      "Archive not found: " +
      ARCHIVE_PATH
    );
  }

  const archive =
    JSON.parse(
      fs.readFileSync(
        ARCHIVE_PATH,
        "utf8"
      )
    );

  let targets =
    archive.filter((item) =>
      Boolean(
        item &&
        item.id &&
        (
          item.sourceUrl ||
          item.url ||
          item.originalUrl
        )
      )
    );

  targets =
    targets.filter(
      (item) =>
        item.archiveIsCurrent !==
        false
    );

  if (TARGET_ID) {
    targets =
      targets.filter(
        (item) =>
          item.id === TARGET_ID
      );
  }

  if (
    TARGET_ID &&
    targets.length === 0
  ) {
    throw new Error(
      "Research ID not found: " +
      TARGET_ID
    );
  }

  console.log(
    "========================================"
  );
  console.log(
    "AXOO ART NOTICE ATTACHMENT EXTRACTOR"
  );
  console.log(
    "Targets:",
    targets.length
  );
  console.log(
    "========================================"
  );

  const output = [];

  for (const item of targets) {
    const sourceUrl =
      item.sourceUrl ||
      item.originalUrl ||
      item.url;

    console.log(
      "\n[NOTICE]",
      item.id
    );
    console.log(
      item.title
    );

    try {
      const html =
        await fetchHtml(
          sourceUrl
        );

      console.log(
        "HTML:",
        html.length,
        "chars"
      );

      const attachments =
        extractAttachments(
          html,
          sourceUrl
        );

      console.log(
        "Attachments:",
        attachments.length
      );

      attachments.forEach(
        (attachment) => {
          console.log(
            " -",
            attachment.name,
            "=>",
            attachment.url
          );
        }
      );

      output.push({
        researchId:
          item.id,
        title:
          item.title || "",
        source:
          item.source || "",
        sourceUrl,
        status:
          attachments.length
            ? "ok"
            : "no_attachments",
        attachments
      });
    } catch (error) {
      const message =
        describeError(error);

      console.error(
        "ERROR:",
        message
      );

      output.push({
        researchId:
          item.id,
        title:
          item.title || "",
        source:
          item.source || "",
        sourceUrl,
        status:
          "fetch_error",
        error:
          message,
        attachments: []
      });
    }
  }

  output.sort(
    (a, b) =>
      a.researchId.localeCompare(
        b.researchId
      )
  );

  fs.mkdirSync(
    path.dirname(OUTPUT_PATH),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      output,
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    "\nSaved:",
    path.relative(
      ROOT_DIR,
      OUTPUT_PATH
    )
  );

  if (TARGET_ID) {
    const targetResult =
      output.find(
        (item) =>
          item.researchId ===
          TARGET_ID
      );

    if (
      !targetResult ||
      targetResult.status !== "ok" ||
      !targetResult.attachments.length
    ) {
      throw new Error(
        "Target attachment extraction failed: " +
        TARGET_ID +
        " / status=" +
        (
          targetResult
            ? targetResult.status
            : "missing"
        )
      );
    }
  }
}


main().catch((error) => {
  console.error(
    "\nFATAL:",
    describeError(error)
  );

  process.exit(1);
});
