const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// --- Config ---
const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json');
const VERSION_TS_PATH = path.join(__dirname, '../src/version.ts');
const ENV_PATH = path.join(__dirname, '../.env.local');
const PROJECT_ROOT = path.resolve(__dirname, '../../../'); // Root of monorepo
const CHANGELOG_PATH = path.join(PROJECT_ROOT, 'CHANGELOG.md');

// Load .env.local manually
if (fs.existsSync(ENV_PATH)) {
    const envConfig = fs.readFileSync(ENV_PATH, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.error("❌ Error: GROQ_API_KEY is not set in .env.local or environment variables.");
    process.exit(1);
}

// --- Helpers ---

async function getAIAnalysis(diff) {
    console.log("🤖 Asking Llama 3.3 (via Groq) to analyze changes...");

    const prompt = `
You are a senior tech lead. Analyze the following git diff and generate three things:
1. A detailed commit message (conventional commits format).
2. A semantic version bump recommendation (patch, minor, or major).
3. A changelog entry (markdown format).

Rules:
- Commit Message: Type(scope): subject, followed by a detailed body. Emojis encouraged.
- Bump: "patch" (fixes/tweaks), "minor" (features), "major" (breaking).
- Changelog: Concise, bullet points, grouped by Features/Fixes.

Return ONLY valid JSON:
{
  "commitMessage": "...",
  "bumpType": "patch",
  "changelogEntry": "..."
}

Git Diff (truncated):
${diff.slice(0, 25000)}
`;

    const data = JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2, // Low temp for structured output
        response_format: { type: "json_object" }
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    const content = json.choices?.[0]?.message?.content;
                    if (!content) throw new Error("No content from AI");
                    resolve(JSON.parse(content));
                } catch (e) {
                    console.error("Groq Parse Error:", body);
                    reject(new Error("Failed to parse AI response"));
                }
            });
        });

        req.on('error', (e) => {
            console.error("Groq Request Error:", e);
            reject(new Error("Failed to reach Groq API"));
        });

        req.write(data);
        req.end();
    });
}

// --- Main ---
(async () => {
    try {
        console.log("🚀 Starting Smart Push Process...");

        // 1. Stage all changes to get full diff
        try {
            execSync('git add .', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        } catch (e) {
            console.warn("⚠️ git add . failed, assumes manual staging.");
        }

        // 2. Get Diff
        let diff = '';
        try {
            diff = execSync('git diff --cached', { cwd: PROJECT_ROOT, encoding: 'utf8' });
        } catch (e) {
            console.warn("⚠️ Could not read diff.");
        }

        if (!diff || diff.trim().length === 0) {
            console.log("🤷‍♂️ No changes detected to commit.");
            // Check for unpushed commits?
            try {
                const unpushed = execSync('git log origin/main..HEAD --oneline', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
                if (unpushed) {
                    console.log("📦 Found unpushed commits. Pushing...");
                    execSync('git push origin main', { cwd: PROJECT_ROOT, stdio: 'inherit' });
                    process.exit(0);
                }
            } catch (e) { }
            return;
        }

        // 3. AI Analysis
        const analysis = await getAIAnalysis(diff);
        const { commitMessage, bumpType, changelogEntry } = analysis;

        console.log(`\n📋 Commit Message:\n${commitMessage}`);
        console.log(`\n📈 Bump: ${bumpType.toUpperCase()}`);

        if (!['major', 'minor', 'patch'].includes(bumpType)) {
            console.warn(`⚠️ Invalid bump type '${bumpType}'. Defaulting to 'patch'.`);
            analysis.bumpType = 'patch';
        }

        // 4. Update Version
        const pkg = require(PACKAGE_JSON_PATH);
        const currentVersion = pkg.version;
        let [major, minor, patch] = currentVersion.split('.').map(Number);

        if (bumpType === 'major') { major++; minor = 0; patch = 0; }
        else if (bumpType === 'minor') { minor++; patch = 0; }
        else { patch++; }

        const newVersion = `${major}.${minor}.${patch}`;
        console.log(`🆙 Updating version: ${currentVersion} -> ${newVersion}`);

        // Write package.json
        pkg.version = newVersion;
        fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');

        // Write version.ts
        const versionTsContent = `// This file is auto-generated. Do not edit manually.\nexport const APP_VERSION = "${newVersion}";\n`;
        fs.writeFileSync(VERSION_TS_PATH, versionTsContent);

        // Update CHANGELOG.md (Prepend)
        const date = new Date().toISOString().split('T')[0];
        const newChangelog = `\n## v${newVersion} (${date})\n\n${changelogEntry}\n\n`;
        let existingChangelog = '';
        if (fs.existsSync(CHANGELOG_PATH)) {
            existingChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
        }
        fs.writeFileSync(CHANGELOG_PATH, newChangelog + existingChangelog);

        // 5. Commit & Push
        execSync('git add .', { cwd: PROJECT_ROOT, stdio: 'inherit' });

        // Escape quotes
        const safeMessage = commitMessage.replace(/"/g, '\\"');
        execSync(`git commit -m "${safeMessage}"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });

        console.log("🚀 Pushing to origin...");
        execSync('git push origin main', { cwd: PROJECT_ROOT, stdio: 'inherit' });
        console.log(`\n✅ Released v${newVersion}!`);

        // 6. Deploy Supabase
        console.log("⚡️ Deploying Supabase Functions...");
        try {
            // Using npx for local supabase, ensuring non-interactive/no-verify-jwt if needed
            // The user had issues with 'supabase link' earlier but resolved it.
            // Using 'npx -y supabase' is safer
            execSync('npx -y supabase functions deploy --no-verify-jwt', { cwd: PROJECT_ROOT, stdio: 'inherit' });
            console.log("✅ Supabase Functions Deployed!");
        } catch (err) {
            console.error("⚠️ Supabase deployment failed (but git push succeeded). Check logs.");
        }

    } catch (e) {
        console.error("\n❌ Script Failed:", e);
        process.exit(1);
    }
})();
