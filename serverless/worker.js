/**
 * Zentral Issue Reporter — Cloudflare Serverless Worker
 * 
 * Secure endpoint that receives user issue reports and diagnostic logs from Zentral Settings
 * and creates formatted GitHub issues on https://github.com/Michele501st/Zentral-Sine
 * 
 * Setup Instructions:
 * 1. Create a GitHub Fine-Grained Personal Access Token with "Issues: Read and Write" on Michele501st/Zentral-Sine.
 * 2. Deploy this worker to Cloudflare Workers (https://workers.cloudflare.com/).
 * 3. Add an encrypted environment secret named `GITHUB_TOKEN` with your GitHub token value.
 */

export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const data = await request.json();
      const { title, description, category = "bug", systemInfo = {}, logs = "" } = data;

      if (!title || !description) {
        return new Response(
          JSON.stringify({ error: "Title and description are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Map Category to GitHub Labels
      const labelMap = {
        bug: ["bug", "diagnostics"],
        layout: ["visual/layout", "diagnostics"],
        performance: ["performance", "diagnostics"],
        enhancement: ["enhancement"],
      };
      const labels = labelMap[category] || ["diagnostics"];

      // 3. Format GitHub Issue Markdown Body
      let body = `### Description\n${description.trim()}\n\n`;

      body += `### 🖥️ Environment\n`;
      body += `- **Zentral Version:** ${systemInfo.zentralVersion || "Unknown"}\n`;
      body += `- **Zen Build:** ${systemInfo.zenVersion || "Unknown"}\n`;
      body += `- **OS / Platform:** ${systemInfo.platform || "Unknown"}\n`;
      body += `- **Window / DPR:** ${systemInfo.windowSize || "Unknown"} (DPR: ${systemInfo.dpr || 1})\n`;
      body += `- **Sidebar Layout:** ${systemInfo.sidebarMode || "Vertical"}\n\n`;

      if (logs && logs.trim()) {
        let processedLogs = logs.trim();
        // GitHub limits issue bodies to 65,536 characters. Keep under 50,000 characters for safety.
        if (processedLogs.length > 50000) {
          const head = processedLogs.slice(0, 12000);
          const tail = processedLogs.slice(-36000);
          processedLogs = `${head}\n\n... [Log truncated: Preserved initial system snapshot & most recent events to fit GitHub's 65,536-character limit] ...\n\n${tail}`;
        }
        const lineCount = processedLogs.split("\n").length;
        body += `<details>\n<summary>📋 Diagnostic Log (${lineCount} lines - click to expand)</summary>\n\n\`\`\`text\n${processedLogs}\n\`\`\`\n</details>\n`;
      }

      // 4. Send POST request to GitHub API
      const repoOwner = "Michele501st";
      const repoName = "Zentral-Sine";

      const ghResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/issues`,
        {
          method: "POST",
          headers: {
            "Authorization": `token ${env.GITHUB_TOKEN}`,
            "User-Agent": "Zentral-Issue-Reporter",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: `[${category.toUpperCase()}] ${title.trim()}`,
            body: body,
            labels: labels,
          }),
        }
      );

      const ghResult = await ghResponse.json();

      if (!ghResponse.ok) {
        return new Response(
          JSON.stringify({
            error: ghResult.message || "Failed to create GitHub issue",
            status: ghResponse.status,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 5. Return success JSON
      return new Response(
        JSON.stringify({
          success: true,
          issueNumber: ghResult.number,
          issueUrl: ghResult.html_url,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
