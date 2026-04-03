# Lines Changed Check

A GitHub Action that calculates lines changed in a PR, excluding files that match configurable glob patterns (e.g. test files, migration snapshots). It posts a comment on the PR with the results and automatically updates it when new commits are pushed.

## Usage

```yaml
name: Lines Changed
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  lines-changed:
    runs-on: ubuntu-latest
    steps:
      - uses: your-username/lines-changed-check@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          exclude-patterns: |
            **/*.test.ts
            **/*.test.tsx
            **/*.spec.ts
            **/*.spec.tsx
            **/__tests__/**
            **/migrations/**
            **/*snapshot*
```

## Inputs

| Input | Description | Required | Default |
|---|---|---|---|
| `github-token` | GitHub token for API access | Yes | `${{ github.token }}` |
| `exclude-patterns` | Newline-separated glob patterns for files to exclude | No | `""` |
| `post-comment` | Whether to post/update a PR comment | No | `"true"` |
| `comment-tag` | HTML tag used to identify the comment for upserts | No | `"lines-changed-check"` |

## Outputs

| Output | Description |
|---|---|
| `total-additions` | Lines added (excluding matched files) |
| `total-deletions` | Lines deleted (excluding matched files) |
| `total-changes` | Total lines changed (additions + deletions) |
| `included-file-count` | Number of files counted |
| `excluded-file-count` | Number of files excluded |

## How it works

1. Fetches all files changed in the PR via the GitHub API
2. Matches each file path against the configured exclusion glob patterns using [minimatch](https://github.com/isaacs/minimatch)
3. Sums up additions and deletions for non-excluded files
4. Posts (or updates) a PR comment with a summary table
5. Re-runs automatically on `synchronize` events (new pushes to the branch)

## Developing

```bash
bun install
bun test
bunx @vercel/ncc build src/index.ts --out dist --minify
```

The `dist/` directory is committed to the repo since GitHub Actions require the built output.
