import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TranscriptRequest {
  url: string;
  platform: "tiktok" | "instagram" | "youtube" | "other";
}

/**
 * Extract video ID from YouTube URL
 */
function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Handle youtu.be short URLs
    if (urlObj.hostname === "youtu.be") {
      return urlObj.pathname.slice(1).split("?")[0];
    }

    // Handle youtube.com URLs
    if (urlObj.hostname.includes("youtube.com")) {
      // Handle /watch?v= URLs
      const videoId = urlObj.searchParams.get("v");
      if (videoId) return videoId;

      // Handle /shorts/ URLs
      const shortsMatch = urlObj.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch) return shortsMatch[1];

      // Handle /embed/ URLs
      const embedMatch = urlObj.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch YouTube video captions/transcript
 * Uses the free timedtext API (no API key required)
 */
async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    // First, get the video page to find caption track URLs
    const videoPageResponse = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );

    if (!videoPageResponse.ok) {
      console.error("Failed to fetch YouTube page");
      return null;
    }

    const html = await videoPageResponse.text();

    // Try to extract caption track URL from the page
    // Look for "captionTracks" in the ytInitialPlayerResponse
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);

    if (!captionMatch) {
      // Try alternative patterns
      const altMatch = html.match(/playerCaptionsTracklistRenderer.*?"captionTracks":\s*(\[.*?\])/);
      if (!altMatch) {
        console.log("No captions found for video");
        return null;
      }
    }

    // Extract the caption tracks array
    let captionTracks;
    try {
      const tracksJson = captionMatch ? captionMatch[1] : null;
      if (!tracksJson) return null;

      captionTracks = JSON.parse(tracksJson);
    } catch {
      console.error("Failed to parse caption tracks");
      return null;
    }

    if (!captionTracks || captionTracks.length === 0) {
      return null;
    }

    // Find English captions (prefer auto-generated if manual not available)
    let captionUrl = null;
    for (const track of captionTracks) {
      if (track.languageCode === "en" || track.languageCode?.startsWith("en")) {
        captionUrl = track.baseUrl;
        break;
      }
    }

    // Fallback to first available track
    if (!captionUrl && captionTracks[0]?.baseUrl) {
      captionUrl = captionTracks[0].baseUrl;
    }

    if (!captionUrl) {
      return null;
    }

    // Fetch the caption XML
    const captionResponse = await fetch(captionUrl);
    if (!captionResponse.ok) {
      return null;
    }

    const captionXml = await captionResponse.text();

    // Parse the XML to extract text
    // YouTube captions are in format: <text start="0.0" dur="2.0">Caption text</text>
    const textMatches = captionXml.matchAll(/<text[^>]*>([^<]*)<\/text>/g);
    const transcriptParts: string[] = [];

    for (const match of textMatches) {
      // Decode HTML entities
      const text = match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n/g, " ")
        .trim();

      if (text) {
        transcriptParts.push(text);
      }
    }

    if (transcriptParts.length === 0) {
      return null;
    }

    // Join all parts into a single transcript
    return transcriptParts.join(" ");
  } catch (error) {
    console.error("YouTube transcript error:", error);
    return null;
  }
}

/**
 * Try to extract Instagram video description/caption
 */
async function getInstagramMetadata(url: string): Promise<string | null> {
  try {
    // Try to fetch the page and extract Open Graph metadata
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      console.log("Instagram page fetch failed:", response.status);
      return null;
    }

    const html = await response.text();

    // Try to extract description from meta tags
    const descMatch = html.match(/<meta\s+(?:name|property)=["'](?:og:description|description)["']\s+content=["']([^"']+)["']/i);
    if (descMatch && descMatch[1]) {
      const description = descMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      if (description.length > 20) {
        console.log("Found Instagram description:", description.substring(0, 100));
        return description;
      }
    }

    // Try to extract from JSON-LD schema
    const schemaMatch = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/i);
    if (schemaMatch) {
      try {
        const schema = JSON.parse(schemaMatch[1]);
        if (schema.description) {
          console.log("Found schema description");
          return schema.description;
        }
        if (schema.caption) {
          return schema.caption;
        }
      } catch {
        // Schema parse failed, continue
      }
    }

    // Try to extract title
    const titleMatch = html.match(/<meta\s+(?:name|property)=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (titleMatch && titleMatch[1]) {
      return `Video title: ${titleMatch[1]}`;
    }

    return null;
  } catch (error) {
    console.error("Instagram metadata extraction error:", error);
    return null;
  }
}

/**
 * Try to extract TikTok video description
 */
async function getTikTokMetadata(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Try to extract description
    const descMatch = html.match(/<meta\s+(?:name|property)=["'](?:og:description|description)["']\s+content=["']([^"']+)["']/i);
    if (descMatch && descMatch[1]) {
      const description = descMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      if (description.length > 20) {
        return description;
      }
    }

    return null;
  } catch (error) {
    console.error("TikTok metadata extraction error:", error);
    return null;
  }
}

/**
 * Get video metadata/description as fallback
 */
async function getVideoMetadata(url: string, platform: string): Promise<string | null> {
  try {
    switch (platform) {
      case "instagram":
        return await getInstagramMetadata(url);
      case "tiktok":
        return await getTikTokMetadata(url);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, platform }: TranscriptRequest = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let transcript: string | null = null;

    console.log("Processing request for platform:", platform, "URL:", url);

    // Try to get transcript based on platform
    switch (platform) {
      case "youtube": {
        const videoId = extractYouTubeVideoId(url);
        console.log("YouTube video ID:", videoId);
        if (videoId) {
          transcript = await getYouTubeTranscript(videoId);
          console.log("YouTube transcript result:", transcript ? `${transcript.length} chars` : "null");
        }
        break;
      }

      case "instagram":
        console.log("Fetching Instagram metadata...");
        transcript = await getInstagramMetadata(url);
        console.log("Instagram result:", transcript ? `${transcript.length} chars` : "null");
        break;

      case "tiktok":
        console.log("Fetching TikTok metadata...");
        transcript = await getTikTokMetadata(url);
        console.log("TikTok result:", transcript ? `${transcript.length} chars` : "null");
        break;

      default:
        transcript = null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        platform,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Transcript error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch transcript",
        transcript: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
