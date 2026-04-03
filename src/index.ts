import * as core from "@actions/core";
import * as github from "@actions/github";
import { minimatch } from "minimatch";

interface FileStats {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  excluded: boolean;
}

async function run(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const excludePatterns = core
    .getInput("exclude-patterns")
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const commentTag = core.getInput("comment-tag") || "lines-changed-check";
  const postComment = core.getBooleanInput("post-comment");

  const octokit = github.getOctokit(token);
  const context = github.context;

  if (!context.payload.pull_request) {
    core.setFailed("This action can only be run on pull request events.");
    return;
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const pullNumber = context.payload.pull_request.number;

  // Fetch all files changed in the PR (handles pagination)
  const files: FileStats[] = [];
  let page = 1;
  while (true) {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
      page,
    });

    if (response.data.length === 0) break;

    for (const file of response.data) {
      const excluded = excludePatterns.some((pattern) =>
        minimatch(file.filename, pattern)
      );
      files.push({
        filename: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        excluded,
      });
    }

    if (response.data.length < 100) break;
    page++;
  }

  const includedFiles = files.filter((f) => !f.excluded);
  const excludedFiles = files.filter((f) => f.excluded);

  const totalAdditions = includedFiles.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = includedFiles.reduce((sum, f) => sum + f.deletions, 0);
  const totalChanges = totalAdditions - totalDeletions;

  // Set outputs
  core.setOutput("total-additions", totalAdditions);
  core.setOutput("total-deletions", totalDeletions);
  core.setOutput("total-changes", totalChanges);
  core.setOutput("included-file-count", includedFiles.length);
  core.setOutput("excluded-file-count", excludedFiles.length);

  core.info(`Included files: ${includedFiles.length}`);
  core.info(`Excluded files: ${excludedFiles.length}`);
  core.info(
    `Lines changed: +${totalAdditions} -${totalDeletions} (${totalChanges} total)`
  );

  if (postComment) {
    const body = buildComment(
      commentTag,
      totalAdditions,
      totalDeletions,
      totalChanges,
      includedFiles,
      excludedFiles,
      excludePatterns
    );
    await upsertComment(octokit, owner, repo, pullNumber, commentTag, body);
  }
}

function buildComment(
  tag: string,
  additions: number,
  deletions: number,
  total: number,
  included: FileStats[],
  excluded: FileStats[],
  patterns: string[]
): string {
  const fmt = new Intl.NumberFormat("en-US");
  const lines: string[] = [];
  lines.push(`<!-- ${tag} -->`);
  lines.push(`## Lines Changed`);
  lines.push("");
  lines.push(`| Additions | Deletions | Delta |`);
  lines.push(`|---:|---:|---:|`);
  const sign = total >= 0 ? "+" : "";
  lines.push(`| +${fmt.format(additions)} | -${fmt.format(deletions)} | ${sign}${fmt.format(total)} |`);
  lines.push("");
  lines.push(
    `*${fmt.format(included.length)} file(s) counted, ${fmt.format(excluded.length)} file(s) excluded*`
  );

  if (patterns.length > 0) {
    lines.push("");
    lines.push(
      `<details><summary>Exclusion patterns</summary>\n`
    );
    for (const p of patterns) {
      lines.push(`- \`${p}\``);
    }
    lines.push(`\n</details>`);
  }

  if (excluded.length > 0) {
    lines.push("");
    lines.push(
      `<details><summary>Excluded files (${excluded.length})</summary>\n`
    );
    for (const f of excluded) {
      lines.push(`- \`${f.filename}\``);
    }
    lines.push(`\n</details>`);
  }

  return lines.join("\n");
}

async function upsertComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullNumber: number,
  tag: string,
  body: string
): Promise<void> {
  const marker = `<!-- ${tag} -->`;

  // Find existing comment
  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });

  const existing = comments.data.find(
    (c) => c.body && c.body.includes(marker)
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    core.info(`Updated existing comment #${existing.id}`);
  } else {
    const created = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
    core.info(`Created comment #${created.data.id}`);
  }
}

run().catch((error) => {
  core.setFailed(
    error instanceof Error ? error.message : "An unexpected error occurred"
  );
});
